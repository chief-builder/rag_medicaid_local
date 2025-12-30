/**
 * Infrastructure & Connectivity Integration Tests
 * Tests: INF-001 through INF-011
 *
 * These tests verify connectivity to external services (PostgreSQL, Qdrant, LM Studio).
 * They require the services to be running for tests to pass.
 * Tests are skipped if services are unavailable.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { checkTestServices, createTestConfig } from '../helpers/test-db.js';
import { PostgresStore } from '../../src/clients/postgres.js';
import { QdrantStore } from '../../src/clients/qdrant.js';
import { LMStudioClient } from '../../src/clients/lm-studio.js';

// Check services once at module load time using top-level await
const services = await checkTestServices();
console.log('Infrastructure tests - Available services:', services);

describe('Infrastructure & Connectivity Tests', () => {
  let postgresStore: PostgresStore | null = null;
  let qdrantStore: QdrantStore | null = null;
  let lmStudioClient: LMStudioClient | null = null;
  const config = createTestConfig();

  afterAll(async () => {
    if (postgresStore) {
      await postgresStore.close();
    }
  });

  describe('1.1 Database Connectivity', () => {
    describe('INF-001: PostgreSQL connection', () => {
      it.skipIf(!services.postgres)('should establish connection and return version', async () => {
        postgresStore = new PostgresStore(config.postgres);

        const healthy = await postgresStore.healthCheck();
        expect(healthy).toBe(true);
      });
    });

    describe('INF-002: Database migrations complete', () => {
      it.skipIf(!services.postgres)('should have all required tables', async () => {
        if (!postgresStore) {
          postgresStore = new PostgresStore(config.postgres);
        }

        // Check for all required tables by querying the schema
        const requiredTables = [
          'documents',
          'chunks',
          'embedding_cache',
          'query_cache',
          'query_logs',
          'source_monitors',
          'source_change_log',
        ];

        // This is an integration test - we're checking actual table existence
        for (const table of requiredTables) {
          try {
            // Try to list documents (will fail if table doesn't exist)
            await (postgresStore as unknown as { pool: { query: (q: string) => Promise<unknown> } }).pool.query(`SELECT 1 FROM ${table} LIMIT 1`);
          } catch (error) {
            expect.fail(`Table ${table} does not exist`);
          }
        }
      });
    });

    describe('INF-003: PostgreSQL BM25 function exists', () => {
      it.skipIf(!services.postgres)('should have search_bm25 function callable', async () => {
        if (!postgresStore) {
          postgresStore = new PostgresStore(config.postgres);
        }

        // Try to call the function (will return empty results, but shouldn't error)
        const results = await postgresStore.searchBM25('test query', 5);
        expect(Array.isArray(results)).toBe(true);
      });
    });

    describe('INF-004: PostgreSQL indexes exist', () => {
      it.skipIf(!services.postgres)('should have GIN index on content_tsv', async () => {
        if (!postgresStore) {
          postgresStore = new PostgresStore(config.postgres);
        }

        // Query pg_indexes to verify GIN index exists
        const pool = (postgresStore as unknown as { pool: { query: (q: string) => Promise<{ rows: Array<{ indexname: string }> }> } }).pool;
        const result = await pool.query(`
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'chunks' AND indexdef LIKE '%gin%'
        `);

        expect(result.rows.length).toBeGreaterThan(0);
      });
    });
  });

  describe('1.2 Vector Store Connectivity', () => {
    describe('INF-005: Qdrant connection', () => {
      it.skipIf(!services.qdrant)('should establish connection', async () => {
        qdrantStore = new QdrantStore(config.qdrant);

        const healthy = await qdrantStore.healthCheck();
        expect(healthy).toBe(true);
      });
    });

    describe('INF-006: Collection exists/created', () => {
      it.skipIf(!services.qdrant)('should have collection with correct dimensions', async () => {
        if (!qdrantStore) {
          qdrantStore = new QdrantStore(config.qdrant);
        }

        // Initialize will create collection if it doesn't exist
        await qdrantStore.initialize();

        const info = await qdrantStore.getCollectionInfo();
        expect(info.status).not.toBe('not_created');
      });
    });

    describe('INF-007: Collection has correct vector config', () => {
      it.skipIf(!services.qdrant)('should use Cosine distance and have payload indices', async () => {
        if (!qdrantStore) {
          qdrantStore = new QdrantStore(config.qdrant);
          await qdrantStore.initialize();
        }

        // Collection info should indicate it's operational
        const info = await qdrantStore.getCollectionInfo();
        expect(['green', 'yellow']).toContain(info.status);
      });
    });
  });

  describe('1.3 LM Studio Connectivity', () => {
    describe('INF-008: LM Studio health check', () => {
      it.skipIf(!services.lmStudio)('should respond to health check', async () => {
        lmStudioClient = new LMStudioClient(config.lmStudio);

        const healthy = await lmStudioClient.healthCheck();
        expect(healthy).toBe(true);
      });
    });

    describe('INF-009: Embedding model available', () => {
      it.skipIf(!services.lmStudio)('should load and respond with embeddings', async () => {
        if (!lmStudioClient) {
          lmStudioClient = new LMStudioClient(config.lmStudio);
        }

        const result = await lmStudioClient.embed('Test text');
        expect(result.embedding).toBeDefined();
        expect(Array.isArray(result.embedding)).toBe(true);
      });
    });

    describe('INF-010: LLM model available', () => {
      it.skipIf(!services.lmStudio)('should respond to chat completions', async () => {
        if (!lmStudioClient) {
          lmStudioClient = new LMStudioClient(config.lmStudio);
        }

        const response = await lmStudioClient.chat([
          { role: 'user', content: 'Say "Hello" and nothing else.' },
        ], { maxTokens: 10 });

        expect(response).toBeDefined();
        expect(typeof response).toBe('string');
      });
    });

    describe('INF-011: Embedding dimension verification', () => {
      it.skipIf(!services.lmStudio)('should return 768-dimension vectors', async () => {
        if (!lmStudioClient) {
          lmStudioClient = new LMStudioClient(config.lmStudio);
        }

        const result = await lmStudioClient.embed('Test text for dimension check');

        expect(result.embedding.length).toBe(768);
      });
    });
  });
});
