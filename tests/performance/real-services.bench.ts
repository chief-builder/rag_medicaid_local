/**
 * Real Services Performance Benchmark
 *
 * Tests actual performance against running services:
 * - PostgreSQL (localhost:5432)
 * - Qdrant (localhost:6333)
 * - LM Studio (localhost:1234)
 *
 * Run with: pnpm tsx tests/performance/real-services.bench.ts
 */

import { performance } from 'perf_hooks';
import { PostgresStore } from '../../src/clients/postgres.js';
import { QdrantStore } from '../../src/clients/qdrant.js';
import { LMStudioClient } from '../../src/clients/lm-studio.js';

// Configuration
const config = {
  postgres: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'medicaid_rag',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
  },
  qdrant: {
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    collection: 'medicaid_chunks',
    embeddingDimension: 768,
  },
  lmStudio: {
    baseUrl: process.env.LM_STUDIO_BASE_URL || 'http://localhost:1234/v1',
    embeddingModel: 'text-embedding-nomic-embed-text-v1.5',
    llmModel: 'qwen2.5-7b-instruct',
  },
};

// Test queries for benchmarking
const TEST_QUERIES = [
  'What are the income limits for QMB?',
  'How do I apply for Medicare Savings Programs?',
  'What is the LIFE program in Pennsylvania?',
  'Can I get help with my Medicare Part B premium?',
  'What documents do I need to apply for Medicaid?',
];

// Utility functions
function formatMs(ms: number): string {
  return `${ms.toFixed(2)}ms`;
}

function formatStats(times: number[]): { min: number; max: number; avg: number; p50: number; p95: number; p99: number } {
  const sorted = [...times].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: sum / sorted.length,
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
  };
}

function printStats(name: string, times: number[]): void {
  const stats = formatStats(times);
  console.log(`\n  ${name}:`);
  console.log(`    Samples: ${times.length}`);
  console.log(`    Min:     ${formatMs(stats.min)}`);
  console.log(`    Max:     ${formatMs(stats.max)}`);
  console.log(`    Avg:     ${formatMs(stats.avg)}`);
  console.log(`    P50:     ${formatMs(stats.p50)}`);
  console.log(`    P95:     ${formatMs(stats.p95)}`);
  console.log(`    P99:     ${formatMs(stats.p99)}`);
}

async function checkServices(): Promise<{ postgres: boolean; qdrant: boolean; lmStudio: boolean }> {
  const results = { postgres: false, qdrant: false, lmStudio: false };

  // Check PostgreSQL
  try {
    const pg = new PostgresStore(config.postgres);
    results.postgres = await pg.healthCheck();
    await pg.close();
  } catch {
    results.postgres = false;
  }

  // Check Qdrant
  try {
    const response = await fetch(`${config.qdrant.url}/collections`);
    results.qdrant = response.ok;
  } catch {
    results.qdrant = false;
  }

  // Check LM Studio
  try {
    const response = await fetch(`${config.lmStudio.baseUrl}/models`);
    results.lmStudio = response.ok;
  } catch {
    results.lmStudio = false;
  }

  return results;
}

// Benchmark functions
async function benchmarkEmbedding(client: LMStudioClient, iterations: number = 10): Promise<number[]> {
  const times: number[] = [];
  const testText = 'What are the income limits for the Medicare Savings Program in Pennsylvania?';

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await client.embed(testText);
    times.push(performance.now() - start);
  }

  return times;
}

async function benchmarkEmbeddingBatch(client: LMStudioClient, batchSize: number = 5, iterations: number = 5): Promise<number[]> {
  const times: number[] = [];
  const texts = Array.from({ length: batchSize }, (_, i) =>
    `Test text number ${i + 1} for batch embedding benchmark.`
  );

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await client.embedBatch(texts);
    times.push(performance.now() - start);
  }

  return times;
}

async function benchmarkVectorSearch(qdrant: QdrantStore, lmStudio: LMStudioClient, iterations: number = 10): Promise<number[]> {
  const times: number[] = [];

  // Pre-generate embedding for consistent search
  const { embedding } = await lmStudio.embed('Medicare Savings Programs eligibility');

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await qdrant.search(embedding, 20);
    times.push(performance.now() - start);
  }

  return times;
}

async function benchmarkBM25Search(postgres: PostgresStore, iterations: number = 10): Promise<number[]> {
  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const query = TEST_QUERIES[i % TEST_QUERIES.length];
    const start = performance.now();
    await postgres.searchBM25(query, 20);
    times.push(performance.now() - start);
  }

  return times;
}

async function benchmarkLLMGeneration(client: LMStudioClient, iterations: number = 5): Promise<number[]> {
  const times: number[] = [];
  const context = `Medicare Savings Programs (MSP) help pay Medicare costs for people with limited income.
QMB pays Part A and Part B premiums, deductibles, and coinsurance. Income limit: 100% FPL.
SLMB pays Part B premium only. Income limit: 120% FPL.
QI pays Part B premium only. Income limit: 135% FPL.`;

  for (let i = 0; i < iterations; i++) {
    const query = TEST_QUERIES[i % TEST_QUERIES.length];
    const start = performance.now();
    await client.chat([
      { role: 'system', content: 'You are a helpful assistant. Answer based on the provided context.' },
      { role: 'user', content: `Context: ${context}\n\nQuestion: ${query}` },
    ], { maxTokens: 200 });
    times.push(performance.now() - start);
  }

  return times;
}

async function benchmarkFullQueryPipeline(
  postgres: PostgresStore,
  qdrant: QdrantStore,
  lmStudio: LMStudioClient,
  iterations: number = 5
): Promise<{ total: number[]; embedding: number[]; vectorSearch: number[]; bm25Search: number[]; llm: number[] }> {
  const results = {
    total: [] as number[],
    embedding: [] as number[],
    vectorSearch: [] as number[],
    bm25Search: [] as number[],
    llm: [] as number[],
  };

  for (let i = 0; i < iterations; i++) {
    const query = TEST_QUERIES[i % TEST_QUERIES.length];
    const totalStart = performance.now();

    // Step 1: Embedding
    const embStart = performance.now();
    const { embedding } = await lmStudio.embed(query);
    results.embedding.push(performance.now() - embStart);

    // Step 2: Vector search
    const vecStart = performance.now();
    const vectorResults = await qdrant.search(embedding, 20);
    results.vectorSearch.push(performance.now() - vecStart);

    // Step 3: BM25 search
    const bm25Start = performance.now();
    const bm25Results = await postgres.searchBM25(query, 20);
    results.bm25Search.push(performance.now() - bm25Start);

    // Step 4: LLM generation (simplified - no reranking for benchmark)
    const llmStart = performance.now();
    const context = [...vectorResults, ...bm25Results]
      .slice(0, 5)
      .map(r => r.content)
      .join('\n\n');

    await lmStudio.chat([
      { role: 'system', content: 'Answer the question based on the provided context. Be concise.' },
      { role: 'user', content: `Context: ${context}\n\nQuestion: ${query}` },
    ], { maxTokens: 300 });
    results.llm.push(performance.now() - llmStart);

    results.total.push(performance.now() - totalStart);
  }

  return results;
}

async function benchmarkCachePerformance(postgres: PostgresStore, iterations: number = 20): Promise<{ miss: number[]; hit: number[] }> {
  const results = { miss: [] as number[], hit: [] as number[] };
  const queryHash = `bench-${Date.now()}`;
  const queryText = 'Benchmark cache test query';
  const response = { answer: 'Cached answer for benchmark', citations: [] };

  // Cache miss
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await postgres.getCachedQuery(`${queryHash}-miss-${i}`);
    results.miss.push(performance.now() - start);
  }

  // Store in cache
  await postgres.cacheQuery(queryHash, queryText, response, 3600);

  // Cache hit
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await postgres.getCachedQuery(queryHash);
    results.hit.push(performance.now() - start);
  }

  return results;
}

// Main benchmark runner
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     Real Services Performance Benchmark - Medicaid RAG         ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(`\nTimestamp: ${new Date().toISOString()}`);

  // Check services
  console.log('\n📡 Checking service availability...');
  const services = await checkServices();
  console.log(`  PostgreSQL: ${services.postgres ? '✅ Available' : '❌ Unavailable'}`);
  console.log(`  Qdrant:     ${services.qdrant ? '✅ Available' : '❌ Unavailable'}`);
  console.log(`  LM Studio:  ${services.lmStudio ? '✅ Available' : '❌ Unavailable'}`);

  if (!services.postgres || !services.qdrant || !services.lmStudio) {
    console.error('\n❌ Not all services are available. Please start all services and try again.');
    process.exit(1);
  }

  // Initialize clients
  const postgres = new PostgresStore(config.postgres);
  const qdrant = new QdrantStore(config.qdrant);
  const lmStudio = new LMStudioClient(config.lmStudio);

  await qdrant.initialize();

  const allResults: Record<string, { times: number[]; unit: string }> = {};

  try {
    // Benchmark 1: Single Embedding
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔤 Benchmark 1: Single Embedding Generation');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const embeddingTimes = await benchmarkEmbedding(lmStudio, 10);
    printStats('Single Embedding', embeddingTimes);
    allResults['single_embedding'] = { times: embeddingTimes, unit: 'ms' };

    // Benchmark 2: Batch Embedding
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 Benchmark 2: Batch Embedding (5 texts)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const batchEmbeddingTimes = await benchmarkEmbeddingBatch(lmStudio, 5, 5);
    printStats('Batch Embedding (5 texts)', batchEmbeddingTimes);
    allResults['batch_embedding_5'] = { times: batchEmbeddingTimes, unit: 'ms' };

    // Benchmark 3: Vector Search
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 Benchmark 3: Vector Search (Qdrant)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const vectorSearchTimes = await benchmarkVectorSearch(qdrant, lmStudio, 10);
    printStats('Vector Search (top 20)', vectorSearchTimes);
    allResults['vector_search'] = { times: vectorSearchTimes, unit: 'ms' };

    // Benchmark 4: BM25 Search
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 Benchmark 4: BM25 Search (PostgreSQL)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const bm25Times = await benchmarkBM25Search(postgres, 10);
    printStats('BM25 Search (top 20)', bm25Times);
    allResults['bm25_search'] = { times: bm25Times, unit: 'ms' };

    // Benchmark 5: LLM Generation
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🤖 Benchmark 5: LLM Answer Generation');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const llmTimes = await benchmarkLLMGeneration(lmStudio, 5);
    printStats('LLM Generation (200 tokens)', llmTimes);
    allResults['llm_generation'] = { times: llmTimes, unit: 'ms' };

    // Benchmark 6: Cache Performance
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💾 Benchmark 6: Cache Performance');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const cacheTimes = await benchmarkCachePerformance(postgres, 20);
    printStats('Cache Miss', cacheTimes.miss);
    printStats('Cache Hit', cacheTimes.hit);
    allResults['cache_miss'] = { times: cacheTimes.miss, unit: 'ms' };
    allResults['cache_hit'] = { times: cacheTimes.hit, unit: 'ms' };

    // Benchmark 7: Full Query Pipeline
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 Benchmark 7: Full Query Pipeline (E2E)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const pipelineTimes = await benchmarkFullQueryPipeline(postgres, qdrant, lmStudio, 5);
    printStats('Total Pipeline', pipelineTimes.total);
    printStats('  └─ Embedding', pipelineTimes.embedding);
    printStats('  └─ Vector Search', pipelineTimes.vectorSearch);
    printStats('  └─ BM25 Search', pipelineTimes.bm25Search);
    printStats('  └─ LLM Generation', pipelineTimes.llm);
    allResults['pipeline_total'] = { times: pipelineTimes.total, unit: 'ms' };
    allResults['pipeline_embedding'] = { times: pipelineTimes.embedding, unit: 'ms' };
    allResults['pipeline_vector_search'] = { times: pipelineTimes.vectorSearch, unit: 'ms' };
    allResults['pipeline_bm25_search'] = { times: pipelineTimes.bm25Search, unit: 'ms' };
    allResults['pipeline_llm'] = { times: pipelineTimes.llm, unit: 'ms' };

    // Summary
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                        SUMMARY                                  ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');

    const pipelineStats = formatStats(pipelineTimes.total);
    const embStats = formatStats(pipelineTimes.embedding);
    const vecStats = formatStats(pipelineTimes.vectorSearch);
    const bm25Stats = formatStats(pipelineTimes.bm25Search);
    const llmStats = formatStats(pipelineTimes.llm);
    const cacheHitStats = formatStats(cacheTimes.hit);

    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ Component              │ Avg Latency │ % of Total │ P95        │');
    console.log('├─────────────────────────────────────────────────────────────────┤');
    console.log(`│ Embedding              │ ${embStats.avg.toFixed(0).padStart(8)}ms │ ${((embStats.avg / pipelineStats.avg) * 100).toFixed(1).padStart(9)}% │ ${embStats.p95.toFixed(0).padStart(7)}ms │`);
    console.log(`│ Vector Search (Qdrant) │ ${vecStats.avg.toFixed(0).padStart(8)}ms │ ${((vecStats.avg / pipelineStats.avg) * 100).toFixed(1).padStart(9)}% │ ${vecStats.p95.toFixed(0).padStart(7)}ms │`);
    console.log(`│ BM25 Search (Postgres) │ ${bm25Stats.avg.toFixed(0).padStart(8)}ms │ ${((bm25Stats.avg / pipelineStats.avg) * 100).toFixed(1).padStart(9)}% │ ${bm25Stats.p95.toFixed(0).padStart(7)}ms │`);
    console.log(`│ LLM Generation         │ ${llmStats.avg.toFixed(0).padStart(8)}ms │ ${((llmStats.avg / pipelineStats.avg) * 100).toFixed(1).padStart(9)}% │ ${llmStats.p95.toFixed(0).padStart(7)}ms │`);
    console.log('├─────────────────────────────────────────────────────────────────┤');
    console.log(`│ TOTAL PIPELINE         │ ${pipelineStats.avg.toFixed(0).padStart(8)}ms │    100.0% │ ${pipelineStats.p95.toFixed(0).padStart(7)}ms │`);
    console.log(`│ Cached Query           │ ${cacheHitStats.avg.toFixed(1).padStart(8)}ms │      N/A  │ ${cacheHitStats.p95.toFixed(1).padStart(7)}ms │`);
    console.log('└─────────────────────────────────────────────────────────────────┘');

    console.log('\n📊 Key Insights:');
    console.log(`  • LLM generation is ${((llmStats.avg / pipelineStats.avg) * 100).toFixed(0)}% of total latency`);
    console.log(`  • Cache hits are ${(pipelineStats.avg / cacheHitStats.avg).toFixed(0)}x faster than full queries`);
    console.log(`  • Vector search is ${(vecStats.avg / bm25Stats.avg).toFixed(1)}x ${vecStats.avg > bm25Stats.avg ? 'slower' : 'faster'} than BM25`);

  } finally {
    await postgres.close();
  }

  console.log('\n✅ Benchmark complete!\n');
}

main().catch(console.error);
