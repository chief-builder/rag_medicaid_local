import {
  Config,
  SearchResult,
  FusedResult,
  RerankedResult,
  Citation,
  AnswerWithCitations,
  QueryResponse,
  ResponseFreshnessInfo,
} from '../types/index.js';
import { hashString } from '../utils/hash.js';
import { createChildLogger } from '../utils/logger.js';
import { LMStudioClient, getLMStudioClient } from '../clients/lm-studio.js';
import { QdrantStore, getQdrantStore } from '../clients/qdrant.js';
import { PostgresStore, getPostgresStore } from '../clients/postgres.js';
import { fuseResults, deduplicateResults } from './fusion.js';
import { Reranker, createReranker } from './reranker.js';
import { GuardrailsEngine, getGuardrailsEngine, GuardrailResult } from '../guardrails/index.js';
import {
  FreshnessDisplayService,
  getFreshnessDisplayService,
  DocumentMetadata,
} from '../freshness/index.js';
import { v4 as uuid } from 'uuid';

const logger = createChildLogger('retrieval-pipeline');

/**
 * Complete retrieval pipeline for answering queries
 */
export class RetrievalPipeline {
  private config: Config;
  private lmStudio: LMStudioClient;
  private qdrant: QdrantStore;
  private postgres: PostgresStore;
  private reranker: Reranker;
  private guardrails: GuardrailsEngine;
  private freshnessDisplay: FreshnessDisplayService;
  private documentMetadataCache: Map<string, DocumentMetadata> = new Map();
  private metadataCacheInitialized = false;

  constructor(config: Config) {
    this.config = config;
    this.lmStudio = getLMStudioClient(config.lmStudio);
    this.qdrant = getQdrantStore(config.qdrant);
    this.postgres = getPostgresStore(config.postgres);
    this.reranker = createReranker(this.lmStudio);
    this.guardrails = getGuardrailsEngine();
    this.freshnessDisplay = getFreshnessDisplayService();
  }

  /**
   * Process a query and return an answer with citations
   */
  async query(query: string, options?: { useCache?: boolean }): Promise<QueryResponse> {
    const startTime = Date.now();
    const queryId = uuid();

    logger.info({ queryId, query }, 'Processing query');

    // Check for sensitive topics (guardrails)
    const guardrailResult = await this.guardrails.checkQuery(query);
    if (guardrailResult.isSensitive) {
      logger.info(
        { queryId, category: guardrailResult.category },
        'Sensitive topic detected'
      );
    }

    // Check cache if enabled
    if (this.config.cache.enabled && options?.useCache !== false) {
      const cached = await this.checkCache(query);
      if (cached) {
        logger.info({ queryId }, 'Cache hit');
        // Apply guardrails to cached response too
        if (guardrailResult.disclaimerRequired) {
          return this.applyGuardrails(cached, guardrailResult);
        }
        return cached;
      }
    }

    // Step 1: Embed the query
    const queryEmbedding = await this.embedQuery(query);

    // Step 2: Retrieve from both sources in parallel
    const [vectorResults, bm25Results] = await Promise.all([
      this.retrieveVector(queryEmbedding),
      this.retrieveBM25(query),
    ]);

    // Step 3: Fuse results using RRF
    const fusedResults = fuseResults(
      vectorResults,
      bm25Results,
      this.config.rag.rerankTopN
    );

    // Step 4: Deduplicate
    const dedupedResults = deduplicateResults(fusedResults);

    // Step 5: Rerank
    const rerankedResults = await this.reranker.rerank(
      query,
      dedupedResults,
      this.config.rag.rerankTopN
    );

    // Step 6: Select final top chunks
    const finalResults = rerankedResults.slice(0, this.config.rag.finalTopC);

    // Step 7: Generate answer with citations
    const answerResult = await this.generateAnswer(query, finalResults);

    // Step 8: Generate freshness information
    await this.ensureMetadataCache();
    const freshnessInfo = this.freshnessDisplay.generateFreshnessInfo(
      answerResult.citations,
      this.documentMetadataCache
    );

    // Build response
    const latencyMs = Date.now() - startTime;
    let response: QueryResponse = {
      answer: answerResult.answer,
      citations: answerResult.citations,
      confidence: answerResult.confidence,
      queryId,
      latencyMs,
      retrievalStats: {
        vectorResults: vectorResults.length,
        bm25Results: bm25Results.length,
        fusedResults: fusedResults.length,
        rerankedResults: rerankedResults.length,
        finalResults: finalResults.length,
      },
      freshnessInfo: {
        lastRetrieved: freshnessInfo.lastRetrieved,
        lastRetrievedFormatted: freshnessInfo.lastRetrievedFormatted,
        effectivePeriod: freshnessInfo.effectivePeriod,
        incomeLimitsEffective: freshnessInfo.incomeLimitsEffective,
        hasStaleData: freshnessInfo.hasStaleData,
        warningCount: freshnessInfo.warnings.length,
      },
    };

    // Apply guardrails (add disclaimers for sensitive topics)
    if (guardrailResult.disclaimerRequired) {
      response = this.applyGuardrails(response, guardrailResult);
    }

    // Add freshness section to answer
    response = this.addFreshnessSection(response, freshnessInfo);

    // Cache the response (without guardrails, they'll be reapplied on retrieval)
    if (this.config.cache.enabled) {
      await this.cacheResponse(query, response);
    }

    // Log the query
    await this.logQuery(query, response);

    logger.info(
      { queryId, latencyMs, citationCount: response.citations.length },
      'Query complete'
    );

    return response;
  }

  /**
   * Embed the query text
   */
  private async embedQuery(query: string): Promise<number[]> {
    const contentHash = hashString(query);

    // Check embedding cache
    const cached = await this.postgres.getCachedEmbedding(contentHash);
    if (cached) {
      return cached;
    }

    const result = await this.lmStudio.embed(query);

    // Cache the embedding
    await this.postgres.cacheEmbedding(contentHash, result.embedding, result.model);

    return result.embedding;
  }

  /**
   * Retrieve from vector store
   */
  private async retrieveVector(queryEmbedding: number[]): Promise<SearchResult[]> {
    return this.qdrant.search(queryEmbedding, this.config.rag.vectorTopK);
  }

  /**
   * Retrieve using BM25
   */
  private async retrieveBM25(query: string): Promise<SearchResult[]> {
    return this.postgres.searchBM25(query, this.config.rag.bm25TopK);
  }

  /**
   * Generate answer with citations
   */
  private async generateAnswer(
    query: string,
    results: RerankedResult[]
  ): Promise<AnswerWithCitations> {
    if (results.length === 0) {
      return {
        answer:
          'I could not find any relevant information in the Medicaid documents to answer your question.',
        citations: [],
        confidence: 0,
        queryId: '',
      };
    }

    // Prepare contexts for the LLM
    const contexts = results.map((r, i) => ({
      index: i + 1,
      content: r.content,
      filename: (r.metadata.filename as string) || 'Unknown document',
      pageNumber: r.pageNumber,
    }));

    // Generate answer
    const { answer, citedIndices } = await this.lmStudio.generateAnswer(
      query,
      contexts
    );

    // Build citations
    const citations: Citation[] = citedIndices
      .filter((idx) => idx >= 1 && idx <= results.length)
      .map((idx) => {
        const result = results[idx - 1];
        return {
          chunkId: result.chunkId,
          documentId: result.documentId,
          filename: (result.metadata.filename as string) || 'Unknown',
          title: result.metadata.title as string | undefined,
          pageNumber: result.pageNumber,
          chunkIndex: result.chunkIndex,
          excerpt: result.content.substring(0, 200) + '...',
        };
      });

    // Calculate confidence based on rerank scores and citation count
    const avgRerankScore =
      results.reduce((sum, r) => sum + r.rerankScore, 0) / results.length;
    const citationRatio = citations.length / results.length;
    const confidence = Math.min(
      (avgRerankScore * 0.6 + citationRatio * 0.4) * 100,
      100
    );

    return {
      answer,
      citations,
      confidence,
      queryId: '',
    };
  }

  /**
   * Check cache for existing response
   */
  private async checkCache(query: string): Promise<QueryResponse | null> {
    const queryHash = hashString(query.toLowerCase().trim());
    const cached = await this.postgres.getCachedQuery(queryHash);

    if (cached) {
      return cached.response as unknown as QueryResponse;
    }

    return null;
  }

  /**
   * Cache the response
   */
  private async cacheResponse(query: string, response: QueryResponse): Promise<void> {
    const queryHash = hashString(query.toLowerCase().trim());
    await this.postgres.cacheQuery(
      queryHash,
      query,
      response as unknown as Record<string, unknown>,
      this.config.cache.ttlSeconds
    );
  }

  /**
   * Log query for metrics
   */
  private async logQuery(query: string, response: QueryResponse): Promise<void> {
    await this.postgres.logQuery({
      queryText: query,
      responseText: response.answer,
      vectorResults: response.retrievalStats.vectorResults,
      bm25Results: response.retrievalStats.bm25Results,
      fusedResults: response.retrievalStats.fusedResults,
      rerankedResults: response.retrievalStats.rerankedResults,
      finalResults: response.retrievalStats.finalResults,
      latencyMs: response.latencyMs,
      hasAnswer: response.citations.length > 0,
    });
  }

  /**
   * Get query metrics
   */
  async getMetrics(): Promise<{
    totalQueries: number;
    avgLatencyMs: number;
    noAnswerRate: number;
  }> {
    return this.postgres.getQueryMetrics();
  }

  /**
   * Ensure document metadata cache is initialized
   */
  private async ensureMetadataCache(): Promise<void> {
    if (this.metadataCacheInitialized) {
      return;
    }

    try {
      // Get system ingestion date
      const lastIngestionDate = await this.postgres.getLastIngestionDate();
      if (lastIngestionDate) {
        this.freshnessDisplay.setSystemIngestionDate(lastIngestionDate);
      }

      // Get document metadata
      const documents = await this.postgres.getDocumentsMetadata();
      for (const doc of documents) {
        this.documentMetadataCache.set(doc.id, {
          documentType: doc.documentType,
          effectiveDate: doc.effectiveDate,
        });
      }

      this.metadataCacheInitialized = true;
      logger.debug(
        { documentCount: documents.length },
        'Document metadata cache initialized'
      );
    } catch (error) {
      logger.error({ error }, 'Failed to initialize metadata cache');
      // Don't throw, freshness info is non-critical
    }
  }

  /**
   * Add freshness section to a response
   */
  private addFreshnessSection(
    response: QueryResponse,
    freshnessInfo: import('../freshness/index.js').SourceFreshnessInfo
  ): QueryResponse {
    // Format the freshness section
    const freshnessSection = this.freshnessDisplay.formatFreshnessSection(freshnessInfo);

    // Append to the answer
    return {
      ...response,
      answer: response.answer + '\n\n' + freshnessSection,
    };
  }

  /**
   * Apply guardrails to a response (add disclaimers for sensitive topics)
   */
  private applyGuardrails(
    response: QueryResponse,
    guardrailResult: GuardrailResult
  ): QueryResponse {
    if (!guardrailResult.disclaimerRequired || !guardrailResult.disclaimer) {
      return response;
    }

    // Append disclaimer to the answer
    let wrappedAnswer = response.answer;

    // Add disclaimer section
    wrappedAnswer += '\n\n---\n';
    wrappedAnswer += `**Important Notice:** ${guardrailResult.disclaimer}`;

    // Add referral if available
    if (guardrailResult.referral) {
      wrappedAnswer += `\n\n**For Professional Help:** ${guardrailResult.referral}`;
    }

    return {
      ...response,
      answer: wrappedAnswer,
    };
  }
}

/**
 * Create a retrieval pipeline
 */
export function createRetrievalPipeline(config: Config): RetrievalPipeline {
  return new RetrievalPipeline(config);
}
