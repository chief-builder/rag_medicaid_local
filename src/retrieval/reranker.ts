import { FusedResult, RerankedResult } from '../types/index.js';
import { LMStudioClient } from '../clients/lm-studio.js';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('reranker');

/**
 * Rerank fused results using LLM-based listwise reranking
 */
export class Reranker {
  private lmStudio: LMStudioClient;

  constructor(lmStudio: LMStudioClient) {
    this.lmStudio = lmStudio;
  }

  /**
   * Rerank results using listwise LLM reranking
   */
  async rerank(
    query: string,
    results: FusedResult[],
    topN: number
  ): Promise<RerankedResult[]> {
    if (results.length === 0) {
      return [];
    }

    if (results.length <= topN) {
      // No need to rerank, just add rerank scores
      return results.map((r, i) => ({
        ...r,
        rerankScore: 1 - i / results.length,
      }));
    }

    logger.debug(
      { query, resultCount: results.length, topN },
      'Starting listwise reranking'
    );

    try {
      // Prepare documents for reranking
      const documents = results.map((r) => ({
        id: r.chunkId,
        content: r.content,
      }));

      // Get reranked order from LLM
      const rerankedOrder = await this.lmStudio.rerankListwise(
        query,
        documents,
        topN
      );

      // Build result map for quick lookup
      const resultMap = new Map(results.map((r) => [r.chunkId, r]));

      // Create reranked results
      const rerankedResults: RerankedResult[] = [];

      for (const { id, score } of rerankedOrder) {
        const original = resultMap.get(id);
        if (original) {
          rerankedResults.push({
            ...original,
            rerankScore: score,
          });
        }
      }

      logger.debug(
        { rerankedCount: rerankedResults.length },
        'Reranking complete'
      );

      return rerankedResults;
    } catch (error) {
      logger.error({ error }, 'Reranking failed, returning original order');

      // Fallback: return top N with simple scores
      return results.slice(0, topN).map((r, i) => ({
        ...r,
        rerankScore: 1 - i / topN,
      }));
    }
  }

  /**
   * Simple fallback reranking based on RRF scores
   */
  simpleRerank(results: FusedResult[], topN: number): RerankedResult[] {
    return results.slice(0, topN).map((r) => ({
      ...r,
      rerankScore: r.rrfScore,
    }));
  }
}

/**
 * Create a reranker
 */
export function createReranker(lmStudio: LMStudioClient): Reranker {
  return new Reranker(lmStudio);
}
