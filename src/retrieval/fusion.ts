import { SearchResult, FusedResult } from '../types/index.js';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('fusion');

/**
 * Reciprocal Rank Fusion (RRF) constant
 * Higher k means less emphasis on top ranks
 */
const RRF_K = 60;

/**
 * Fuse search results from multiple sources using RRF
 */
export function fuseResults(
  vectorResults: SearchResult[],
  bm25Results: SearchResult[],
  topK: number
): FusedResult[] {
  logger.debug(
    { vectorCount: vectorResults.length, bm25Count: bm25Results.length, topK },
    'Fusing results'
  );

  // Build a map of chunk ID to fused result
  const fusedMap = new Map<string, FusedResult>();

  // Process vector results
  for (let i = 0; i < vectorResults.length; i++) {
    const result = vectorResults[i];
    const rrfScore = 1 / (RRF_K + i + 1); // RRF formula

    if (fusedMap.has(result.chunkId)) {
      const existing = fusedMap.get(result.chunkId)!;
      existing.vectorScore = result.score;
      existing.rrfScore += rrfScore;
      existing.sources.push('vector');
    } else {
      fusedMap.set(result.chunkId, {
        chunkId: result.chunkId,
        documentId: result.documentId,
        content: result.content,
        pageNumber: result.pageNumber,
        chunkIndex: result.chunkIndex,
        metadata: result.metadata,
        score: result.score,
        vectorScore: result.score,
        bm25Score: undefined,
        rrfScore,
        sources: ['vector'],
      });
    }
  }

  // Process BM25 results
  for (let i = 0; i < bm25Results.length; i++) {
    const result = bm25Results[i];
    const rrfScore = 1 / (RRF_K + i + 1);

    if (fusedMap.has(result.chunkId)) {
      const existing = fusedMap.get(result.chunkId)!;
      existing.bm25Score = result.score;
      existing.rrfScore += rrfScore;
      if (!existing.sources.includes('bm25')) {
        existing.sources.push('bm25');
      }
    } else {
      fusedMap.set(result.chunkId, {
        chunkId: result.chunkId,
        documentId: result.documentId,
        content: result.content,
        pageNumber: result.pageNumber,
        chunkIndex: result.chunkIndex,
        metadata: result.metadata,
        score: result.score,
        vectorScore: undefined,
        bm25Score: result.score,
        rrfScore,
        sources: ['bm25'],
      });
    }
  }

  // Sort by RRF score and take top K
  const fusedResults = Array.from(fusedMap.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, topK);

  // Update the score field to be the RRF score
  for (const result of fusedResults) {
    result.score = result.rrfScore;
  }

  logger.debug(
    {
      totalUnique: fusedMap.size,
      returned: fusedResults.length,
      bothSources: fusedResults.filter((r) => r.sources.length === 2).length,
    },
    'Fusion complete'
  );

  return fusedResults;
}

/**
 * Calculate individual RRF score contribution
 */
export function calculateRRFScore(rank: number, k: number = RRF_K): number {
  return 1 / (k + rank + 1);
}

/**
 * Normalize scores within a result set to [0, 1]
 */
export function normalizeScores(results: SearchResult[]): SearchResult[] {
  if (results.length === 0) return results;

  const maxScore = Math.max(...results.map((r) => r.score));
  const minScore = Math.min(...results.map((r) => r.score));
  const range = maxScore - minScore;

  if (range === 0) {
    // All scores are the same
    return results.map((r) => ({ ...r, score: 1 }));
  }

  return results.map((r) => ({
    ...r,
    score: (r.score - minScore) / range,
  }));
}

/**
 * Deduplicate results by content similarity
 */
export function deduplicateResults(
  results: FusedResult[],
  similarityThreshold: number = 0.9
): FusedResult[] {
  const unique: FusedResult[] = [];

  for (const result of results) {
    const isDuplicate = unique.some(
      (u) => calculateContentSimilarity(u.content, result.content) > similarityThreshold
    );

    if (!isDuplicate) {
      unique.push(result);
    }
  }

  logger.debug(
    { original: results.length, unique: unique.length },
    'Deduplication complete'
  );

  return unique;
}

/**
 * Simple content similarity using Jaccard index on words
 */
function calculateContentSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));

  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);

  return intersection.size / union.size;
}
