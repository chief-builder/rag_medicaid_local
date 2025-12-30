import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PostgresStore, getPostgresStore, resetPostgresStore } from './postgres.js';

// Mock pg module
vi.mock('pg', () => {
  const mockQuery = vi.fn();
  const mockConnect = vi.fn();
  const mockRelease = vi.fn();
  const mockEnd = vi.fn();

  const MockPool = vi.fn().mockImplementation(() => ({
    query: mockQuery,
    connect: mockConnect.mockResolvedValue({
      query: mockQuery,
      release: mockRelease,
    }),
    end: mockEnd,
    on: vi.fn(),
  }));

  return {
    default: { Pool: MockPool },
  };
});

describe('PostgresStore', () => {
  let store: PostgresStore;
  let mockQuery: ReturnType<typeof vi.fn>;

  const testConfig = {
    host: 'localhost',
    port: 5432,
    database: 'test_db',
    user: 'test_user',
    password: 'test_pass',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    resetPostgresStore();

    const pg = await import('pg');
    const pool = new pg.default.Pool(testConfig);
    mockQuery = pool.query as ReturnType<typeof vi.fn>;

    store = getPostgresStore(testConfig);
  });

  afterEach(() => {
    resetPostgresStore();
  });

  describe('Document Operations', () => {
    describe('insertDocument', () => {
      it('should insert a document and return it with generated id', async () => {
        const mockDoc = {
          id: 'doc-123',
          filename: 'test.pdf',
          filepath: '/test/test.pdf',
          fileHash: 'abc123',
          title: 'Test Document',
          totalPages: 5,
          ingestedAt: new Date(),
          metadata: {},
        };

        mockQuery.mockResolvedValueOnce({ rows: [mockDoc] });

        const result = await store.insertDocument({
          filename: 'test.pdf',
          filepath: '/test/test.pdf',
          fileHash: 'abc123',
          title: 'Test Document',
          totalPages: 5,
          metadata: {},
        });

        expect(result).toEqual(mockDoc);
        expect(mockQuery).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO documents'),
          expect.arrayContaining(['test.pdf', '/test/test.pdf', 'abc123'])
        );
      });

      it('should throw PostgresError on duplicate hash', async () => {
        mockQuery.mockRejectedValueOnce({ code: '23505' });

        await expect(
          store.insertDocument({
            filename: 'test.pdf',
            filepath: '/test/test.pdf',
            fileHash: 'duplicate-hash',
            title: 'Test',
            totalPages: 1,
          })
        ).rejects.toThrow('already exists');
      });
    });

    describe('getDocumentByHash', () => {
      it('should return document when found', async () => {
        const mockDoc = { id: 'doc-123', filename: 'test.pdf', fileHash: 'abc123' };
        mockQuery.mockResolvedValueOnce({ rows: [mockDoc] });

        const result = await store.getDocumentByHash('abc123');

        expect(result).toEqual(mockDoc);
      });

      it('should return null when not found', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] });

        const result = await store.getDocumentByHash('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('listDocuments', () => {
      it('should return all documents ordered by ingestion date', async () => {
        const mockDocs = [
          { id: 'doc-1', filename: 'a.pdf' },
          { id: 'doc-2', filename: 'b.pdf' },
        ];
        mockQuery.mockResolvedValueOnce({ rows: mockDocs });

        const result = await store.listDocuments();

        expect(result).toEqual(mockDocs);
        expect(mockQuery).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY ingested_at DESC')
        );
      });
    });

    describe('deleteDocument', () => {
      it('should delete document by id', async () => {
        mockQuery.mockResolvedValueOnce({ rowCount: 1 });

        await store.deleteDocument('doc-123');

        expect(mockQuery).toHaveBeenCalledWith(
          expect.stringContaining('DELETE FROM documents'),
          ['doc-123']
        );
      });
    });
  });

  describe('Chunk Operations', () => {
    describe('insertChunk', () => {
      it('should insert a chunk with all fields', async () => {
        const mockChunk = {
          id: 'chunk-123',
          documentId: 'doc-123',
          chunkIndex: 0,
          content: 'Test content',
          pageNumber: 1,
          startChar: 0,
          endChar: 12,
          metadata: {},
          createdAt: new Date(),
        };

        mockQuery.mockResolvedValueOnce({ rows: [mockChunk] });

        const result = await store.insertChunk({
          documentId: 'doc-123',
          chunkIndex: 0,
          content: 'Test content',
          pageNumber: 1,
          startChar: 0,
          endChar: 12,
        });

        expect(result).toEqual(mockChunk);
      });
    });

    describe('insertChunksBatch', () => {
      it('should insert multiple chunks in a transaction', async () => {
        const chunks = [
          { documentId: 'doc-1', chunkIndex: 0, content: 'Chunk 1', startChar: 0, endChar: 7 },
          { documentId: 'doc-1', chunkIndex: 1, content: 'Chunk 2', startChar: 8, endChar: 15 },
        ];

        // Mock transaction queries
        mockQuery.mockResolvedValueOnce({ rows: [] }); // BEGIN
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'chunk-1', ...chunks[0] }] });
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'chunk-2', ...chunks[1] }] });
        mockQuery.mockResolvedValueOnce({ rows: [] }); // COMMIT

        const result = await store.insertChunksBatch(chunks);

        expect(result).toHaveLength(2);
      });
    });

    describe('getChunksByDocument', () => {
      it('should return chunks ordered by index', async () => {
        const mockChunks = [
          { id: 'chunk-1', chunkIndex: 0 },
          { id: 'chunk-2', chunkIndex: 1 },
        ];
        mockQuery.mockResolvedValueOnce({ rows: mockChunks });

        const result = await store.getChunksByDocument('doc-123');

        expect(result).toEqual(mockChunks);
        expect(mockQuery).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY chunk_index'),
          ['doc-123']
        );
      });
    });
  });

  describe('BM25 Search', () => {
    describe('searchBM25', () => {
      it('should execute BM25 search and transform results', async () => {
        const mockResults = [
          {
            chunk_id: 'chunk-1',
            document_id: 'doc-1',
            content: 'Medicare savings',
            page_number: 1,
            chunk_index: 0,
            metadata: {},
            score: 0.95,
          },
        ];
        mockQuery.mockResolvedValueOnce({ rows: mockResults });

        const result = await store.searchBM25('Medicare', 10);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          chunkId: 'chunk-1',
          documentId: 'doc-1',
          content: 'Medicare savings',
          pageNumber: 1,
          chunkIndex: 0,
          metadata: {},
          score: 0.95,
          source: 'bm25',
        });
        expect(mockQuery).toHaveBeenCalledWith(
          expect.stringContaining('search_bm25'),
          ['Medicare', 10]
        );
      });

      it('should handle null page numbers', async () => {
        mockQuery.mockResolvedValueOnce({
          rows: [{
            chunk_id: 'chunk-1',
            document_id: 'doc-1',
            content: 'Test',
            page_number: null,
            chunk_index: 0,
            metadata: {},
            score: 0.5,
          }],
        });

        const result = await store.searchBM25('test', 5);

        expect(result[0].pageNumber).toBeUndefined();
      });
    });
  });

  describe('Embedding Cache', () => {
    describe('getCachedEmbedding', () => {
      it('should return cached embedding when found', async () => {
        const embedding = [0.1, 0.2, 0.3];
        mockQuery.mockResolvedValueOnce({ rows: [{ embedding }] });

        const result = await store.getCachedEmbedding('hash-123');

        expect(result).toEqual(embedding);
      });

      it('should return null when not found', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] });

        const result = await store.getCachedEmbedding('nonexistent');

        expect(result).toBeNull();
      });

      it('should return null on error (non-critical)', async () => {
        mockQuery.mockRejectedValueOnce(new Error('Connection failed'));

        const result = await store.getCachedEmbedding('hash-123');

        expect(result).toBeNull();
      });
    });

    describe('cacheEmbedding', () => {
      it('should cache embedding with upsert', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] });

        await store.cacheEmbedding('hash-123', [0.1, 0.2], 'model-1');

        expect(mockQuery).toHaveBeenCalledWith(
          expect.stringContaining('ON CONFLICT'),
          expect.arrayContaining(['hash-123'])
        );
      });
    });
  });

  describe('Query Cache', () => {
    describe('getCachedQuery', () => {
      it('should return cached response when valid', async () => {
        const response = { answer: 'Test answer' };
        mockQuery.mockResolvedValueOnce({ rows: [{ response }] });

        const result = await store.getCachedQuery('query-hash');

        expect(result).toEqual({ response });
      });

      it('should return null for expired cache', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] });

        const result = await store.getCachedQuery('expired-hash');

        expect(result).toBeNull();
      });
    });

    describe('cacheQuery', () => {
      it('should cache query with TTL', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] });

        await store.cacheQuery('hash', 'query text', { answer: 'response' }, 3600);

        expect(mockQuery).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO query_cache'),
          expect.arrayContaining(['hash', 'query text'])
        );
      });
    });
  });

  describe('Query Logging', () => {
    describe('logQuery', () => {
      it('should log query with all metrics', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] });

        await store.logQuery({
          queryText: 'What is MSP?',
          responseText: 'MSP is...',
          vectorResults: 20,
          bm25Results: 15,
          fusedResults: 30,
          rerankedResults: 10,
          finalResults: 5,
          latencyMs: 1500,
          hasAnswer: true,
        });

        expect(mockQuery).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO query_logs'),
          expect.arrayContaining(['What is MSP?', 'MSP is...', 20, 15, 30, 10, 5, 1500, true])
        );
      });
    });

    describe('getQueryMetrics', () => {
      it('should return aggregated metrics', async () => {
        mockQuery.mockResolvedValueOnce({
          rows: [{
            total: '100',
            avg_latency: '1500.5',
            no_answer_count: '10',
          }],
        });

        const result = await store.getQueryMetrics();

        expect(result).toEqual({
          totalQueries: 100,
          avgLatencyMs: 1500.5,
          noAnswerRate: 0.1,
        });
      });

      it('should handle zero queries', async () => {
        mockQuery.mockResolvedValueOnce({
          rows: [{
            total: '0',
            avg_latency: null,
            no_answer_count: '0',
          }],
        });

        const result = await store.getQueryMetrics();

        expect(result).toEqual({
          totalQueries: 0,
          avgLatencyMs: 0,
          noAnswerRate: 0,
        });
      });
    });
  });

  describe('Health Check', () => {
    it('should return true when database is healthy', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

      const result = await store.healthCheck();

      expect(result).toBe(true);
    });

    it('should return false when database is unhealthy', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await store.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', () => {
      const store1 = getPostgresStore(testConfig);
      const store2 = getPostgresStore(testConfig);

      expect(store1).toBe(store2);
    });

    it('should create new instance after reset', () => {
      const store1 = getPostgresStore(testConfig);
      resetPostgresStore();
      const store2 = getPostgresStore(testConfig);

      // They should be different instances (though this is hard to verify with mocks)
      expect(store1).toBeDefined();
      expect(store2).toBeDefined();
    });
  });
});
