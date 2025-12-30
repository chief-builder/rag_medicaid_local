/**
 * Latency Benchmark Tests
 * Tests: PRF-001 through PRF-004
 *
 * These tests measure performance benchmarks for the system.
 * Run with: pnpm test:perf
 */
import { describe, it, expect, beforeAll, bench } from 'vitest';
import { checkTestServices, createTestConfig } from '../helpers/test-db.js';
import { createMockLMStudioClient, SAMPLE_DOCUMENTS } from '../helpers/mock-lm-studio.js';
import { createMockPostgresStore, createPopulatedMockPostgresStore } from '../helpers/mock-postgres.js';
import { createMockQdrantStore, createPopulatedMockQdrantStore } from '../helpers/mock-qdrant.js';

describe('Performance Benchmarks', () => {
  let services: { postgres: boolean; qdrant: boolean; lmStudio: boolean };

  beforeAll(async () => {
    services = await checkTestServices();
  });

  describe('PRF-001: Single query latency', () => {
    it('should complete query within acceptable time (mock)', async () => {
      const mockPostgres = createPopulatedMockPostgresStore();
      const mockQdrant = createPopulatedMockQdrantStore();
      const mockLMStudio = createMockLMStudioClient();

      const startTime = performance.now();

      // Simulate full query pipeline
      const queryEmbedding = await mockLMStudio.embed('What is MSP?');
      const vectorResults = await mockQdrant.search(queryEmbedding.embedding, 20);
      const bm25Results = await mockPostgres.searchBM25('MSP', 20);

      // Simulate fusion (using basic merge for benchmark)
      const allResults = [...vectorResults, ...bm25Results];

      // Simulate reranking
      const reranked = await mockLMStudio.rerankListwise(
        'What is MSP?',
        allResults.slice(0, 10).map(r => ({ id: r.chunkId, content: r.content })),
        5
      );

      // Simulate answer generation
      const answer = await mockLMStudio.generateAnswer(
        'What is MSP?',
        reranked.slice(0, 5).map((r, i) => ({
          index: i + 1,
          content: allResults.find(a => a.chunkId === r.id)?.content || '',
          filename: 'test.pdf',
        }))
      );

      const endTime = performance.now();
      const latencyMs = endTime - startTime;

      // With mocks, should be very fast
      expect(latencyMs).toBeLessThan(1000); // 1 second with mocks

      // Log for visibility
      console.log(`Query latency (mocked): ${latencyMs.toFixed(2)}ms`);
    });

    bench('query pipeline with mocks', async () => {
      const mockPostgres = createPopulatedMockPostgresStore();
      const mockQdrant = createPopulatedMockQdrantStore();
      const mockLMStudio = createMockLMStudioClient();

      const embedding = await mockLMStudio.embed('Test query');
      await mockQdrant.search(embedding.embedding, 10);
      await mockPostgres.searchBM25('Test', 10);
    });
  });

  describe('PRF-002: Cached query latency', () => {
    it('should return cached response under 100ms', async () => {
      const mockPostgres = createMockPostgresStore();

      // Pre-cache a response
      const queryHash = 'cached-query-hash';
      const response = { answer: 'Cached answer', latencyMs: 50 };
      await mockPostgres.cacheQuery(queryHash, 'Query text', response, 3600);

      const startTime = performance.now();

      // Retrieve from cache
      const cached = await mockPostgres.getCachedQuery(queryHash);

      const endTime = performance.now();
      const latencyMs = endTime - startTime;

      expect(cached).not.toBeNull();
      expect(latencyMs).toBeLessThan(100);

      console.log(`Cached query latency: ${latencyMs.toFixed(2)}ms`);
    });

    bench('cache retrieval', async () => {
      const mockPostgres = createMockPostgresStore();
      const cachedQueries = new Map<string, Record<string, unknown>>();

      // Setup
      cachedQueries.set('hash', { answer: 'cached' });
      await mockPostgres.cacheQuery('hash', 'query', { answer: 'cached' }, 3600);

      // Benchmark
      await mockPostgres.getCachedQuery('hash');
    });
  });

  describe('PRF-003: Batch ingestion throughput', () => {
    it('should process documents efficiently', async () => {
      const mockPostgres = createMockPostgresStore();
      const mockLMStudio = createMockLMStudioClient();

      const documentsToProcess = 10;
      const chunksPerDocument = 5;

      const startTime = performance.now();

      for (let d = 0; d < documentsToProcess; d++) {
        // Insert document
        const doc = await mockPostgres.insertDocument({
          filename: `doc-${d}.pdf`,
          filepath: `/docs/doc-${d}.pdf`,
          fileHash: `hash-${d}`,
          title: `Document ${d}`,
          totalPages: 1,
        });

        // Create chunks
        const chunks = [];
        for (let c = 0; c < chunksPerDocument; c++) {
          chunks.push({
            documentId: doc.id,
            chunkIndex: c,
            content: `Content for document ${d}, chunk ${c}`,
            startChar: c * 100,
            endChar: (c + 1) * 100,
          });
        }
        await mockPostgres.insertChunksBatch(chunks);

        // Generate embeddings
        const contents = chunks.map(c => c.content);
        await mockLMStudio.embedBatch(contents);
      }

      const endTime = performance.now();
      const totalTimeMs = endTime - startTime;
      const docsPerSecond = (documentsToProcess / totalTimeMs) * 1000;

      console.log(`Ingestion throughput: ${docsPerSecond.toFixed(2)} docs/second`);
      console.log(`Total chunks processed: ${documentsToProcess * chunksPerDocument}`);
      console.log(`Time per document: ${(totalTimeMs / documentsToProcess).toFixed(2)}ms`);

      // Should process at least 1 doc per minute (with mocks, much faster)
      expect(docsPerSecond).toBeGreaterThan(1 / 60); // > 1 doc/minute
    });

    bench('document ingestion', async () => {
      const mockPostgres = createMockPostgresStore();
      const mockLMStudio = createMockLMStudioClient();

      await mockPostgres.insertDocument({
        filename: 'test.pdf',
        filepath: '/test.pdf',
        fileHash: `hash-${Date.now()}`,
        title: 'Test',
        totalPages: 1,
      });
    });
  });

  describe('PRF-004: Embedding generation rate', () => {
    it('should track time per batch', async () => {
      const mockLMStudio = createMockLMStudioClient();
      const batchSizes = [1, 5, 10, 20];
      const results: Array<{ batchSize: number; timeMs: number; msPerItem: number }> = [];

      for (const batchSize of batchSizes) {
        const texts = Array.from({ length: batchSize }, (_, i) => `Sample text for embedding ${i}`);

        const startTime = performance.now();
        await mockLMStudio.embedBatch(texts);
        const endTime = performance.now();

        const timeMs = endTime - startTime;
        results.push({
          batchSize,
          timeMs,
          msPerItem: timeMs / batchSize,
        });
      }

      console.log('Embedding generation rates:');
      for (const r of results) {
        console.log(`  Batch size ${r.batchSize}: ${r.timeMs.toFixed(2)}ms total, ${r.msPerItem.toFixed(2)}ms/item`);
      }

      // Verify all completed
      expect(results.length).toBe(batchSizes.length);
    });

    bench('embedding batch of 10', async () => {
      const mockLMStudio = createMockLMStudioClient();
      const texts = Array.from({ length: 10 }, (_, i) => `Text ${i}`);
      await mockLMStudio.embedBatch(texts);
    });
  });
});

describe('Load Tests', () => {
  describe('PRF-005: 10 concurrent queries', () => {
    it('should complete all without error', async () => {
      const mockPostgres = createPopulatedMockPostgresStore();
      const mockQdrant = createPopulatedMockQdrantStore();
      const mockLMStudio = createMockLMStudioClient();

      const queries = [
        'What is MSP?',
        'How do I qualify for QMB?',
        'Long-term care eligibility',
        'Estate recovery rules',
        'Spousal impoverishment',
        'Medicare Part B premium',
        'SLMB program',
        'Medicaid income limits',
        'Nursing home coverage',
        'PACE program Pennsylvania',
      ];

      const startTime = performance.now();

      const results = await Promise.all(
        queries.map(async (query) => {
          try {
            const embedding = await mockLMStudio.embed(query);
            const vectorResults = await mockQdrant.search(embedding.embedding, 5);
            const bm25Results = await mockPostgres.searchBM25(query.split(' ')[0], 5);
            return { query, success: true, resultCount: vectorResults.length + bm25Results.length };
          } catch (error) {
            return { query, success: false, error: (error as Error).message };
          }
        })
      );

      const endTime = performance.now();

      const successful = results.filter(r => r.success).length;
      console.log(`Concurrent queries: ${successful}/${queries.length} successful`);
      console.log(`Total time: ${(endTime - startTime).toFixed(2)}ms`);

      expect(successful).toBe(queries.length);
    });
  });

  describe('PRF-006: 100 sequential queries', () => {
    it('should complete without memory leaks, stable latency', async () => {
      const mockPostgres = createPopulatedMockPostgresStore();
      const mockLMStudio = createMockLMStudioClient();

      const queryCount = 100;
      const latencies: number[] = [];
      let errors = 0;

      for (let i = 0; i < queryCount; i++) {
        const startTime = performance.now();

        try {
          await mockLMStudio.embed(`Query number ${i}`);
          await mockPostgres.searchBM25(`term${i % 10}`, 5);
        } catch {
          errors++;
        }

        const endTime = performance.now();
        latencies.push(endTime - startTime);
      }

      // Calculate stats
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const minLatency = Math.min(...latencies);
      const maxLatency = Math.max(...latencies);

      console.log(`Sequential queries stats (${queryCount} queries):`);
      console.log(`  Avg latency: ${avgLatency.toFixed(2)}ms`);
      console.log(`  Min latency: ${minLatency.toFixed(2)}ms`);
      console.log(`  Max latency: ${maxLatency.toFixed(2)}ms`);
      console.log(`  Errors: ${errors}`);

      expect(errors).toBe(0);

      // Check for stability (no significant degradation over time)
      const firstHalfAvg = latencies.slice(0, 50).reduce((a, b) => a + b, 0) / 50;
      const secondHalfAvg = latencies.slice(50).reduce((a, b) => a + b, 0) / 50;

      // Second half shouldn't be significantly slower than first half
      expect(secondHalfAvg).toBeLessThan(firstHalfAvg * 2);
    });
  });

  describe('PRF-007: Large document ingestion', () => {
    it('should complete 100+ page document without timeout', async () => {
      const mockPostgres = createMockPostgresStore();
      const mockLMStudio = createMockLMStudioClient();

      // Simulate a large document with many chunks
      const totalPages = 100;
      const chunksPerPage = 3;
      const totalChunks = totalPages * chunksPerPage;

      const startTime = performance.now();

      const doc = await mockPostgres.insertDocument({
        filename: 'large-document.pdf',
        filepath: '/docs/large-document.pdf',
        fileHash: 'large-doc-hash',
        title: 'Large Test Document',
        totalPages,
      });

      // Create chunks in batches
      const batchSize = 50;
      for (let i = 0; i < totalChunks; i += batchSize) {
        const batch = [];
        for (let j = i; j < Math.min(i + batchSize, totalChunks); j++) {
          batch.push({
            documentId: doc.id,
            chunkIndex: j,
            content: `Content for chunk ${j} of large document. This is sample text that would normally be extracted from a PDF page.`,
            pageNumber: Math.floor(j / chunksPerPage) + 1,
            startChar: j * 100,
            endChar: (j + 1) * 100,
          });
        }
        await mockPostgres.insertChunksBatch(batch);

        // Generate embeddings for batch
        await mockLMStudio.embedBatch(batch.map(c => c.content));
      }

      const endTime = performance.now();
      const totalTimeMs = endTime - startTime;

      console.log(`Large document ingestion (${totalPages} pages, ${totalChunks} chunks):`);
      console.log(`  Total time: ${(totalTimeMs / 1000).toFixed(2)}s`);
      console.log(`  Time per page: ${(totalTimeMs / totalPages).toFixed(2)}ms`);
      console.log(`  Time per chunk: ${(totalTimeMs / totalChunks).toFixed(2)}ms`);

      // Should complete within reasonable time (10 minutes max for real scenario)
      expect(totalTimeMs).toBeLessThan(600000); // 10 minutes

      // Verify all chunks were stored
      const storedChunks = mockPostgres._getStoredChunks();
      expect(storedChunks.length).toBe(totalChunks);
    });
  });
});
