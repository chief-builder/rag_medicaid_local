import { readdir, writeFile, mkdir } from 'fs/promises';
import { join, basename, extname } from 'path';
import { tmpdir } from 'os';
import {
  Config,
  Document,
  Chunk,
  RagError,
  DocumentType,
  SourceAuthority,
  LegalWeight,
} from '../types/index.js';
import { hashFile, hashString } from '../utils/hash.js';
import { createChildLogger } from '../utils/logger.js';
import { sanitizeForPostgres } from '../utils/text-sanitizer.js';
import { LMStudioClient, getLMStudioClient } from '../clients/lm-studio.js';
import { QdrantStore, getQdrantStore, QdrantPayload } from '../clients/qdrant.js';
import { PostgresStore, getPostgresStore } from '../clients/postgres.js';
import { PdfProcessor, createPdfProcessor } from './pdf-processor.js';
import { MarkdownChunker, createChunker } from './chunker.js';

const logger = createChildLogger('ingestion-pipeline');

export interface IngestionStats {
  documentsProcessed: number;
  documentsSkipped: number;
  chunksCreated: number;
  vectorsStored: number;
  errors: string[];
}

/**
 * Complete ingestion pipeline for processing PDFs into the RAG system
 */
export class IngestionPipeline {
  private config: Config;
  private lmStudio: LMStudioClient;
  private qdrant: QdrantStore;
  private postgres: PostgresStore;
  private pdfProcessor: PdfProcessor;
  private chunker: MarkdownChunker;

  constructor(config: Config) {
    this.config = config;
    this.lmStudio = getLMStudioClient(config.lmStudio);
    this.qdrant = getQdrantStore(config.qdrant);
    this.postgres = getPostgresStore(config.postgres);
    this.pdfProcessor = createPdfProcessor(this.lmStudio);
    this.chunker = createChunker({
      chunkSize: config.rag.chunkSize,
      chunkOverlap: config.rag.chunkOverlap,
      preserveMarkdownStructure: true,
    });
  }

  /**
   * Initialize the pipeline (create collections/tables if needed)
   */
  async initialize(): Promise<void> {
    logger.info('Initializing ingestion pipeline');

    // Check health of all services
    const [lmOk, qdrantOk, pgOk] = await Promise.all([
      this.lmStudio.healthCheck(),
      this.qdrant.healthCheck(),
      this.postgres.healthCheck(),
    ]);

    if (!lmOk) {
      logger.warn('LM Studio is not responding - OCR/embedding may fail');
    }

    if (!qdrantOk) {
      throw new RagError('Qdrant is not responding', 'INIT_ERROR');
    }

    if (!pgOk) {
      throw new RagError('Postgres is not responding', 'INIT_ERROR');
    }

    // Initialize Qdrant collection
    await this.qdrant.initialize();

    logger.info('Ingestion pipeline initialized');
  }

  /**
   * Ingest a single PDF file
   */
  async ingestFile(filepath: string): Promise<{
    document: Document;
    chunks: Chunk[];
  }> {
    const filename = basename(filepath);
    logger.info({ filepath, filename }, 'Ingesting file');

    // Check if already ingested
    const fileHash = await hashFile(filepath);
    const existingDoc = await this.postgres.getDocumentByHash(fileHash);

    if (existingDoc) {
      logger.info({ filename, hash: fileHash }, 'Document already ingested');
      const chunks = await this.postgres.getChunksByDocument(existingDoc.id);
      return { document: existingDoc, chunks };
    }

    // Process PDF to markdown
    const ocrResult = await this.pdfProcessor.process(filepath);

    // Create document record
    const document = await this.postgres.insertDocument({
      filename,
      filepath,
      fileHash,
      title: this.extractTitle(ocrResult.fullMarkdown, filename),
      totalPages: ocrResult.totalPages,
      metadata: {
        processedAt: new Date().toISOString(),
        pageCount: ocrResult.pages.length,
      },
    });

    // Chunk the content
    const chunkInputs = this.chunker.chunk(ocrResult.fullMarkdown, document.id, {
      filename,
      title: document.title,
    });

    // Store chunks in Postgres
    const chunks = await this.postgres.insertChunksBatch(chunkInputs);

    // Generate embeddings and store in Qdrant
    await this.embedAndStoreChunks(chunks, document);

    logger.info(
      { filename, documentId: document.id, chunkCount: chunks.length },
      'File ingestion complete'
    );

    return { document, chunks };
  }

  /**
   * Generate embeddings for chunks and store in Qdrant
   */
  private async embedAndStoreChunks(
    chunks: Chunk[],
    document: Document
  ): Promise<void> {
    logger.debug({ chunkCount: chunks.length }, 'Generating embeddings');

    const batchSize = 10; // Process in batches to avoid overwhelming LM Studio
    const points: Array<{ id: string; vector: number[]; payload: QdrantPayload }> =
      [];

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);

      // Check cache first, then generate missing embeddings
      const embeddings = await Promise.all(
        batch.map(async (chunk) => {
          const contentHash = hashString(chunk.content);

          // Try cache
          const cached = await this.postgres.getCachedEmbedding(contentHash);
          if (cached) {
            return cached;
          }

          // Generate new embedding
          const result = await this.lmStudio.embed(chunk.content);

          // Cache it
          await this.postgres.cacheEmbedding(
            contentHash,
            result.embedding,
            result.model
          );

          return result.embedding;
        })
      );

      // Prepare Qdrant points
      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j];
        points.push({
          id: chunk.id,
          vector: embeddings[j],
          payload: {
            chunkId: chunk.id,
            documentId: chunk.documentId,
            content: chunk.content,
            pageNumber: chunk.pageNumber,
            chunkIndex: chunk.chunkIndex,
            metadata: {
              ...chunk.metadata,
              filename: document.filename,
              title: document.title,
            },
          },
        });
      }

      logger.debug(
        { processed: Math.min(i + batchSize, chunks.length), total: chunks.length },
        'Embedding batch progress'
      );
    }

    // Upsert all vectors
    await this.qdrant.upsertBatch(points);

    logger.info({ vectorCount: points.length }, 'Vectors stored in Qdrant');
  }

  /**
   * Ingest all PDF files in a directory
   */
  async ingestDirectory(
    dirPath: string,
    options?: { recursive?: boolean; saveMarkdown?: boolean }
  ): Promise<IngestionStats> {
    const stats: IngestionStats = {
      documentsProcessed: 0,
      documentsSkipped: 0,
      chunksCreated: 0,
      vectorsStored: 0,
      errors: [],
    };

    logger.info({ dirPath, options }, 'Starting directory ingestion');

    const pdfFiles = await this.findPdfFiles(dirPath, options?.recursive);

    logger.info({ fileCount: pdfFiles.length }, 'Found PDF files');

    for (const filepath of pdfFiles) {
      try {
        const { document, chunks } = await this.ingestFile(filepath);

        // Check if this was a new document or skipped
        const existingDoc = await this.postgres.getDocumentByHash(
          await hashFile(filepath)
        );
        if (existingDoc && existingDoc.id === document.id) {
          stats.documentsSkipped++;
        } else {
          stats.documentsProcessed++;
          stats.chunksCreated += chunks.length;
          stats.vectorsStored += chunks.length;
        }

        // Optionally save markdown
        if (options?.saveMarkdown) {
          const ocrResult = await this.pdfProcessor.process(filepath);
          const mdDir = join(dirPath, 'markdown');
          await mkdir(mdDir, { recursive: true });
          const mdPath = join(
            mdDir,
            basename(filepath).replace(/\.pdf$/i, '.md')
          );
          await writeFile(mdPath, ocrResult.fullMarkdown);
        }
      } catch (error) {
        const errorMsg = `Failed to ingest ${filepath}: ${error instanceof Error ? error.message : String(error)}`;
        logger.error({ error, filepath }, 'Ingestion failed for file');
        stats.errors.push(errorMsg);
      }
    }

    logger.info({ stats }, 'Directory ingestion complete');

    return stats;
  }

  /**
   * Find all PDF files in a directory
   */
  private async findPdfFiles(
    dirPath: string,
    recursive: boolean = false
  ): Promise<string[]> {
    const pdfFiles: string[] = [];
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isFile() && extname(entry.name).toLowerCase() === '.pdf') {
        pdfFiles.push(fullPath);
      } else if (entry.isDirectory() && recursive) {
        const subFiles = await this.findPdfFiles(fullPath, true);
        pdfFiles.push(...subFiles);
      }
    }

    return pdfFiles;
  }

  /**
   * Extract title from markdown content
   */
  private extractTitle(markdown: string, fallback: string): string {
    // Look for first H1 or H2
    const h1Match = markdown.match(/^#\s+(.+)$/m);
    if (h1Match) return h1Match[1].trim();

    const h2Match = markdown.match(/^##\s+(.+)$/m);
    if (h2Match) return h2Match[1].trim();

    // Use filename without extension as fallback
    return fallback.replace(/\.[^.]+$/, '');
  }

  /**
   * Delete a document and all its chunks/vectors
   */
  async deleteDocument(documentId: string): Promise<void> {
    logger.info({ documentId }, 'Deleting document');

    // Delete from Qdrant first
    await this.qdrant.deleteByDocument(documentId);

    // Delete from Postgres (cascades to chunks)
    await this.postgres.deleteDocument(documentId);

    logger.info({ documentId }, 'Document deleted');
  }

  /**
   * Get ingestion statistics
   */
  async getStats(): Promise<{
    documentCount: number;
    vectorCount: number;
  }> {
    const docs = await this.postgres.listDocuments();
    const qdrantInfo = await this.qdrant.getCollectionInfo();

    return {
      documentCount: docs.length,
      vectorCount: qdrantInfo.vectorCount,
    };
  }

  /**
   * Ingest content from a URL (HTML or PDF)
   */
  async ingestFromUrl(
    url: string,
    options?: {
      title?: string;
      documentType?: DocumentType;
      sourceAuthority?: SourceAuthority;
      legalWeight?: LegalWeight;
    }
  ): Promise<{ document: Document; chunks: Chunk[] }> {
    logger.info({ url, options }, 'Ingesting from URL');

    // Fetch the content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'RAG-Medicaid-Local/1.0',
        Accept: 'text/html,application/pdf,application/xhtml+xml,*/*',
      },
    });

    if (!response.ok) {
      throw new RagError(
        `Failed to fetch URL: ${response.status} ${response.statusText}`,
        'FETCH_ERROR'
      );
    }

    const contentType = response.headers.get('content-type') || '';
    const isPdf = contentType.includes('application/pdf') || url.endsWith('.pdf');

    if (isPdf) {
      // Download PDF to temp file and process
      const buffer = await response.arrayBuffer();
      const tempPath = join(tmpdir(), `ingest-${Date.now()}.pdf`);
      await writeFile(tempPath, Buffer.from(buffer));

      try {
        const result = await this.ingestFile(tempPath);
        // Update document with URL metadata
        // Note: Document already created, metadata update would need separate method
        return result;
      } finally {
        // Clean up temp file
        try {
          const { unlink } = await import('fs/promises');
          await unlink(tempPath);
        } catch {
          // Ignore cleanup errors
        }
      }
    }

    // Handle HTML content
    const html = await response.text();
    const textContent = this.stripHtml(html);
    const sanitizedContent = sanitizeForPostgres(textContent);
    const contentHash = hashString(sanitizedContent);

    // Check if already ingested
    const existingDoc = await this.postgres.getDocumentByHash(contentHash);
    if (existingDoc) {
      logger.info({ url, hash: contentHash }, 'URL content already ingested');
      const chunks = await this.postgres.getChunksByDocument(existingDoc.id);
      return { document: existingDoc, chunks };
    }

    // Create document record
    const title = options?.title || this.extractTitle(sanitizedContent, url);
    const document = await this.postgres.insertDocument({
      filename: new URL(url).pathname.split('/').pop() || 'web-content',
      filepath: url,
      fileHash: contentHash,
      title,
      metadata: {
        sourceUrl: url,
        processedAt: new Date().toISOString(),
        contentType,
      },
      documentType: options?.documentType,
      sourceAuthority: options?.sourceAuthority,
      legalWeight: options?.legalWeight,
    });

    // Chunk the content
    const chunkInputs = this.chunker.chunk(sanitizedContent, document.id, {
      filename: document.filename,
      title: document.title,
    });

    // Store chunks in Postgres
    const chunks = await this.postgres.insertChunksBatch(chunkInputs);

    // Generate embeddings and store in Qdrant
    await this.embedAndStoreChunks(chunks, document);

    logger.info(
      { url, documentId: document.id, chunkCount: chunks.length },
      'URL ingestion complete'
    );

    return { document, chunks };
  }

  /**
   * Ingest multiple scraped items from source monitoring
   */
  async ingestScrapedItems(
    items: Array<{
      url: string;
      title?: string;
      date?: Date;
      description?: string;
    }>,
    sourceType: DocumentType,
    sourceAuthority: SourceAuthority = 'primary',
    legalWeight: LegalWeight = 'guidance'
  ): Promise<IngestionStats> {
    const stats: IngestionStats = {
      documentsProcessed: 0,
      documentsSkipped: 0,
      chunksCreated: 0,
      vectorsStored: 0,
      errors: [],
    };

    logger.info(
      { itemCount: items.length, sourceType },
      'Ingesting scraped items'
    );

    for (const item of items) {
      try {
        const { document, chunks } = await this.ingestFromUrl(item.url, {
          title: item.title,
          documentType: sourceType,
          sourceAuthority,
          legalWeight,
        });

        // Check if this was new or existing
        const contentHash = hashString(item.url);
        const wasNew = document.ingestedAt.getTime() > Date.now() - 60000; // Created within last minute

        if (wasNew) {
          stats.documentsProcessed++;
          stats.chunksCreated += chunks.length;
          stats.vectorsStored += chunks.length;
        } else {
          stats.documentsSkipped++;
        }
      } catch (error) {
        const errorMsg = `Failed to ingest ${item.url}: ${error instanceof Error ? error.message : String(error)}`;
        logger.error({ error, url: item.url }, 'Ingestion failed for URL');
        stats.errors.push(errorMsg);
      }
    }

    logger.info({ stats }, 'Scraped items ingestion complete');
    return stats;
  }

  /**
   * Strip HTML tags and extract text content
   */
  private stripHtml(html: string): string {
    // Remove script and style elements entirely
    let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    // Remove HTML comments
    text = text.replace(/<!--[\s\S]*?-->/g, '');

    // Replace common block elements with newlines
    text = text.replace(/<\/?(p|div|br|h[1-6]|li|tr|td|th|blockquote)[^>]*>/gi, '\n');

    // Remove all remaining HTML tags
    text = text.replace(/<[^>]+>/g, '');

    // Decode HTML entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    text = text.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec));

    // Clean up whitespace
    text = text.replace(/\t/g, ' ');
    text = text.replace(/ +/g, ' ');
    text = text.replace(/\n +/g, '\n');
    text = text.replace(/ +\n/g, '\n');
    text = text.replace(/\n{3,}/g, '\n\n');

    return text.trim();
  }
}

/**
 * Create an ingestion pipeline
 */
export function createIngestionPipeline(config: Config): IngestionPipeline {
  return new IngestionPipeline(config);
}
