import { vi } from 'vitest';

/**
 * Test database utilities for integration tests
 * These helpers manage test database setup, teardown, and seeding
 */

export interface TestDbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

/**
 * Get test database configuration
 */
export function getTestDbConfig(): TestDbConfig {
  return {
    host: process.env.TEST_DB_HOST || process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.TEST_DB_PORT || process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.TEST_DB_NAME || process.env.POSTGRES_DB || 'medicaid_rag',
    user: process.env.TEST_DB_USER || process.env.POSTGRES_USER || 'postgres',
    password: process.env.TEST_DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
  };
}

/**
 * Check if test services are available
 */
export async function checkTestServices(): Promise<{
  postgres: boolean;
  qdrant: boolean;
  lmStudio: boolean;
}> {
  const results = {
    postgres: false,
    qdrant: false,
    lmStudio: false,
  };

  // Check PostgreSQL
  try {
    const pg = await import('pg');
    const config = getTestDbConfig();
    const client = new pg.default.Client(config);
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
    results.postgres = true;
  } catch {
    results.postgres = false;
  }

  // Check Qdrant
  try {
    const qdrantUrl = process.env.TEST_QDRANT_URL || 'http://localhost:6333';
    const response = await fetch(`${qdrantUrl}/collections`);
    results.qdrant = response.ok;
  } catch {
    results.qdrant = false;
  }

  // Check LM Studio
  try {
    const lmStudioUrl = process.env.TEST_LM_STUDIO_URL || 'http://localhost:1234/v1';
    const response = await fetch(`${lmStudioUrl}/models`);
    results.lmStudio = response.ok;
  } catch {
    results.lmStudio = false;
  }

  return results;
}

/**
 * Skip test if required services are not available
 */
export async function skipIfServicesUnavailable(
  required: ('postgres' | 'qdrant' | 'lmStudio')[]
): Promise<boolean> {
  const services = await checkTestServices();

  for (const service of required) {
    if (!services[service]) {
      console.warn(`Skipping test - ${service} not available`);
      return true;
    }
  }

  return false;
}

/**
 * Create a test transaction wrapper for database tests
 * Automatically rolls back after each test
 */
export function createTestTransaction() {
  let client: import('pg').Client | null = null;

  return {
    async setup() {
      const pg = await import('pg');
      const config = getTestDbConfig();
      client = new pg.default.Client(config);
      await client.connect();
      await client.query('BEGIN');
    },

    async teardown() {
      if (client) {
        await client.query('ROLLBACK');
        await client.end();
        client = null;
      }
    },

    getClient() {
      return client;
    },
  };
}

/**
 * Seed test data into the database
 */
export async function seedTestData(client: import('pg').Client) {
  // Insert test documents
  await client.query(`
    INSERT INTO documents (id, filename, filepath, file_hash, title, total_pages, metadata)
    VALUES
      ('test-doc-001', 'msp-guide.pdf', '/test/msp-guide.pdf', 'hash001', 'MSP Guide', 10, '{"documentType": "msp_guide"}'),
      ('test-doc-002', 'ltc-info.pdf', '/test/ltc-info.pdf', 'hash002', 'LTC Info', 15, '{"documentType": "ltc_info"}')
    ON CONFLICT (id) DO NOTHING
  `);

  // Insert test chunks
  await client.query(`
    INSERT INTO chunks (id, document_id, chunk_index, content, page_number, start_char, end_char, metadata)
    VALUES
      ('test-chunk-001', 'test-doc-001', 0, 'Medicare Savings Programs help pay Medicare costs.', 1, 0, 50, '{"filename": "msp-guide.pdf"}'),
      ('test-chunk-002', 'test-doc-001', 1, 'QMB pays Part A and Part B premiums.', 1, 51, 90, '{"filename": "msp-guide.pdf"}'),
      ('test-chunk-003', 'test-doc-002', 0, 'Long-term care Medicaid helps pay for nursing home care.', 1, 0, 55, '{"filename": "ltc-info.pdf"}')
    ON CONFLICT (id) DO NOTHING
  `);
}

/**
 * Clean up test data from the database
 */
export async function cleanupTestData(client: import('pg').Client) {
  await client.query(`DELETE FROM chunks WHERE id LIKE 'test-%'`);
  await client.query(`DELETE FROM documents WHERE id LIKE 'test-%'`);
  await client.query(`DELETE FROM query_logs WHERE query_text LIKE 'TEST:%'`);
  await client.query(`DELETE FROM query_cache WHERE query_text LIKE 'TEST:%'`);
}

/**
 * Mock environment variables for testing
 */
export function mockTestEnvironment() {
  const originalEnv = { ...process.env };

  return {
    setup() {
      process.env.LM_STUDIO_BASE_URL = 'http://localhost:1234/v1';
      process.env.QDRANT_URL = 'http://localhost:6333';
      process.env.POSTGRES_HOST = 'localhost';
      process.env.POSTGRES_PORT = '5432';
      process.env.POSTGRES_DB = 'medicaid_rag';
      process.env.POSTGRES_USER = 'postgres';
      process.env.POSTGRES_PASSWORD = 'postgres';
      process.env.EMBEDDING_DIMENSION = '768';
      process.env.CACHE_ENABLED = 'true';
      process.env.CACHE_TTL_SECONDS = '300';
    },

    restore() {
      process.env = originalEnv;
    },
  };
}

/**
 * Create mock config for tests
 */
export function createTestConfig() {
  return {
    lmStudio: {
      baseUrl: 'http://localhost:1234/v1',
      embeddingModel: 'text-embedding-nomic-embed-text-v1.5',
      llmModel: 'qwen2.5-7b-instruct',
      ocrModel: 'allenai/olmocr-2-7b',
    },
    qdrant: {
      url: 'http://localhost:6333',
      collection: 'medicaid_chunks_test',
      embeddingDimension: 768,
    },
    postgres: {
      host: 'localhost',
      port: 5432,
      database: 'medicaid_rag',
      user: 'postgres',
      password: 'postgres',
    },
    rag: {
      chunkSize: 512,
      chunkOverlap: 64,
      vectorTopK: 20,
      bm25TopK: 20,
      rerankTopN: 10,
      finalTopC: 5,
    },
    cache: {
      enabled: true,
      ttlSeconds: 300,
    },
  };
}
