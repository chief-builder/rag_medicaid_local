import { describe, it, expect } from 'vitest';
import {
  fuseResults,
  calculateRRFScore,
  normalizeScores,
  deduplicateResults,
} from './fusion.js';
import { SearchResult, FusedResult } from '../types/index.js';

describe('fuseResults', () => {
  const createSearchResult = (
    id: string,
    score: number,
    source: 'vector' | 'bm25'
  ): SearchResult => ({
    chunkId: id,
    documentId: 'doc-1',
    content: `Content for ${id}`,
    chunkIndex: parseInt(id.split('-')[1]),
    metadata: {},
    score,
    source,
  });

  it('should fuse results from both sources', () => {
    const vectorResults: SearchResult[] = [
      createSearchResult('chunk-1', 0.9, 'vector'),
      createSearchResult('chunk-2', 0.8, 'vector'),
      createSearchResult('chunk-3', 0.7, 'vector'),
    ];

    const bm25Results: SearchResult[] = [
      createSearchResult('chunk-2', 5.0, 'bm25'),
      createSearchResult('chunk-4', 4.0, 'bm25'),
      createSearchResult('chunk-1', 3.0, 'bm25'),
    ];

    const fused = fuseResults(vectorResults, bm25Results, 10);

    expect(fused.length).toBe(4); // 4 unique chunks

    // chunk-2 and chunk-1 appear in both, should have higher RRF scores
    const chunk2 = fused.find((f) => f.chunkId === 'chunk-2');
    const chunk3 = fused.find((f) => f.chunkId === 'chunk-3');

    expect(chunk2).toBeDefined();
    expect(chunk3).toBeDefined();
    expect(chunk2!.rrfScore).toBeGreaterThan(chunk3!.rrfScore);
  });

  it('should mark sources correctly', () => {
    const vectorResults: SearchResult[] = [
      createSearchResult('chunk-1', 0.9, 'vector'),
      createSearchResult('chunk-2', 0.8, 'vector'),
    ];

    const bm25Results: SearchResult[] = [
      createSearchResult('chunk-2', 5.0, 'bm25'),
      createSearchResult('chunk-3', 4.0, 'bm25'),
    ];

    const fused = fuseResults(vectorResults, bm25Results, 10);

    const chunk1 = fused.find((f) => f.chunkId === 'chunk-1');
    const chunk2 = fused.find((f) => f.chunkId === 'chunk-2');
    const chunk3 = fused.find((f) => f.chunkId === 'chunk-3');

    expect(chunk1!.sources).toContain('vector');
    expect(chunk1!.sources).not.toContain('bm25');

    expect(chunk2!.sources).toContain('vector');
    expect(chunk2!.sources).toContain('bm25');

    expect(chunk3!.sources).toContain('bm25');
    expect(chunk3!.sources).not.toContain('vector');
  });

  it('should respect topK limit', () => {
    const vectorResults: SearchResult[] = Array.from({ length: 20 }, (_, i) =>
      createSearchResult(`chunk-v-${i}`, 1 - i * 0.05, 'vector')
    );

    const bm25Results: SearchResult[] = Array.from({ length: 20 }, (_, i) =>
      createSearchResult(`chunk-b-${i}`, 20 - i, 'bm25')
    );

    const fused = fuseResults(vectorResults, bm25Results, 5);

    expect(fused.length).toBe(5);
  });

  it('should handle empty vector results', () => {
    const bm25Results: SearchResult[] = [
      createSearchResult('chunk-1', 5.0, 'bm25'),
      createSearchResult('chunk-2', 4.0, 'bm25'),
    ];

    const fused = fuseResults([], bm25Results, 10);

    expect(fused.length).toBe(2);
    expect(fused[0].sources).toEqual(['bm25']);
  });

  it('should handle empty BM25 results', () => {
    const vectorResults: SearchResult[] = [
      createSearchResult('chunk-1', 0.9, 'vector'),
      createSearchResult('chunk-2', 0.8, 'vector'),
    ];

    const fused = fuseResults(vectorResults, [], 10);

    expect(fused.length).toBe(2);
    expect(fused[0].sources).toEqual(['vector']);
  });

  it('should handle both empty results', () => {
    const fused = fuseResults([], [], 10);
    expect(fused.length).toBe(0);
  });

  it('should sort by RRF score descending', () => {
    const vectorResults: SearchResult[] = [
      createSearchResult('chunk-3', 0.9, 'vector'),
      createSearchResult('chunk-1', 0.8, 'vector'),
    ];

    const bm25Results: SearchResult[] = [
      createSearchResult('chunk-1', 5.0, 'bm25'),
      createSearchResult('chunk-2', 4.0, 'bm25'),
    ];

    const fused = fuseResults(vectorResults, bm25Results, 10);

    // Results should be sorted by RRF score
    for (let i = 0; i < fused.length - 1; i++) {
      expect(fused[i].rrfScore).toBeGreaterThanOrEqual(fused[i + 1].rrfScore);
    }
  });

  it('should preserve vector and BM25 scores', () => {
    const vectorResults: SearchResult[] = [
      createSearchResult('chunk-1', 0.95, 'vector'),
    ];

    const bm25Results: SearchResult[] = [
      createSearchResult('chunk-1', 7.5, 'bm25'),
    ];

    const fused = fuseResults(vectorResults, bm25Results, 10);

    expect(fused[0].vectorScore).toBe(0.95);
    expect(fused[0].bm25Score).toBe(7.5);
  });
});

describe('calculateRRFScore', () => {
  it('should calculate RRF score correctly', () => {
    // For k=60, rank 0: 1/(60+0+1) = 1/61 ≈ 0.0164
    const score = calculateRRFScore(0, 60);
    expect(score).toBeCloseTo(1 / 61, 4);
  });

  it('should decrease with higher rank', () => {
    const score0 = calculateRRFScore(0);
    const score1 = calculateRRFScore(1);
    const score10 = calculateRRFScore(10);

    expect(score0).toBeGreaterThan(score1);
    expect(score1).toBeGreaterThan(score10);
  });

  it('should use default k value', () => {
    const score = calculateRRFScore(0);
    expect(score).toBeCloseTo(1 / 61, 4); // Default k=60
  });
});

describe('normalizeScores', () => {
  it('should normalize scores to [0, 1] range', () => {
    const results: SearchResult[] = [
      { chunkId: 'a', documentId: 'd1', content: 'a', chunkIndex: 0, metadata: {}, score: 100, source: 'vector' },
      { chunkId: 'b', documentId: 'd1', content: 'b', chunkIndex: 1, metadata: {}, score: 50, source: 'vector' },
      { chunkId: 'c', documentId: 'd1', content: 'c', chunkIndex: 2, metadata: {}, score: 0, source: 'vector' },
    ];

    const normalized = normalizeScores(results);

    expect(normalized[0].score).toBe(1);
    expect(normalized[1].score).toBe(0.5);
    expect(normalized[2].score).toBe(0);
  });

  it('should handle single result', () => {
    const results: SearchResult[] = [
      { chunkId: 'a', documentId: 'd1', content: 'a', chunkIndex: 0, metadata: {}, score: 50, source: 'vector' },
    ];

    const normalized = normalizeScores(results);

    expect(normalized[0].score).toBe(1);
  });

  it('should handle all same scores', () => {
    const results: SearchResult[] = [
      { chunkId: 'a', documentId: 'd1', content: 'a', chunkIndex: 0, metadata: {}, score: 50, source: 'vector' },
      { chunkId: 'b', documentId: 'd1', content: 'b', chunkIndex: 1, metadata: {}, score: 50, source: 'vector' },
    ];

    const normalized = normalizeScores(results);

    expect(normalized[0].score).toBe(1);
    expect(normalized[1].score).toBe(1);
  });

  it('should handle empty results', () => {
    const normalized = normalizeScores([]);
    expect(normalized.length).toBe(0);
  });
});

describe('deduplicateResults', () => {
  const createFusedResult = (id: string, content: string): FusedResult => ({
    chunkId: id,
    documentId: 'doc-1',
    content,
    chunkIndex: 0,
    metadata: {},
    score: 1,
    rrfScore: 1,
    sources: ['vector'],
  });

  it('should remove near-duplicate content', () => {
    const results: FusedResult[] = [
      createFusedResult('1', 'The quick brown fox jumps over the lazy dog'),
      createFusedResult('2', 'The quick brown fox jumps over the lazy cat'),
      createFusedResult('3', 'A completely different sentence about something else'),
    ];

    const deduped = deduplicateResults(results, 0.7);

    expect(deduped.length).toBe(2);
    expect(deduped[0].chunkId).toBe('1');
    expect(deduped[1].chunkId).toBe('3');
  });

  it('should keep all unique content', () => {
    const results: FusedResult[] = [
      createFusedResult('1', 'First unique sentence about topic A'),
      createFusedResult('2', 'Second unique sentence about topic B'),
      createFusedResult('3', 'Third unique sentence about topic C'),
    ];

    const deduped = deduplicateResults(results, 0.9);

    expect(deduped.length).toBe(3);
  });

  it('should handle empty results', () => {
    const deduped = deduplicateResults([], 0.9);
    expect(deduped.length).toBe(0);
  });

  it('should keep first occurrence of duplicates', () => {
    const results: FusedResult[] = [
      createFusedResult('1', 'This is the exact same content'),
      createFusedResult('2', 'This is the exact same content'),
      createFusedResult('3', 'This is the exact same content'),
    ];

    const deduped = deduplicateResults(results, 0.9);

    expect(deduped.length).toBe(1);
    expect(deduped[0].chunkId).toBe('1');
  });
});
