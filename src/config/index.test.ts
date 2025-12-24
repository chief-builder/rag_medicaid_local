import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadConfig, resetConfig } from './index.js';

describe('loadConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    resetConfig();
  });

  afterEach(() => {
    process.env = originalEnv;
    resetConfig();
  });

  it('should load config with default values', () => {
    const config = loadConfig();

    expect(config.lmStudio.baseUrl).toBe('http://localhost:1234/v1');
    expect(config.lmStudio.ocrModel).toBe('allenai/olmocr-2-7b');
    expect(config.lmStudio.llmModel).toBe('qwen2.5-7b-instruct');
    expect(config.qdrant.url).toBe('http://localhost:6333');
    expect(config.qdrant.collection).toBe('medicaid_chunks');
    expect(config.postgres.host).toBe('localhost');
    expect(config.postgres.port).toBe(5432);
    expect(config.rag.chunkSize).toBe(512);
    expect(config.rag.chunkOverlap).toBe(64);
  });

  it('should override defaults with environment variables', () => {
    process.env.LM_STUDIO_BASE_URL = 'http://custom:8080/v1';
    process.env.QDRANT_URL = 'http://qdrant:6333';
    process.env.CHUNK_SIZE = '1024';
    process.env.VECTOR_TOP_K = '50';

    const config = loadConfig();

    expect(config.lmStudio.baseUrl).toBe('http://custom:8080/v1');
    expect(config.qdrant.url).toBe('http://qdrant:6333');
    expect(config.rag.chunkSize).toBe(1024);
    expect(config.rag.vectorTopK).toBe(50);
  });

  it('should parse boolean environment variables', () => {
    process.env.CACHE_ENABLED = 'false';

    const config = loadConfig();

    expect(config.cache.enabled).toBe(false);
  });

  it('should parse numeric environment variables', () => {
    process.env.POSTGRES_PORT = '5433';
    process.env.CACHE_TTL_SECONDS = '7200';

    const config = loadConfig();

    expect(config.postgres.port).toBe(5433);
    expect(config.cache.ttlSeconds).toBe(7200);
  });

  it('should validate config schema', () => {
    process.env.CHUNK_SIZE = '50'; // Below minimum of 100

    expect(() => loadConfig()).toThrow();
  });

  it('should validate log level', () => {
    process.env.LOG_LEVEL = 'invalid';

    expect(() => loadConfig()).toThrow();
  });
});
