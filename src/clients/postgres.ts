import pg from 'pg';
import {
  Config,
  PostgresError,
  Document,
  DocumentInput,
  Chunk,
  ChunkInput,
  SearchResult,
  EmbeddingCacheEntry,
  QueryLog,
} from '../types/index.js';
import { createChildLogger } from '../utils/logger.js';

const { Pool } = pg;
const logger = createChildLogger('postgres');

/**
 * Postgres database client for documents, chunks, and BM25 search
 */
export class PostgresStore {
  private pool: pg.Pool;

  constructor(config: Config['postgres']) {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    this.pool.on('error', (err) => {
      logger.error({ err }, 'Unexpected error on idle client');
    });
  }

  // ============================================================
  // Document Operations
  // ============================================================

  async insertDocument(doc: DocumentInput): Promise<Document> {
    try {
      const result = await this.pool.query<Document>(
        `INSERT INTO documents (filename, filepath, file_hash, title, total_pages, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, filename, filepath, file_hash as "fileHash", title, total_pages as "totalPages",
                   ingested_at as "ingestedAt", metadata`,
        [
          doc.filename,
          doc.filepath,
          doc.fileHash,
          doc.title,
          doc.totalPages,
          JSON.stringify(doc.metadata || {}),
        ]
      );

      logger.info({ filename: doc.filename }, 'Document inserted');
      return result.rows[0];
    } catch (error: unknown) {
      // Check for unique constraint violation (duplicate hash)
      if ((error as { code?: string }).code === '23505') {
        throw new PostgresError(
          `Document with hash ${doc.fileHash} already exists`,
          error
        );
      }
      logger.error({ error, filename: doc.filename }, 'Failed to insert document');
      throw new PostgresError('Failed to insert document', error);
    }
  }

  async getDocumentByHash(fileHash: string): Promise<Document | null> {
    try {
      const result = await this.pool.query<Document>(
        `SELECT id, filename, filepath, file_hash as "fileHash", title, total_pages as "totalPages",
                ingested_at as "ingestedAt", metadata
         FROM documents WHERE file_hash = $1`,
        [fileHash]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error({ error, fileHash }, 'Failed to get document by hash');
      throw new PostgresError('Failed to get document by hash', error);
    }
  }

  async getDocumentById(id: string): Promise<Document | null> {
    try {
      const result = await this.pool.query<Document>(
        `SELECT id, filename, filepath, file_hash as "fileHash", title, total_pages as "totalPages",
                ingested_at as "ingestedAt", metadata
         FROM documents WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error({ error, id }, 'Failed to get document by id');
      throw new PostgresError('Failed to get document by id', error);
    }
  }

  async listDocuments(): Promise<Document[]> {
    try {
      const result = await this.pool.query<Document>(
        `SELECT id, filename, filepath, file_hash as "fileHash", title, total_pages as "totalPages",
                ingested_at as "ingestedAt", metadata
         FROM documents ORDER BY ingested_at DESC`
      );
      return result.rows;
    } catch (error) {
      logger.error({ error }, 'Failed to list documents');
      throw new PostgresError('Failed to list documents', error);
    }
  }

  async deleteDocument(id: string): Promise<void> {
    try {
      await this.pool.query('DELETE FROM documents WHERE id = $1', [id]);
      logger.info({ id }, 'Document deleted');
    } catch (error) {
      logger.error({ error, id }, 'Failed to delete document');
      throw new PostgresError('Failed to delete document', error);
    }
  }

  // ============================================================
  // Chunk Operations
  // ============================================================

  async insertChunk(chunk: ChunkInput): Promise<Chunk> {
    try {
      const result = await this.pool.query<Chunk>(
        `INSERT INTO chunks (document_id, chunk_index, content, page_number, start_char, end_char, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, document_id as "documentId", chunk_index as "chunkIndex", content,
                   page_number as "pageNumber", start_char as "startChar", end_char as "endChar",
                   metadata, created_at as "createdAt"`,
        [
          chunk.documentId,
          chunk.chunkIndex,
          chunk.content,
          chunk.pageNumber,
          chunk.startChar,
          chunk.endChar,
          JSON.stringify(chunk.metadata || {}),
        ]
      );

      return result.rows[0];
    } catch (error) {
      logger.error(
        { error, documentId: chunk.documentId, chunkIndex: chunk.chunkIndex },
        'Failed to insert chunk'
      );
      throw new PostgresError('Failed to insert chunk', error);
    }
  }

  async insertChunksBatch(chunks: ChunkInput[]): Promise<Chunk[]> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const insertedChunks: Chunk[] = [];
      for (const chunk of chunks) {
        const result = await client.query<Chunk>(
          `INSERT INTO chunks (document_id, chunk_index, content, page_number, start_char, end_char, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, document_id as "documentId", chunk_index as "chunkIndex", content,
                     page_number as "pageNumber", start_char as "startChar", end_char as "endChar",
                     metadata, created_at as "createdAt"`,
          [
            chunk.documentId,
            chunk.chunkIndex,
            chunk.content,
            chunk.pageNumber,
            chunk.startChar,
            chunk.endChar,
            JSON.stringify(chunk.metadata || {}),
          ]
        );
        insertedChunks.push(result.rows[0]);
      }

      await client.query('COMMIT');
      logger.info({ count: insertedChunks.length }, 'Batch chunks inserted');
      return insertedChunks;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error({ error }, 'Failed to insert batch chunks');
      throw new PostgresError('Failed to insert batch chunks', error);
    } finally {
      client.release();
    }
  }

  async getChunksByDocument(documentId: string): Promise<Chunk[]> {
    try {
      const result = await this.pool.query<Chunk>(
        `SELECT id, document_id as "documentId", chunk_index as "chunkIndex", content,
                page_number as "pageNumber", start_char as "startChar", end_char as "endChar",
                metadata, created_at as "createdAt"
         FROM chunks WHERE document_id = $1 ORDER BY chunk_index`,
        [documentId]
      );
      return result.rows;
    } catch (error) {
      logger.error({ error, documentId }, 'Failed to get chunks by document');
      throw new PostgresError('Failed to get chunks by document', error);
    }
  }

  async getChunkById(id: string): Promise<Chunk | null> {
    try {
      const result = await this.pool.query<Chunk>(
        `SELECT id, document_id as "documentId", chunk_index as "chunkIndex", content,
                page_number as "pageNumber", start_char as "startChar", end_char as "endChar",
                metadata, created_at as "createdAt"
         FROM chunks WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error({ error, id }, 'Failed to get chunk by id');
      throw new PostgresError('Failed to get chunk by id', error);
    }
  }

  // ============================================================
  // BM25 Search
  // ============================================================

  async searchBM25(query: string, topK: number): Promise<SearchResult[]> {
    try {
      logger.debug({ query, topK }, 'Executing BM25 search');

      const result = await this.pool.query<{
        chunk_id: string;
        document_id: string;
        content: string;
        page_number: number | null;
        chunk_index: number;
        metadata: Record<string, unknown>;
        score: number;
      }>('SELECT * FROM search_bm25($1, $2)', [query, topK]);

      const searchResults: SearchResult[] = result.rows.map((row) => ({
        chunkId: row.chunk_id,
        documentId: row.document_id,
        content: row.content,
        pageNumber: row.page_number ?? undefined,
        chunkIndex: row.chunk_index,
        metadata: row.metadata,
        score: row.score,
        source: 'bm25' as const,
      }));

      logger.debug({ resultCount: searchResults.length }, 'BM25 search complete');

      return searchResults;
    } catch (error) {
      logger.error({ error, query }, 'Failed to execute BM25 search');
      throw new PostgresError('Failed to execute BM25 search', error);
    }
  }

  // ============================================================
  // Embedding Cache
  // ============================================================

  async getCachedEmbedding(contentHash: string): Promise<number[] | null> {
    try {
      const result = await this.pool.query<{ embedding: number[] }>(
        'SELECT embedding FROM embedding_cache WHERE content_hash = $1',
        [contentHash]
      );
      return result.rows[0]?.embedding || null;
    } catch (error) {
      logger.error({ error }, 'Failed to get cached embedding');
      return null; // Don't throw, just return null for cache miss
    }
  }

  async cacheEmbedding(
    contentHash: string,
    embedding: number[],
    model: string
  ): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO embedding_cache (content_hash, embedding, model)
         VALUES ($1, $2, $3)
         ON CONFLICT (content_hash) DO NOTHING`,
        [contentHash, embedding, model]
      );
    } catch (error) {
      logger.error({ error }, 'Failed to cache embedding');
      // Don't throw, caching is non-critical
    }
  }

  // ============================================================
  // Query Cache
  // ============================================================

  async getCachedQuery(
    queryHash: string
  ): Promise<{ response: Record<string, unknown> } | null> {
    try {
      const result = await this.pool.query<{ response: Record<string, unknown> }>(
        `SELECT response FROM query_cache
         WHERE query_hash = $1 AND expires_at > NOW()`,
        [queryHash]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error({ error }, 'Failed to get cached query');
      return null;
    }
  }

  async cacheQuery(
    queryHash: string,
    queryText: string,
    response: Record<string, unknown>,
    ttlSeconds: number
  ): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO query_cache (query_hash, query_text, response, expires_at)
         VALUES ($1, $2, $3, NOW() + INTERVAL '1 second' * $4)
         ON CONFLICT (query_hash) DO UPDATE SET
           response = EXCLUDED.response,
           expires_at = EXCLUDED.expires_at`,
        [queryHash, queryText, JSON.stringify(response), ttlSeconds]
      );
    } catch (error) {
      logger.error({ error }, 'Failed to cache query');
    }
  }

  // ============================================================
  // Query Logging
  // ============================================================

  async logQuery(log: Omit<QueryLog, 'id' | 'createdAt'>): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO query_logs (query_text, response_text, vector_results, bm25_results,
                                 fused_results, reranked_results, final_results, latency_ms, has_answer)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          log.queryText,
          log.responseText,
          log.vectorResults,
          log.bm25Results,
          log.fusedResults,
          log.rerankedResults,
          log.finalResults,
          log.latencyMs,
          log.hasAnswer,
        ]
      );
    } catch (error) {
      logger.error({ error }, 'Failed to log query');
    }
  }

  async getQueryMetrics(): Promise<{
    totalQueries: number;
    avgLatencyMs: number;
    noAnswerRate: number;
  }> {
    try {
      const result = await this.pool.query<{
        total: string;
        avg_latency: string;
        no_answer_count: string;
      }>(`
        SELECT
          COUNT(*) as total,
          AVG(latency_ms) as avg_latency,
          COUNT(*) FILTER (WHERE has_answer = false) as no_answer_count
        FROM query_logs
      `);

      const row = result.rows[0];
      const total = parseInt(row.total, 10);
      return {
        totalQueries: total,
        avgLatencyMs: parseFloat(row.avg_latency) || 0,
        noAnswerRate: total > 0 ? parseInt(row.no_answer_count, 10) / total : 0,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get query metrics');
      throw new PostgresError('Failed to get query metrics', error);
    }
  }

  // ============================================================
  // Utilities
  // ============================================================

  /**
   * Get the most recent document ingestion date
   */
  async getLastIngestionDate(): Promise<Date | null> {
    try {
      const result = await this.pool.query<{ max_date: Date }>(
        `SELECT MAX(ingested_at) as max_date FROM documents`
      );
      return result.rows[0]?.max_date || null;
    } catch (error) {
      logger.error({ error }, 'Failed to get last ingestion date');
      return null;
    }
  }

  /**
   * Get document metadata for freshness checking
   */
  async getDocumentsMetadata(): Promise<Array<{
    id: string;
    documentType?: string;
    effectiveDate?: Date;
    ingestedAt: Date;
  }>> {
    try {
      const result = await this.pool.query<{
        id: string;
        documentType: string | null;
        effectiveDate: Date | null;
        ingestedAt: Date;
      }>(
        `SELECT
          id,
          metadata->>'documentType' as "documentType",
          (metadata->>'effectiveDate')::timestamp as "effectiveDate",
          ingested_at as "ingestedAt"
         FROM documents`
      );

      return result.rows.map(row => ({
        id: row.id,
        documentType: row.documentType ?? undefined,
        effectiveDate: row.effectiveDate ?? undefined,
        ingestedAt: row.ingestedAt,
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to get documents metadata');
      return [];
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch (error) {
      logger.error({ error }, 'Postgres health check failed');
      return false;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    logger.info('Postgres connection pool closed');
  }
}

// Singleton instance
let storeInstance: PostgresStore | null = null;

export function getPostgresStore(config: Config['postgres']): PostgresStore {
  if (!storeInstance) {
    storeInstance = new PostgresStore(config);
  }
  return storeInstance;
}

export function resetPostgresStore(): void {
  if (storeInstance) {
    storeInstance.close();
  }
  storeInstance = null;
}
