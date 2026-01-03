/**
 * Shared API types between backend and frontend
 * This file contains only pure TypeScript types with no runtime dependencies
 */

// ============================================
// Document Classification Types
// ============================================

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
  | 'oim_ltc_handbook'
  | 'oim_ma_handbook'
  | 'oim_ops_memo'
  | 'oim_policy_clarification'
  | 'pa_code'
  | 'pa_bulletin'
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
 * Sensitive topic categories requiring disclaimers
 */
export type SensitiveCategory =
  | 'estate_planning'
  | 'spend_down'
  | 'asset_transfer'
  | 'spousal_complex'
  | 'appeals'
  | 'look_back_period';

// ============================================
// API Request/Response Types
// ============================================

export interface QueryRequest {
  query: string;
  topK?: number;
  useCache?: boolean;
}

export interface Citation {
  index?: number;
  chunkId?: string;
  documentId?: string;
  filename: string;
  title?: string;
  pageNumber?: number;
  chunkIndex?: number;
  content?: string;
  excerpt?: string;
  documentType?: DocumentType;
  sourceAuthority?: SourceAuthority;
  legalWeight?: LegalWeight;
}

export interface RetrievalStats {
  vectorResults: number;
  bm25Results: number;
  fusedResults: number;
  rerankedResults: number;
  finalResults: number;
}

export interface FreshnessWarning {
  dataType: string;
  message: string;
  lastUpdate?: string;
  expectedUpdate?: string;
}

export interface FreshnessInfo {
  lastRetrieved?: string;
  lastRetrievedFormatted?: string;
  effectivePeriod?: string;
  incomeLimitsEffective?: string;
  hasStaleData: boolean;
  warningCount: number;
  warnings?: FreshnessWarning[];
}

export interface DisclaimerInfo {
  category: SensitiveCategory;
  text: string;
  referral?: string;
}

export interface QueryResponse {
  answer: string;
  citations: Citation[];
  confidence: number;
  queryId: string;
  latencyMs: number;
  retrievalStats: RetrievalStats;
  freshnessInfo?: FreshnessInfo;
  disclaimer?: DisclaimerInfo;
}

export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  documentCount?: number;
  vectorCount?: number;
  error?: string;
}

export interface MetricsResponse {
  totalQueries: number;
  avgLatencyMs: number;
  noAnswerRate: number;
}
