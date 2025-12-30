import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

// Mock the dependencies before importing the server
vi.mock('../retrieval/pipeline.js', () => ({
  createRetrievalPipeline: vi.fn(() => ({
    query: vi.fn().mockResolvedValue({
      answer: 'Test answer',
      citations: [
        {
          chunkId: 'chunk-1',
          documentId: 'doc-1',
          filename: 'test.pdf',
          pageNumber: 1,
          chunkIndex: 0,
          excerpt: 'Test excerpt...',
        },
      ],
      confidence: 85,
      queryId: 'query-123',
      latencyMs: 150,
      retrievalStats: {
        vectorResults: 10,
        bm25Results: 10,
        fusedResults: 15,
        rerankedResults: 5,
        finalResults: 3,
      },
    }),
    getMetrics: vi.fn().mockResolvedValue({
      totalQueries: 100,
      avgLatencyMs: 200,
      noAnswerRate: 0.1,
    }),
    invalidateMetadataCache: vi.fn(),
  })),
}));

vi.mock('../ingestion/pipeline.js', () => ({
  createIngestionPipeline: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    ingestFile: vi.fn().mockResolvedValue({
      document: {
        id: 'doc-1',
        filename: 'test.pdf',
        title: 'Test Document',
      },
      chunks: [{ id: 'chunk-1' }, { id: 'chunk-2' }],
    }),
    ingestDirectory: vi.fn().mockResolvedValue({
      documentsProcessed: 5,
      documentsSkipped: 1,
      chunksCreated: 50,
      vectorsStored: 50,
      errors: [],
    }),
    getStats: vi.fn().mockResolvedValue({
      documentCount: 10,
      vectorCount: 100,
    }),
  })),
}));

vi.mock('../config/index.js', () => ({
  getConfig: vi.fn(() => ({
    lmStudio: {
      baseUrl: 'http://localhost:1234/v1',
      ocrModel: 'test-ocr',
      llmModel: 'test-llm',
      embeddingModel: 'test-embed',
    },
    qdrant: {
      url: 'http://localhost:6333',
      collection: 'test',
      embeddingDimension: 1024,
    },
    postgres: {
      host: 'localhost',
      port: 5432,
      database: 'test',
      user: 'test',
      password: 'test',
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
      ttlSeconds: 3600,
    },
    logLevel: 'info',
  })),
}));

vi.mock('../utils/logger.js', () => ({
  createChildLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

// Import after mocks are set up
import { createApiServer } from './server.js';
import { getConfig } from '../config/index.js';

describe('API Server', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    const config = getConfig();
    const server = createApiServer(config);
    app = server.app;
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.documentCount).toBe(10);
      expect(response.body.vectorCount).toBe(100);
    });
  });

  describe('POST /query', () => {
    it('should process a query and return answer with citations', async () => {
      const response = await request(app)
        .post('/query')
        .send({ query: 'What are Medicaid eligibility requirements?' });

      expect(response.status).toBe(200);
      expect(response.body.answer).toBe('Test answer');
      expect(response.body.citations).toHaveLength(1);
      expect(response.body.queryId).toBe('query-123');
      expect(response.body.latencyMs).toBe(150);
    });

    it('should return 400 for missing query', async () => {
      const response = await request(app).post('/query').send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Query is required');
    });

    it('should return 400 for invalid query type', async () => {
      const response = await request(app).post('/query').send({ query: 123 });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /ingest/file', () => {
    it('should ingest a file', async () => {
      const response = await request(app)
        .post('/ingest/file')
        .send({ filepath: '/path/to/test.pdf' });

      expect(response.status).toBe(200);
      expect(response.body.documentId).toBe('doc-1');
      expect(response.body.filename).toBe('test.pdf');
      expect(response.body.chunkCount).toBe(2);
    });

    it('should return 400 for missing filepath', async () => {
      const response = await request(app).post('/ingest/file').send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('filepath is required');
    });
  });

  describe('POST /ingest/directory', () => {
    it('should ingest a directory', async () => {
      const response = await request(app).post('/ingest/directory').send({
        dirPath: '/path/to/pdfs',
        recursive: true,
      });

      expect(response.status).toBe(200);
      expect(response.body.documentsProcessed).toBe(5);
      expect(response.body.chunksCreated).toBe(50);
    });

    it('should return 400 for missing dirPath', async () => {
      const response = await request(app).post('/ingest/directory').send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('dirPath is required');
    });
  });

  describe('GET /metrics', () => {
    it('should return query metrics', async () => {
      const response = await request(app).get('/metrics');

      expect(response.status).toBe(200);
      expect(response.body.totalQueries).toBe(100);
      expect(response.body.avgLatencyMs).toBe(200);
      expect(response.body.noAnswerRate).toBe(0.1);
    });
  });
});
