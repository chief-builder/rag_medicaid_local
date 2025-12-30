import { vi } from 'vitest';
import type {
  Document,
  DocumentInput,
  Chunk,
  ChunkInput,
  SearchResult,
  QueryLog,
} from '../../src/types/index.js';

/**
 * Mock PostgreSQL store for testing without actual database
 */
export interface MockPostgresOptions {
  documents?: Document[];
  chunks?: Chunk[];
  searchResults?: SearchResult[];
  cachedEmbeddings?: Map<string, number[]>;
  cachedQueries?: Map<string, Record<string, unknown>>;
  queryMetrics?: {
    totalQueries: number;
    avgLatencyMs: number;
    noAnswerRate: number;
  };
}

export function createMockPostgresStore(options: MockPostgresOptions = {}) {
  const {
    documents = [],
    chunks = [],
    searchResults = [],
    cachedEmbeddings = new Map(),
    cachedQueries = new Map(),
    queryMetrics = { totalQueries: 0, avgLatencyMs: 0, noAnswerRate: 0 },
  } = options;

  // Internal state for tracking
  const storedDocuments: Document[] = [...documents];
  const storedChunks: Chunk[] = [...chunks];
  const embeddingCache = new Map(cachedEmbeddings);
  const queryCache = new Map(cachedQueries);
  const queryLogs: Omit<QueryLog, 'id' | 'createdAt'>[] = [];

  return {
    // Document Operations
    insertDocument: vi.fn().mockImplementation(async (doc: DocumentInput): Promise<Document> => {
      const newDoc: Document = {
        id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        filename: doc.filename,
        filepath: doc.filepath,
        fileHash: doc.fileHash,
        title: doc.title,
        totalPages: doc.totalPages,
        ingestedAt: new Date(),
        metadata: doc.metadata || {},
      };
      storedDocuments.push(newDoc);
      return newDoc;
    }),

    getDocumentByHash: vi.fn().mockImplementation(async (fileHash: string): Promise<Document | null> => {
      return storedDocuments.find(d => d.fileHash === fileHash) || null;
    }),

    getDocumentById: vi.fn().mockImplementation(async (id: string): Promise<Document | null> => {
      return storedDocuments.find(d => d.id === id) || null;
    }),

    listDocuments: vi.fn().mockImplementation(async (): Promise<Document[]> => {
      return [...storedDocuments];
    }),

    deleteDocument: vi.fn().mockImplementation(async (id: string): Promise<void> => {
      const index = storedDocuments.findIndex(d => d.id === id);
      if (index >= 0) {
        storedDocuments.splice(index, 1);
      }
    }),

    // Chunk Operations
    insertChunk: vi.fn().mockImplementation(async (chunk: ChunkInput): Promise<Chunk> => {
      const newChunk: Chunk = {
        id: `chunk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        documentId: chunk.documentId,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        pageNumber: chunk.pageNumber,
        startChar: chunk.startChar,
        endChar: chunk.endChar,
        metadata: chunk.metadata || {},
        createdAt: new Date(),
      };
      storedChunks.push(newChunk);
      return newChunk;
    }),

    insertChunksBatch: vi.fn().mockImplementation(async (chunks: ChunkInput[]): Promise<Chunk[]> => {
      const newChunks: Chunk[] = chunks.map((chunk, i) => ({
        id: `chunk-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
        documentId: chunk.documentId,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        pageNumber: chunk.pageNumber,
        startChar: chunk.startChar,
        endChar: chunk.endChar,
        metadata: chunk.metadata || {},
        createdAt: new Date(),
      }));
      storedChunks.push(...newChunks);
      return newChunks;
    }),

    getChunksByDocument: vi.fn().mockImplementation(async (documentId: string): Promise<Chunk[]> => {
      return storedChunks.filter(c => c.documentId === documentId);
    }),

    getChunkById: vi.fn().mockImplementation(async (id: string): Promise<Chunk | null> => {
      return storedChunks.find(c => c.id === id) || null;
    }),

    // BM25 Search
    searchBM25: vi.fn().mockImplementation(async (query: string, topK: number): Promise<SearchResult[]> => {
      // Return mock search results, limited to topK
      if (searchResults.length > 0) {
        return searchResults.slice(0, topK);
      }

      // Generate simple keyword-based mock results from stored chunks
      const queryWords = query.toLowerCase().split(/\s+/);
      const scored = storedChunks.map(chunk => {
        const content = chunk.content.toLowerCase();
        const matches = queryWords.filter(word => content.includes(word)).length;
        return {
          chunkId: chunk.id,
          documentId: chunk.documentId,
          content: chunk.content,
          pageNumber: chunk.pageNumber,
          chunkIndex: chunk.chunkIndex,
          metadata: chunk.metadata,
          score: matches / queryWords.length,
          source: 'bm25' as const,
        };
      });

      return scored
        .filter(r => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
    }),

    // Embedding Cache
    getCachedEmbedding: vi.fn().mockImplementation(async (contentHash: string): Promise<number[] | null> => {
      return embeddingCache.get(contentHash) || null;
    }),

    cacheEmbedding: vi.fn().mockImplementation(async (
      contentHash: string,
      embedding: number[],
      _model: string
    ): Promise<void> => {
      embeddingCache.set(contentHash, embedding);
    }),

    // Query Cache
    getCachedQuery: vi.fn().mockImplementation(async (
      queryHash: string
    ): Promise<{ response: Record<string, unknown> } | null> => {
      const cached = queryCache.get(queryHash);
      return cached ? { response: cached } : null;
    }),

    cacheQuery: vi.fn().mockImplementation(async (
      queryHash: string,
      _queryText: string,
      response: Record<string, unknown>,
      _ttlSeconds: number
    ): Promise<void> => {
      queryCache.set(queryHash, response);
    }),

    // Query Logging
    logQuery: vi.fn().mockImplementation(async (log: Omit<QueryLog, 'id' | 'createdAt'>): Promise<void> => {
      queryLogs.push(log);
    }),

    getQueryMetrics: vi.fn().mockImplementation(async () => {
      if (queryLogs.length === 0) {
        return queryMetrics;
      }
      const total = queryLogs.length;
      const avgLatency = queryLogs.reduce((sum, log) => sum + log.latencyMs, 0) / total;
      const noAnswerCount = queryLogs.filter(log => !log.hasAnswer).length;
      return {
        totalQueries: total,
        avgLatencyMs: avgLatency,
        noAnswerRate: noAnswerCount / total,
      };
    }),

    // Utilities
    getLastIngestionDate: vi.fn().mockImplementation(async (): Promise<Date | null> => {
      if (storedDocuments.length === 0) return null;
      return storedDocuments.reduce((latest, doc) =>
        doc.ingestedAt > latest ? doc.ingestedAt : latest,
        storedDocuments[0].ingestedAt
      );
    }),

    getDocumentsMetadata: vi.fn().mockImplementation(async () => {
      return storedDocuments.map(doc => ({
        id: doc.id,
        documentType: (doc.metadata as Record<string, unknown>)?.documentType as string | undefined,
        effectiveDate: (doc.metadata as Record<string, unknown>)?.effectiveDate as Date | undefined,
        ingestedAt: doc.ingestedAt,
      }));
    }),

    healthCheck: vi.fn().mockResolvedValue(true),
    close: vi.fn().mockResolvedValue(undefined),

    // Test helpers - access internal state
    _getStoredDocuments: () => storedDocuments,
    _getStoredChunks: () => storedChunks,
    _getQueryLogs: () => queryLogs,
    _getEmbeddingCache: () => embeddingCache,
    _getQueryCache: () => queryCache,
  };
}

/**
 * Create a pre-populated mock store for testing
 */
export function createPopulatedMockPostgresStore() {
  const documents: Document[] = [
    {
      id: 'doc-001',
      filename: 'msp-guide.pdf',
      filepath: '/test/docs/msp-guide.pdf',
      fileHash: 'abc123',
      title: 'Medicare Savings Programs Guide',
      totalPages: 10,
      ingestedAt: new Date('2025-01-15'),
      metadata: { documentType: 'msp_guide' },
    },
    {
      id: 'doc-002',
      filename: 'ltc-info.pdf',
      filepath: '/test/docs/ltc-info.pdf',
      fileHash: 'def456',
      title: 'Long-Term Care Information',
      totalPages: 15,
      ingestedAt: new Date('2025-01-10'),
      metadata: { documentType: 'ltc_info' },
    },
  ];

  const chunks: Chunk[] = [
    {
      id: 'chunk-001',
      documentId: 'doc-001',
      chunkIndex: 0,
      content: 'Medicare Savings Programs (MSPs) help pay Medicare costs for people with limited income.',
      pageNumber: 1,
      startChar: 0,
      endChar: 85,
      metadata: { filename: 'msp-guide.pdf' },
      createdAt: new Date('2025-01-15'),
    },
    {
      id: 'chunk-002',
      documentId: 'doc-001',
      chunkIndex: 1,
      content: 'QMB pays Part A and Part B premiums, deductibles, and coinsurance. Income limit: 100% FPL.',
      pageNumber: 1,
      startChar: 86,
      endChar: 175,
      metadata: { filename: 'msp-guide.pdf' },
      createdAt: new Date('2025-01-15'),
    },
    {
      id: 'chunk-003',
      documentId: 'doc-002',
      chunkIndex: 0,
      content: 'Long-term care Medicaid helps pay for nursing home care and community-based services.',
      pageNumber: 1,
      startChar: 0,
      endChar: 82,
      metadata: { filename: 'ltc-info.pdf' },
      createdAt: new Date('2025-01-10'),
    },
  ];

  return createMockPostgresStore({ documents, chunks });
}

export type MockPostgresStore = ReturnType<typeof createMockPostgresStore>;
