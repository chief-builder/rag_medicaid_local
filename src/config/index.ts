import { config as dotenvConfig } from 'dotenv';
import { Config, ConfigSchema } from '../types/index.js';

dotenvConfig();

function getEnvString(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvNumber(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a number`);
  }
  return parsed;
}

function getEnvBoolean(key: string, defaultValue?: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value.toLowerCase() === 'true';
}

export function loadConfig(): Config {
  const rawConfig = {
    lmStudio: {
      baseUrl: getEnvString('LM_STUDIO_BASE_URL', 'http://localhost:1234/v1'),
      ocrModel: getEnvString('LM_STUDIO_OCR_MODEL', 'allenai/olmocr-2-7b'),
      llmModel: getEnvString('LM_STUDIO_LLM_MODEL', 'qwen2.5-7b-instruct'),
      embeddingModel: getEnvString(
        'LM_STUDIO_EMBEDDING_MODEL',
        'text-embedding-nomic-embed-text-v1.5'
      ),
    },
    qdrant: {
      url: getEnvString('QDRANT_URL', 'http://localhost:6333'),
      collection: getEnvString('QDRANT_COLLECTION', 'medicaid_chunks'),
    },
    postgres: {
      host: getEnvString('POSTGRES_HOST', 'localhost'),
      port: getEnvNumber('POSTGRES_PORT', 5432),
      database: getEnvString('POSTGRES_DB', 'medicaid_rag'),
      user: getEnvString('POSTGRES_USER', 'postgres'),
      password: getEnvString('POSTGRES_PASSWORD', 'postgres'),
    },
    rag: {
      chunkSize: getEnvNumber('CHUNK_SIZE', 512),
      chunkOverlap: getEnvNumber('CHUNK_OVERLAP', 64),
      vectorTopK: getEnvNumber('VECTOR_TOP_K', 20),
      bm25TopK: getEnvNumber('BM25_TOP_K', 20),
      rerankTopN: getEnvNumber('RERANK_TOP_N', 10),
      finalTopC: getEnvNumber('FINAL_TOP_C', 5),
    },
    cache: {
      enabled: getEnvBoolean('CACHE_ENABLED', true),
      ttlSeconds: getEnvNumber('CACHE_TTL_SECONDS', 3600),
    },
    logLevel: getEnvString('LOG_LEVEL', 'info') as Config['logLevel'],
  };

  return ConfigSchema.parse(rawConfig);
}

// Singleton config instance
let configInstance: Config | null = null;

export function getConfig(): Config {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

export function resetConfig(): void {
  configInstance = null;
}
