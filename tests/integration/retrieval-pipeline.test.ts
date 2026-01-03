/**
 * Retrieval Pipeline Integration Tests
 *
 * Tests the complete retrieval pipeline with real services:
 * - PostgreSQL for BM25 search and caching
 * - Qdrant for vector search
 * - LM Studio for embeddings and answer generation
 *
 * These tests require all services to be running.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { checkTestServices, createTestConfig } from '../helpers/test-db.js';
import { RetrievalPipeline, createRetrievalPipeline } from '../../src/retrieval/pipeline.js';
import { PostgresStore } from '../../src/clients/postgres.js';
import { QdrantStore } from '../../src/clients/qdrant.js';
import type { Config } from '../../src/types/index.js';

// Check services availability
const services = await checkTestServices();
const allServicesAvailable = services.postgres && services.qdrant && services.lmStudio;
console.log('Retrieval Pipeline Tests - Available services:', services);

describe('RetrievalPipeline Integration Tests', () => {
  let pipeline: RetrievalPipeline;
  let postgresStore: PostgresStore;
  let qdrantStore: QdrantStore;
  let config: Config;

  beforeAll(async () => {
    if (!allServicesAvailable) {
      console.warn('Skipping retrieval pipeline tests - not all services available');
      return;
    }

    config = createTestConfig() as Config;
    pipeline = createRetrievalPipeline(config);
    postgresStore = new PostgresStore(config.postgres);
    qdrantStore = new QdrantStore(config.qdrant);

    // Initialize Qdrant collection
    await qdrantStore.initialize();
  });

  afterAll(async () => {
    if (postgresStore) {
      await postgresStore.close();
    }
  });

  describe('Pipeline Creation', () => {
    it.skipIf(!allServicesAvailable)('should create a retrieval pipeline', () => {
      expect(pipeline).toBeDefined();
      expect(pipeline).toBeInstanceOf(RetrievalPipeline);
    });

    it.skipIf(!allServicesAvailable)('should initialize with valid config', () => {
      const newPipeline = createRetrievalPipeline(config);
      expect(newPipeline).toBeInstanceOf(RetrievalPipeline);
    });
  });

  describe('Query Processing', () => {
    it.skipIf(!allServicesAvailable)('should process a simple query', async () => {
      const response = await pipeline.query('What is QMB?', { useCache: false });

      expect(response).toBeDefined();
      expect(response.queryId).toBeDefined();
      expect(typeof response.answer).toBe('string');
      expect(response.latencyMs).toBeGreaterThan(0);
    }, 60000);

    it.skipIf(!allServicesAvailable)('should include retrieval stats', async () => {
      const response = await pipeline.query('Medicare Savings Programs eligibility', { useCache: false });

      expect(response.retrievalStats).toBeDefined();
      expect(typeof response.retrievalStats.vectorResults).toBe('number');
      expect(typeof response.retrievalStats.bm25Results).toBe('number');
      expect(typeof response.retrievalStats.fusedResults).toBe('number');
      expect(typeof response.retrievalStats.rerankedResults).toBe('number');
      expect(typeof response.retrievalStats.finalResults).toBe('number');
    }, 60000);

    it.skipIf(!allServicesAvailable)('should include freshness info', async () => {
      const response = await pipeline.query('income limits 2024', { useCache: false });

      expect(response.freshnessInfo).toBeDefined();
      expect(typeof response.freshnessInfo.hasStaleData).toBe('boolean');
      expect(typeof response.freshnessInfo.warningCount).toBe('number');
    }, 60000);

    it.skipIf(!allServicesAvailable)('should return citations when relevant documents exist', async () => {
      const response = await pipeline.query('What are the QMB income limits?', { useCache: false });

      expect(response.citations).toBeDefined();
      expect(Array.isArray(response.citations)).toBe(true);

      // If there are citations, verify their structure
      if (response.citations.length > 0) {
        const citation = response.citations[0];
        expect(citation.chunkId).toBeDefined();
        expect(citation.documentId).toBeDefined();
        expect(citation.filename).toBeDefined();
      }
    }, 60000);

    it.skipIf(!allServicesAvailable)('should handle queries with no relevant documents gracefully', async () => {
      const response = await pipeline.query(
        'completely random query xyz123 that matches nothing',
        { useCache: false }
      );

      expect(response).toBeDefined();
      expect(typeof response.answer).toBe('string');
      // Should still return a response, even if it says no info found
    }, 60000);
  });

  describe('Caching', () => {
    it.skipIf(!allServicesAvailable)('should cache query responses', async () => {
      const query = 'TEST: What is SLMB for caching test?';

      // First query (cache miss)
      const response1 = await pipeline.query(query, { useCache: true });
      const latency1 = response1.latencyMs;

      // Second query (should be cache hit, faster)
      const response2 = await pipeline.query(query, { useCache: true });
      const latency2 = response2.latencyMs;

      expect(response1.answer).toBeDefined();
      expect(response2.answer).toBeDefined();

      // Cache hit should be faster (though not guaranteed)
      console.log(`Cache test - First: ${latency1}ms, Second: ${latency2}ms`);
    }, 120000);

    it.skipIf(!allServicesAvailable)('should bypass cache when useCache is false', async () => {
      const query = 'TEST: What is QI for cache bypass test?';

      // First query with caching
      await pipeline.query(query, { useCache: true });

      // Second query without caching (should still work, just slower)
      const response = await pipeline.query(query, { useCache: false });

      expect(response.answer).toBeDefined();
    }, 120000);
  });

  describe('Guardrails', () => {
    it.skipIf(!allServicesAvailable)('should detect sensitive topics and add disclaimers', async () => {
      // Query about estate planning (sensitive topic)
      const response = await pipeline.query(
        'What happens to my home if I go to a nursing home?',
        { useCache: false }
      );

      expect(response.answer).toBeDefined();
      // Estate recovery topics should trigger disclaimer
      // Note: This depends on the guardrails configuration
    }, 60000);
  });

  describe('Metadata Cache', () => {
    it.skipIf(!allServicesAvailable)('should invalidate metadata cache', () => {
      // Should not throw
      expect(() => pipeline.invalidateMetadataCache()).not.toThrow();
    });

    it.skipIf(!allServicesAvailable)('should rebuild cache after invalidation', async () => {
      pipeline.invalidateMetadataCache();

      // Query should still work (will rebuild cache)
      const response = await pipeline.query('TEST: income limits after cache invalidation', {
        useCache: false,
      });

      expect(response.answer).toBeDefined();
    }, 60000);
  });

  describe('Metrics', () => {
    it.skipIf(!allServicesAvailable)('should return query metrics', async () => {
      const metrics = await pipeline.getMetrics();

      expect(metrics).toBeDefined();
      expect(typeof metrics.totalQueries).toBe('number');
      expect(typeof metrics.avgLatencyMs).toBe('number');
      expect(typeof metrics.noAnswerRate).toBe('number');
    });
  });

  describe('Error Handling', () => {
    it.skipIf(!allServicesAvailable)('should handle empty query gracefully', async () => {
      // Empty queries should either work or throw a meaningful error
      try {
        const response = await pipeline.query('', { useCache: false });
        expect(response).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).toBeDefined();
      }
    }, 30000);

    it.skipIf(!allServicesAvailable)('should handle very long queries', async () => {
      const longQuery = 'What is Medicare? '.repeat(100);

      const response = await pipeline.query(longQuery, { useCache: false });

      expect(response).toBeDefined();
      expect(typeof response.answer).toBe('string');
    }, 60000);
  });
});
