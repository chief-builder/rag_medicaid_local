import { QdrantClient } from '@qdrant/js-client-rest';
import { Config, QdrantError, SearchResult, ChunkMetadata } from '../types/index.js';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('qdrant');

export interface QdrantPayload {
  chunkId: string;
  documentId: string;
  content: string;
  pageNumber?: number;
  chunkIndex: number;
  metadata: ChunkMetadata;
  [key: string]: unknown; // Index signature for Qdrant compatibility
}

/**
 * Qdrant vector store client
 */
export class QdrantStore {
  private client: QdrantClient;
  private collectionName: string;
  private embeddingDimension: number;

  constructor(config: Config['qdrant']) {
    this.client = new QdrantClient({ url: config.url });
    this.collectionName = config.collection;
    this.embeddingDimension = config.embeddingDimension;
  }

  /**
   * Initialize the collection if it doesn't exist
   */
  async initialize(): Promise<void> {
    const dimension = this.embeddingDimension;
    try {
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(
        (c) => c.name === this.collectionName
      );

      if (!exists) {
        logger.info(
          { collection: this.collectionName, dimension },
          'Creating new Qdrant collection'
        );

        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: dimension,
            distance: 'Cosine',
          },
          optimizers_config: {
            default_segment_number: 2,
          },
          replication_factor: 1,
        });

        // Create payload indices for filtering
        await this.client.createPayloadIndex(this.collectionName, {
          field_name: 'documentId',
          field_schema: 'keyword',
        });

        await this.client.createPayloadIndex(this.collectionName, {
          field_name: 'chunkId',
          field_schema: 'keyword',
        });

        logger.info('Qdrant collection created successfully');
      } else {
        logger.debug({ collection: this.collectionName }, 'Collection exists');
      }
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Qdrant collection');
      throw new QdrantError('Failed to initialize Qdrant collection', error);
    }
  }

  /**
   * Upsert a vector with payload
   */
  async upsert(
    id: string,
    vector: number[],
    payload: QdrantPayload
  ): Promise<void> {
    try {
      await this.client.upsert(this.collectionName, {
        wait: true,
        points: [
          {
            id,
            vector,
            payload,
          },
        ],
      });

      logger.debug({ id }, 'Vector upserted successfully');
    } catch (error) {
      logger.error({ error, id }, 'Failed to upsert vector');
      throw new QdrantError('Failed to upsert vector', error);
    }
  }

  /**
   * Batch upsert vectors
   */
  async upsertBatch(
    points: Array<{
      id: string;
      vector: number[];
      payload: QdrantPayload;
    }>
  ): Promise<void> {
    try {
      logger.debug({ count: points.length }, 'Batch upserting vectors');

      // Process in batches of 100
      const batchSize = 100;
      for (let i = 0; i < points.length; i += batchSize) {
        const batch = points.slice(i, i + batchSize);
        await this.client.upsert(this.collectionName, {
          wait: true,
          points: batch,
        });
        logger.debug(
          { processed: Math.min(i + batchSize, points.length), total: points.length },
          'Batch progress'
        );
      }

      logger.info({ count: points.length }, 'Batch upsert complete');
    } catch (error) {
      logger.error({ error }, 'Failed to batch upsert vectors');
      throw new QdrantError('Failed to batch upsert vectors', error);
    }
  }

  /**
   * Search for similar vectors
   */
  async search(
    queryVector: number[],
    topK: number,
    filter?: {
      documentId?: string;
    }
  ): Promise<SearchResult[]> {
    try {
      logger.debug({ topK, hasFilter: !!filter }, 'Searching vectors');

      const searchParams: Parameters<QdrantClient['search']>[1] = {
        vector: queryVector,
        limit: topK,
        with_payload: true,
      };

      if (filter?.documentId) {
        searchParams.filter = {
          must: [
            {
              key: 'documentId',
              match: { value: filter.documentId },
            },
          ],
        };
      }

      const results = await this.client.search(this.collectionName, searchParams);

      const searchResults: SearchResult[] = results.map((result) => {
        const payload = result.payload as unknown as QdrantPayload;
        return {
          chunkId: payload.chunkId,
          documentId: payload.documentId,
          content: payload.content,
          pageNumber: payload.pageNumber,
          chunkIndex: payload.chunkIndex,
          metadata: payload.metadata,
          score: result.score,
          source: 'vector' as const,
        };
      });

      logger.debug({ resultCount: searchResults.length }, 'Vector search complete');

      return searchResults;
    } catch (error) {
      logger.error({ error }, 'Failed to search vectors');
      throw new QdrantError('Failed to search vectors', error);
    }
  }

  /**
   * Delete vectors by document ID
   */
  async deleteByDocument(documentId: string): Promise<void> {
    try {
      await this.client.delete(this.collectionName, {
        filter: {
          must: [
            {
              key: 'documentId',
              match: { value: documentId },
            },
          ],
        },
      });

      logger.info({ documentId }, 'Deleted vectors for document');
    } catch (error) {
      logger.error({ error, documentId }, 'Failed to delete vectors');
      throw new QdrantError('Failed to delete vectors', error);
    }
  }

  /**
   * Get collection info
   */
  async getCollectionInfo(): Promise<{
    vectorCount: number;
    status: string;
  }> {
    try {
      const info = await this.client.getCollection(this.collectionName);
      return {
        vectorCount: info.points_count || 0,
        status: info.status,
      };
    } catch (error) {
      // Check if collection doesn't exist (404)
      if (error instanceof Error && 'status' in error && (error as { status?: number }).status === 404) {
        return {
          vectorCount: 0,
          status: 'not_created',
        };
      }
      logger.error({ error }, 'Failed to get collection info');
      throw new QdrantError('Failed to get collection info', error);
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.getCollections();
      return true;
    } catch (error) {
      logger.error({ error }, 'Qdrant health check failed');
      return false;
    }
  }
}

// Singleton instance
let storeInstance: QdrantStore | null = null;

export function getQdrantStore(config: Config['qdrant']): QdrantStore {
  if (!storeInstance) {
    storeInstance = new QdrantStore(config);
  }
  return storeInstance;
}

export function resetQdrantStore(): void {
  storeInstance = null;
}
