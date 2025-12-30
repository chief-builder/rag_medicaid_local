import { vi } from 'vitest';
import type { SearchResult, ChunkMetadata } from '../../src/types/index.js';

export interface QdrantPayload {
  chunkId: string;
  documentId: string;
  content: string;
  pageNumber?: number;
  chunkIndex: number;
  metadata: ChunkMetadata;
  [key: string]: unknown;
}

export interface QdrantPoint {
  id: string;
  vector: number[];
  payload: QdrantPayload;
}

/**
 * Mock Qdrant store for testing without actual vector database
 */
export interface MockQdrantOptions {
  points?: QdrantPoint[];
  embeddingDimension?: number;
  collectionExists?: boolean;
}

export function createMockQdrantStore(options: MockQdrantOptions = {}) {
  const {
    points = [],
    embeddingDimension = 768,
    collectionExists = true,
  } = options;

  // Internal state
  const storedPoints: QdrantPoint[] = [...points];
  let initialized = collectionExists;

  /**
   * Calculate cosine similarity between two vectors
   */
  function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  return {
    initialize: vi.fn().mockImplementation(async (): Promise<void> => {
      initialized = true;
    }),

    upsert: vi.fn().mockImplementation(async (
      id: string,
      vector: number[],
      payload: QdrantPayload
    ): Promise<void> => {
      // Remove existing point with same ID
      const existingIndex = storedPoints.findIndex(p => p.id === id);
      if (existingIndex >= 0) {
        storedPoints.splice(existingIndex, 1);
      }
      storedPoints.push({ id, vector, payload });
    }),

    upsertBatch: vi.fn().mockImplementation(async (
      pointsToInsert: QdrantPoint[]
    ): Promise<void> => {
      for (const point of pointsToInsert) {
        const existingIndex = storedPoints.findIndex(p => p.id === point.id);
        if (existingIndex >= 0) {
          storedPoints.splice(existingIndex, 1);
        }
        storedPoints.push(point);
      }
    }),

    search: vi.fn().mockImplementation(async (
      queryVector: number[],
      topK: number,
      filter?: { documentId?: string }
    ): Promise<SearchResult[]> => {
      let candidates = storedPoints;

      // Apply document filter if provided
      if (filter?.documentId) {
        candidates = candidates.filter(p => p.payload.documentId === filter.documentId);
      }

      // Calculate similarity scores
      const scored = candidates.map(point => ({
        ...point,
        score: cosineSimilarity(queryVector, point.vector),
      }));

      // Sort by score and take top K
      return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .map(point => ({
          chunkId: point.payload.chunkId,
          documentId: point.payload.documentId,
          content: point.payload.content,
          pageNumber: point.payload.pageNumber,
          chunkIndex: point.payload.chunkIndex,
          metadata: point.payload.metadata,
          score: point.score,
          source: 'vector' as const,
        }));
    }),

    deleteByDocument: vi.fn().mockImplementation(async (documentId: string): Promise<void> => {
      const toRemove = storedPoints.filter(p => p.payload.documentId === documentId);
      for (const point of toRemove) {
        const index = storedPoints.indexOf(point);
        if (index >= 0) {
          storedPoints.splice(index, 1);
        }
      }
    }),

    getCollectionInfo: vi.fn().mockImplementation(async () => {
      return {
        vectorCount: storedPoints.length,
        status: initialized ? 'green' : 'not_created',
      };
    }),

    healthCheck: vi.fn().mockResolvedValue(true),

    // Test helpers
    _getStoredPoints: () => storedPoints,
    _isInitialized: () => initialized,
    _getEmbeddingDimension: () => embeddingDimension,
  };
}

/**
 * Create a mock store with pre-populated vectors for testing
 */
export function createPopulatedMockQdrantStore() {
  // Generate deterministic embeddings based on content
  function generateEmbedding(content: string, dimension: number = 768): number[] {
    const embedding = new Array(dimension).fill(0).map((_, i) => {
      const charSum = content.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
      return Math.sin(charSum * (i + 1) * 0.001) * 0.5;
    });
    return embedding;
  }

  const points: QdrantPoint[] = [
    {
      id: 'vec-001',
      vector: generateEmbedding('Medicare Savings Programs MSP help pay Medicare costs limited income'),
      payload: {
        chunkId: 'chunk-001',
        documentId: 'doc-001',
        content: 'Medicare Savings Programs (MSPs) help pay Medicare costs for people with limited income.',
        pageNumber: 1,
        chunkIndex: 0,
        metadata: { filename: 'msp-guide.pdf', title: 'MSP Guide' },
      },
    },
    {
      id: 'vec-002',
      vector: generateEmbedding('QMB Part A Part B premiums deductibles coinsurance income limit FPL'),
      payload: {
        chunkId: 'chunk-002',
        documentId: 'doc-001',
        content: 'QMB pays Part A and Part B premiums, deductibles, and coinsurance. Income limit: 100% FPL.',
        pageNumber: 1,
        chunkIndex: 1,
        metadata: { filename: 'msp-guide.pdf', title: 'MSP Guide' },
      },
    },
    {
      id: 'vec-003',
      vector: generateEmbedding('Long-term care Medicaid nursing home care community-based services'),
      payload: {
        chunkId: 'chunk-003',
        documentId: 'doc-002',
        content: 'Long-term care Medicaid helps pay for nursing home care and community-based services.',
        pageNumber: 1,
        chunkIndex: 0,
        metadata: { filename: 'ltc-info.pdf', title: 'LTC Info' },
      },
    },
    {
      id: 'vec-004',
      vector: generateEmbedding('estate recovery Medicaid recipient assets reimbursement state'),
      payload: {
        chunkId: 'chunk-004',
        documentId: 'doc-003',
        content: 'Estate recovery allows the state to seek reimbursement from a Medicaid recipient\'s estate after death.',
        pageNumber: 2,
        chunkIndex: 0,
        metadata: { filename: 'estate-recovery.pdf', title: 'Estate Recovery FAQ' },
      },
    },
  ];

  return createMockQdrantStore({ points });
}

export type MockQdrantStore = ReturnType<typeof createMockQdrantStore>;
