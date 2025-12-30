import express, { Request, Response, NextFunction, Express } from 'express';
import http from 'http';
import { Config, QueryRequest, RagError } from '../types/index.js';
import { createRetrievalPipeline, RetrievalPipeline } from '../retrieval/pipeline.js';
import { createIngestionPipeline, IngestionPipeline } from '../ingestion/pipeline.js';
import { getPostgresStore } from '../clients/postgres.js';
import { createChildLogger } from '../utils/logger.js';

interface ApiServer {
  app: Express;
  retrievalPipeline: RetrievalPipeline;
  ingestionPipeline: IngestionPipeline;
}

const logger = createChildLogger('api-server');

/**
 * Create and configure the Express API server
 */
export function createApiServer(config: Config): ApiServer {
  const app = express();
  app.use(express.json());

  // Initialize pipelines
  const retrievalPipeline = createRetrievalPipeline(config);
  const ingestionPipeline = createIngestionPipeline(config);

  // Request logging middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      logger.info({
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration: Date.now() - start,
      });
    });
    next();
  });

  // Health check endpoint
  app.get('/health', async (req: Request, res: Response) => {
    try {
      const stats = await ingestionPipeline.getStats();
      res.json({
        status: 'healthy',
        documentCount: stats.documentCount,
        vectorCount: stats.vectorCount,
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Query endpoint
  app.post('/query', async (req: Request, res: Response) => {
    try {
      const { query, useCache } = req.body as QueryRequest;

      if (!query || typeof query !== 'string') {
        res.status(400).json({ error: 'Query is required' });
        return;
      }

      // Validate query length and content
      const trimmedQuery = query.trim();
      if (trimmedQuery.length === 0) {
        res.status(400).json({ error: 'Query cannot be empty' });
        return;
      }
      if (trimmedQuery.length > 10000) {
        res.status(400).json({ error: 'Query too long (max 10000 characters)' });
        return;
      }

      const response = await retrievalPipeline.query(trimmedQuery, { useCache });

      res.json(response);
    } catch (error) {
      logger.error({ error }, 'Query failed');
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Query failed',
      });
    }
  });

  // Ingest single file endpoint
  app.post('/ingest/file', async (req: Request, res: Response) => {
    try {
      const { filepath } = req.body;

      if (!filepath || typeof filepath !== 'string') {
        res.status(400).json({ error: 'filepath is required' });
        return;
      }

      await ingestionPipeline.initialize();
      const result = await ingestionPipeline.ingestFile(filepath);

      // Invalidate retrieval cache so new documents are visible
      retrievalPipeline.invalidateMetadataCache();

      res.json({
        documentId: result.document.id,
        filename: result.document.filename,
        chunkCount: result.chunks.length,
      });
    } catch (error) {
      logger.error({ error }, 'Ingestion failed');
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Ingestion failed',
      });
    }
  });

  // Ingest directory endpoint
  app.post('/ingest/directory', async (req: Request, res: Response) => {
    try {
      const { dirPath, recursive, saveMarkdown } = req.body;

      if (!dirPath || typeof dirPath !== 'string') {
        res.status(400).json({ error: 'dirPath is required' });
        return;
      }

      await ingestionPipeline.initialize();
      const stats = await ingestionPipeline.ingestDirectory(dirPath, {
        recursive,
        saveMarkdown,
      });

      // Invalidate retrieval cache so new documents are visible
      retrievalPipeline.invalidateMetadataCache();

      res.json(stats);
    } catch (error) {
      logger.error({ error }, 'Directory ingestion failed');
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Ingestion failed',
      });
    }
  });

  // Get metrics endpoint
  app.get('/metrics', async (req: Request, res: Response) => {
    try {
      const metrics = await retrievalPipeline.getMetrics();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get metrics',
      });
    }
  });

  // Error handling middleware
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    logger.error({ error: err }, 'Unhandled error');

    if (err instanceof RagError) {
      res.status(400).json({
        error: err.message,
        code: err.code,
      });
      return;
    }

    res.status(500).json({
      error: 'Internal server error',
    });
  });

  return { app, retrievalPipeline, ingestionPipeline };
}

/**
 * Start the API server with graceful shutdown
 */
export async function startServer(config: Config, port: number = 3000): Promise<void> {
  const { app, ingestionPipeline } = createApiServer(config);

  // Initialize the ingestion pipeline
  await ingestionPipeline.initialize();

  const server = http.createServer(app);

  // Graceful shutdown handler
  const gracefulShutdown = async (signal: string) => {
    logger.info({ signal }, 'Received shutdown signal, closing connections...');

    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        // Close database connections
        const postgres = getPostgresStore(config.postgres);
        await postgres.close();
        logger.info('Database connections closed');
      } catch (error) {
        logger.error({ error }, 'Error closing database connections');
      }

      process.exit(0);
    });

    // Force exit if graceful shutdown takes too long
    setTimeout(() => {
      logger.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, 10000);
  };

  // Register shutdown handlers
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  server.listen(port, () => {
    logger.info({ port }, 'API server started');
  });
}
