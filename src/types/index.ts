import { z } from 'zod';

// ============================================================
// Configuration Types
// ============================================================

export const ConfigSchema = z.object({
  lmStudio: z.object({
    baseUrl: z.string().url(),
    ocrModel: z.string(),
    llmModel: z.string(),
    embeddingModel: z.string(),
  }),
  qdrant: z.object({
    url: z.string().url(),
    collection: z.string(),
    embeddingDimension: z.number().min(64).max(4096),
  }),
  postgres: z.object({
    host: z.string(),
    port: z.number(),
    database: z.string(),
    user: z.string(),
    password: z.string(),
  }),
  rag: z.object({
    chunkSize: z.number().min(100).max(2000),
    chunkOverlap: z.number().min(0).max(500),
    vectorTopK: z.number().min(1).max(100),
    bm25TopK: z.number().min(1).max(100),
    rerankTopN: z.number().min(1).max(50),
    finalTopC: z.number().min(1).max(20),
  }),
  cache: z.object({
    enabled: z.boolean(),
    ttlSeconds: z.number(),
  }),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']),
});

export type Config = z.infer<typeof ConfigSchema>;

// ============================================================
// Document Types
// ============================================================

/**
 * Document type classifications for Pennsylvania Medicaid sources
 */
export type DocumentType =
  | 'msp_guide'
  | 'income_limits'
  | 'ltc_info'
  | 'estate_recovery'
  | 'pace_pacenet'
  | 'life_program'
  | 'chc_waiver'
  | 'general_eligibility'
  | 'dual_eligible'
  | 'extra_help'
  // Phase 1 additions
  | 'oim_ltc_handbook'
  | 'oim_ma_handbook'
  | 'oim_ops_memo'
  | 'oim_policy_clarification'
  | 'pa_code'
  | 'pa_bulletin'
  // Phase 2 (future)
  | 'chc_publications'
  | 'chc_handbook'
  | 'policy_index';

/**
 * Source authority classification
 */
export type SourceAuthority = 'primary' | 'secondary';

/**
 * Legal weight of a document
 */
export type LegalWeight = 'regulatory' | 'guidance' | 'informational';

/**
 * Source format for documents
 */
export type SourceFormat =
  | 'pdf'
  | 'html_multipage'
  | 'html_list'
  | 'html_structured'
  | 'html_filtered';

export interface Document {
  id: string;
  filename: string;
  filepath: string;
  fileHash: string;
  title?: string;
  totalPages?: number;
  ingestedAt: Date;
  metadata: Record<string, unknown>;
  // Enhanced fields for Phase 1
  documentType?: DocumentType;
  sourceAuthority?: SourceAuthority;
  legalWeight?: LegalWeight;
  sourceFormat?: SourceFormat;
  effectiveDate?: Date;
}

export interface DocumentInput {
  filename: string;
  filepath: string;
  fileHash: string;
  title?: string;
  totalPages?: number;
  metadata?: Record<string, unknown>;
  // Enhanced fields for Phase 1
  documentType?: DocumentType;
  sourceAuthority?: SourceAuthority;
  legalWeight?: LegalWeight;
  sourceFormat?: SourceFormat;
  effectiveDate?: Date;
}

// ============================================================
// Chunk Types
// ============================================================

export interface Chunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  pageNumber?: number;
  startChar?: number;
  endChar?: number;
  metadata: ChunkMetadata;
  createdAt: Date;
}

export interface ChunkMetadata {
  filename?: string;
  title?: string;
  section?: string;
  pageNumbers?: number[];
  [key: string]: unknown;
}

export interface ChunkInput {
  documentId: string;
  chunkIndex: number;
  content: string;
  pageNumber?: number;
  startChar?: number;
  endChar?: number;
  metadata?: ChunkMetadata;
}

// ============================================================
// Embedding Types
// ============================================================

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  tokenCount?: number;
}

export interface EmbeddingCacheEntry {
  id: string;
  contentHash: string;
  embedding: number[];
  model: string;
  createdAt: Date;
}

// ============================================================
// Search & Retrieval Types
// ============================================================

export interface SearchResult {
  chunkId: string;
  documentId: string;
  content: string;
  pageNumber?: number;
  chunkIndex: number;
  metadata: ChunkMetadata;
  score: number;
  source: 'vector' | 'bm25';
}

export interface FusedResult extends Omit<SearchResult, 'source'> {
  vectorScore?: number;
  bm25Score?: number;
  rrfScore: number;
  sources: ('vector' | 'bm25')[];
}

export interface RerankedResult extends FusedResult {
  rerankScore: number;
}

// ============================================================
// Citation Types
// ============================================================

export interface Citation {
  chunkId: string;
  documentId: string;
  filename: string;
  title?: string;
  pageNumber?: number;
  chunkIndex: number;
  excerpt: string;
}

export interface AnswerWithCitations {
  answer: string;
  citations: Citation[];
  confidence: number;
  queryId: string;
}

// ============================================================
// Query Types
// ============================================================

export interface QueryRequest {
  query: string;
  topK?: number;
  useCache?: boolean;
}

export interface QueryResponse extends AnswerWithCitations {
  latencyMs: number;
  retrievalStats: {
    vectorResults: number;
    bm25Results: number;
    fusedResults: number;
    rerankedResults: number;
    finalResults: number;
  };
}

// ============================================================
// OCR Types
// ============================================================

export interface OcrPage {
  pageNumber: number;
  markdown: string;
  confidence?: number;
}

export interface OcrResult {
  filename: string;
  pages: OcrPage[];
  fullMarkdown: string;
  totalPages: number;
}

// ============================================================
// Logging Types
// ============================================================

export interface QueryLog {
  id: string;
  queryText: string;
  responseText?: string;
  vectorResults: number;
  bm25Results: number;
  fusedResults: number;
  rerankedResults: number;
  finalResults: number;
  latencyMs: number;
  hasAnswer: boolean;
  createdAt: Date;
}

// ============================================================
// Error Types
// ============================================================

export class RagError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'RagError';
  }
}

export class LMStudioError extends RagError {
  constructor(message: string, details?: unknown) {
    super(message, 'LM_STUDIO_ERROR', details);
    this.name = 'LMStudioError';
  }
}

export class QdrantError extends RagError {
  constructor(message: string, details?: unknown) {
    super(message, 'QDRANT_ERROR', details);
    this.name = 'QdrantError';
  }
}

export class PostgresError extends RagError {
  constructor(message: string, details?: unknown) {
    super(message, 'POSTGRES_ERROR', details);
    this.name = 'PostgresError';
  }
}
