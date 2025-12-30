import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QdrantStore, getQdrantStore, resetQdrantStore } from './qdrant.js';

// Mock Qdrant client
const mockGetCollections = vi.fn();
const mockCreateCollection = vi.fn();
const mockCreatePayloadIndex = vi.fn();
const mockUpsert = vi.fn();
const mockSearch = vi.fn();
const mockDelete = vi.fn();
const mockGetCollection = vi.fn();

vi.mock('@qdrant/js-client-rest', () => ({
  QdrantClient: vi.fn().mockImplementation(() => ({
    getCollections: mockGetCollections,
    createCollection: mockCreateCollection,
    createPayloadIndex: mockCreatePayloadIndex,
    upsert: mockUpsert,
    search: mockSearch,
    delete: mockDelete,
    getCollection: mockGetCollection,
  })),
}));

describe('QdrantStore', () => {
  let store: QdrantStore;

  const testConfig = {
    url: 'http://localhost:6333',
    collection: 'test_collection',
    embeddingDimension: 768,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetQdrantStore();
    store = getQdrantStore(testConfig);
  });

  afterEach(() => {
    resetQdrantStore();
  });

  describe('initialize', () => {
    it('should create collection if it does not exist', async () => {
      mockGetCollections.mockResolvedValueOnce({ collections: [] });
      mockCreateCollection.mockResolvedValueOnce({});
      mockCreatePayloadIndex.mockResolvedValue({});

      await store.initialize();

      expect(mockGetCollections).toHaveBeenCalled();
      expect(mockCreateCollection).toHaveBeenCalledWith('test_collection', {
        vectors: {
          size: 768,
          distance: 'Cosine',
        },
        optimizers_config: {
          default_segment_number: 2,
        },
        replication_factor: 1,
      });
      expect(mockCreatePayloadIndex).toHaveBeenCalledTimes(2);
    });

    it('should not create collection if it already exists', async () => {
      mockGetCollections.mockResolvedValueOnce({
        collections: [{ name: 'test_collection' }],
      });

      await store.initialize();

      expect(mockCreateCollection).not.toHaveBeenCalled();
    });

    it('should throw QdrantError on failure', async () => {
      mockGetCollections.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(store.initialize()).rejects.toThrow('Failed to initialize Qdrant collection');
    });
  });

  describe('upsert', () => {
    it('should upsert a single vector with payload', async () => {
      mockUpsert.mockResolvedValueOnce({});

      const payload = {
        chunkId: 'chunk-1',
        documentId: 'doc-1',
        content: 'Test content',
        pageNumber: 1,
        chunkIndex: 0,
        metadata: { filename: 'test.pdf' },
      };

      await store.upsert('vec-1', new Array(768).fill(0.1), payload);

      expect(mockUpsert).toHaveBeenCalledWith('test_collection', {
        wait: true,
        points: [
          {
            id: 'vec-1',
            vector: expect.any(Array),
            payload,
          },
        ],
      });
    });

    it('should throw QdrantError on failure', async () => {
      mockUpsert.mockRejectedValueOnce(new Error('Upsert failed'));

      await expect(
        store.upsert('vec-1', [0.1], { chunkId: 'c1', documentId: 'd1', content: 'test', chunkIndex: 0, metadata: {} })
      ).rejects.toThrow('Failed to upsert vector');
    });
  });

  describe('upsertBatch', () => {
    it('should batch upsert vectors in groups of 100', async () => {
      mockUpsert.mockResolvedValue({});

      const points = Array.from({ length: 150 }, (_, i) => ({
        id: `vec-${i}`,
        vector: new Array(768).fill(0.1),
        payload: {
          chunkId: `chunk-${i}`,
          documentId: 'doc-1',
          content: `Content ${i}`,
          chunkIndex: i,
          metadata: {},
        },
      }));

      await store.upsertBatch(points);

      // Should be called twice: once for 100, once for 50
      expect(mockUpsert).toHaveBeenCalledTimes(2);
    });

    it('should handle empty batch', async () => {
      await store.upsertBatch([]);

      expect(mockUpsert).not.toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('should search vectors and transform results', async () => {
      mockSearch.mockResolvedValueOnce([
        {
          id: 'vec-1',
          score: 0.95,
          payload: {
            chunkId: 'chunk-1',
            documentId: 'doc-1',
            content: 'Medicare savings programs',
            pageNumber: 1,
            chunkIndex: 0,
            metadata: { filename: 'msp.pdf' },
          },
        },
        {
          id: 'vec-2',
          score: 0.87,
          payload: {
            chunkId: 'chunk-2',
            documentId: 'doc-1',
            content: 'QMB eligibility',
            pageNumber: 2,
            chunkIndex: 1,
            metadata: { filename: 'msp.pdf' },
          },
        },
      ]);

      const queryVector = new Array(768).fill(0.1);
      const results = await store.search(queryVector, 10);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        chunkId: 'chunk-1',
        documentId: 'doc-1',
        content: 'Medicare savings programs',
        pageNumber: 1,
        chunkIndex: 0,
        metadata: { filename: 'msp.pdf' },
        score: 0.95,
        source: 'vector',
      });
      expect(mockSearch).toHaveBeenCalledWith('test_collection', {
        vector: queryVector,
        limit: 10,
        with_payload: true,
      });
    });

    it('should apply document filter when provided', async () => {
      mockSearch.mockResolvedValueOnce([]);

      const queryVector = new Array(768).fill(0.1);
      await store.search(queryVector, 5, { documentId: 'doc-specific' });

      expect(mockSearch).toHaveBeenCalledWith('test_collection', {
        vector: queryVector,
        limit: 5,
        with_payload: true,
        filter: {
          must: [
            {
              key: 'documentId',
              match: { value: 'doc-specific' },
            },
          ],
        },
      });
    });

    it('should handle empty results', async () => {
      mockSearch.mockResolvedValueOnce([]);

      const results = await store.search(new Array(768).fill(0), 10);

      expect(results).toEqual([]);
    });

    it('should throw QdrantError on failure', async () => {
      mockSearch.mockRejectedValueOnce(new Error('Search failed'));

      await expect(
        store.search(new Array(768).fill(0), 10)
      ).rejects.toThrow('Failed to search vectors');
    });
  });

  describe('deleteByDocument', () => {
    it('should delete all vectors for a document', async () => {
      mockDelete.mockResolvedValueOnce({});

      await store.deleteByDocument('doc-123');

      expect(mockDelete).toHaveBeenCalledWith('test_collection', {
        filter: {
          must: [
            {
              key: 'documentId',
              match: { value: 'doc-123' },
            },
          ],
        },
      });
    });

    it('should throw QdrantError on failure', async () => {
      mockDelete.mockRejectedValueOnce(new Error('Delete failed'));

      await expect(store.deleteByDocument('doc-123')).rejects.toThrow('Failed to delete vectors');
    });
  });

  describe('getCollectionInfo', () => {
    it('should return collection info', async () => {
      mockGetCollection.mockResolvedValueOnce({
        points_count: 1500,
        status: 'green',
      });

      const info = await store.getCollectionInfo();

      expect(info).toEqual({
        vectorCount: 1500,
        status: 'green',
      });
    });

    it('should return default values for non-existent collection', async () => {
      const error = new Error('Not found');
      (error as { status?: number }).status = 404;
      mockGetCollection.mockRejectedValueOnce(error);

      const info = await store.getCollectionInfo();

      expect(info).toEqual({
        vectorCount: 0,
        status: 'not_created',
      });
    });

    it('should handle zero vectors', async () => {
      mockGetCollection.mockResolvedValueOnce({
        points_count: 0,
        status: 'green',
      });

      const info = await store.getCollectionInfo();

      expect(info.vectorCount).toBe(0);
    });
  });

  describe('healthCheck', () => {
    it('should return true when Qdrant is healthy', async () => {
      mockGetCollections.mockResolvedValueOnce({ collections: [] });

      const result = await store.healthCheck();

      expect(result).toBe(true);
    });

    it('should return false when Qdrant is unhealthy', async () => {
      mockGetCollections.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await store.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', () => {
      const store1 = getQdrantStore(testConfig);
      const store2 = getQdrantStore(testConfig);

      expect(store1).toBe(store2);
    });

    it('should create new instance after reset', () => {
      const store1 = getQdrantStore(testConfig);
      resetQdrantStore();
      const store2 = getQdrantStore(testConfig);

      expect(store1).toBeDefined();
      expect(store2).toBeDefined();
    });
  });
});
