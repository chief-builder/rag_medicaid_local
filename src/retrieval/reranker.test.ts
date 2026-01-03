import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Reranker, createReranker } from './reranker.js';
import { FusedResult, RerankedResult } from '../types/index.js';
import { LMStudioClient } from '../clients/lm-studio.js';

// Mock LMStudioClient
const createMockLMStudio = (): LMStudioClient => ({
  healthCheck: vi.fn(),
  embed: vi.fn(),
  generateAnswer: vi.fn(),
  rerankListwise: vi.fn(),
} as unknown as LMStudioClient);

// Helper to create test fused results
function createFusedResult(
  id: string,
  content: string,
  rrfScore: number
): FusedResult {
  return {
    chunkId: id,
    documentId: 'doc-1',
    content,
    chunkIndex: parseInt(id.split('-')[1]) || 0,
    metadata: {},
    score: rrfScore,
    rrfScore,
    sources: ['vector', 'bm25'],
  };
}

describe('Reranker', () => {
  let mockLMStudio: LMStudioClient;
  let reranker: Reranker;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLMStudio = createMockLMStudio();
    reranker = new Reranker(mockLMStudio);
  });

  describe('rerank', () => {
    it('should return empty array for empty input', async () => {
      const result = await reranker.rerank('test query', [], 10);
      expect(result).toEqual([]);
      expect(mockLMStudio.rerankListwise).not.toHaveBeenCalled();
    });

    it('should skip LLM reranking when results <= topN', async () => {
      const results: FusedResult[] = [
        createFusedResult('chunk-1', 'Content 1', 0.9),
        createFusedResult('chunk-2', 'Content 2', 0.8),
        createFusedResult('chunk-3', 'Content 3', 0.7),
      ];

      const reranked = await reranker.rerank('test query', results, 5);

      expect(mockLMStudio.rerankListwise).not.toHaveBeenCalled();
      expect(reranked.length).toBe(3);

      // Should add rerank scores based on position
      expect(reranked[0].rerankScore).toBeCloseTo(1, 1);
      expect(reranked[1].rerankScore).toBeCloseTo(0.67, 1);
      expect(reranked[2].rerankScore).toBeCloseTo(0.33, 1);
    });

    it('should call LLM reranking when results > topN', async () => {
      const results: FusedResult[] = [
        createFusedResult('chunk-1', 'Content about QMB limits', 0.9),
        createFusedResult('chunk-2', 'Content about SLMB', 0.8),
        createFusedResult('chunk-3', 'Content about nursing homes', 0.7),
        createFusedResult('chunk-4', 'Content about estate recovery', 0.6),
        createFusedResult('chunk-5', 'Content about appeals', 0.5),
      ];

      // Mock LLM reranking response
      vi.mocked(mockLMStudio.rerankListwise).mockResolvedValue([
        { id: 'chunk-2', score: 0.95 },
        { id: 'chunk-1', score: 0.85 },
        { id: 'chunk-4', score: 0.75 },
      ]);

      const reranked = await reranker.rerank('QMB income limits', results, 3);

      expect(mockLMStudio.rerankListwise).toHaveBeenCalledWith(
        'QMB income limits',
        expect.arrayContaining([
          expect.objectContaining({ id: 'chunk-1', content: 'Content about QMB limits' }),
        ]),
        3
      );

      expect(reranked.length).toBe(3);
      expect(reranked[0].chunkId).toBe('chunk-2');
      expect(reranked[0].rerankScore).toBe(0.95);
      expect(reranked[1].chunkId).toBe('chunk-1');
      expect(reranked[2].chunkId).toBe('chunk-4');
    });

    it('should preserve original result properties', async () => {
      const results: FusedResult[] = [
        {
          chunkId: 'chunk-1',
          documentId: 'doc-123',
          content: 'Test content',
          chunkIndex: 5,
          metadata: { filename: 'test.pdf', title: 'Test Doc' },
          score: 0.9,
          rrfScore: 0.85,
          vectorScore: 0.9,
          bm25Score: 4.5,
          sources: ['vector', 'bm25'],
        },
      ];

      const reranked = await reranker.rerank('query', results, 5);

      expect(reranked[0].documentId).toBe('doc-123');
      expect(reranked[0].content).toBe('Test content');
      expect(reranked[0].chunkIndex).toBe(5);
      expect(reranked[0].metadata).toEqual({ filename: 'test.pdf', title: 'Test Doc' });
      expect(reranked[0].rrfScore).toBe(0.85);
      expect(reranked[0].vectorScore).toBe(0.9);
      expect(reranked[0].bm25Score).toBe(4.5);
    });

    it('should handle LLM reranking failure gracefully', async () => {
      const results: FusedResult[] = [
        createFusedResult('chunk-1', 'Content 1', 0.9),
        createFusedResult('chunk-2', 'Content 2', 0.8),
        createFusedResult('chunk-3', 'Content 3', 0.7),
        createFusedResult('chunk-4', 'Content 4', 0.6),
        createFusedResult('chunk-5', 'Content 5', 0.5),
      ];

      vi.mocked(mockLMStudio.rerankListwise).mockRejectedValue(
        new Error('LLM service unavailable')
      );

      // Should not throw, fallback to simple ranking
      const reranked = await reranker.rerank('test query', results, 3);

      expect(reranked.length).toBe(3);
      // Fallback returns first topN with simple scores
      expect(reranked[0].chunkId).toBe('chunk-1');
      expect(reranked[1].chunkId).toBe('chunk-2');
      expect(reranked[2].chunkId).toBe('chunk-3');
    });

    it('should handle missing chunks in LLM response', async () => {
      const results: FusedResult[] = [
        createFusedResult('chunk-1', 'Content 1', 0.9),
        createFusedResult('chunk-2', 'Content 2', 0.8),
        createFusedResult('chunk-3', 'Content 3', 0.7),
        createFusedResult('chunk-4', 'Content 4', 0.6),
      ];

      // LLM returns a chunk that doesn't exist
      vi.mocked(mockLMStudio.rerankListwise).mockResolvedValue([
        { id: 'chunk-1', score: 0.95 },
        { id: 'chunk-nonexistent', score: 0.85 }, // This doesn't exist
        { id: 'chunk-3', score: 0.75 },
      ]);

      const reranked = await reranker.rerank('query', results, 3);

      // Should only include existing chunks
      expect(reranked.length).toBe(2);
      expect(reranked.map((r) => r.chunkId)).toContain('chunk-1');
      expect(reranked.map((r) => r.chunkId)).toContain('chunk-3');
      expect(reranked.map((r) => r.chunkId)).not.toContain('chunk-nonexistent');
    });
  });

  describe('simpleRerank', () => {
    it('should return top N results with RRF scores as rerank scores', () => {
      const results: FusedResult[] = [
        createFusedResult('chunk-1', 'Content 1', 0.9),
        createFusedResult('chunk-2', 'Content 2', 0.8),
        createFusedResult('chunk-3', 'Content 3', 0.7),
        createFusedResult('chunk-4', 'Content 4', 0.6),
      ];

      const reranked = reranker.simpleRerank(results, 2);

      expect(reranked.length).toBe(2);
      expect(reranked[0].chunkId).toBe('chunk-1');
      expect(reranked[0].rerankScore).toBe(0.9); // Uses rrfScore
      expect(reranked[1].chunkId).toBe('chunk-2');
      expect(reranked[1].rerankScore).toBe(0.8);
    });

    it('should handle topN greater than results length', () => {
      const results: FusedResult[] = [
        createFusedResult('chunk-1', 'Content 1', 0.9),
        createFusedResult('chunk-2', 'Content 2', 0.8),
      ];

      const reranked = reranker.simpleRerank(results, 10);

      expect(reranked.length).toBe(2);
    });

    it('should handle empty results', () => {
      const reranked = reranker.simpleRerank([], 5);
      expect(reranked.length).toBe(0);
    });
  });
});

describe('createReranker', () => {
  it('should create a Reranker instance', () => {
    const mockLMStudio = createMockLMStudio();
    const reranker = createReranker(mockLMStudio);

    expect(reranker).toBeInstanceOf(Reranker);
  });
});
