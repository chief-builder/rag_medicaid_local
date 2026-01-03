/**
 * Shared TypeScript types for the PA Medicaid Assistant frontend
 * These mirror the backend API response types
 */

// ============================================
// API Request/Response Types
// ============================================

export interface QueryRequest {
  query: string;
  useCache?: boolean;
}

export interface Citation {
  index: number;
  filename: string;
  pageNumber: number;
  content: string;
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

export interface FreshnessInfo {
  lastRetrieved?: string;
  effectivePeriod?: string;
  incomeLimitsEffective?: string;
  hasStaleData: boolean;
  warningCount: number;
  warnings?: FreshnessWarning[];
}

export interface FreshnessWarning {
  dataType: string;
  message: string;
  lastUpdate?: string;
  expectedUpdate?: string;
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

export interface DisclaimerInfo {
  category: SensitiveCategory;
  text: string;
  referral?: string;
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

// ============================================
// Document Classification Types
// ============================================

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
  | 'pa_bulletin';

export type SourceAuthority = 'primary' | 'secondary';

export type LegalWeight = 'regulatory' | 'guidance' | 'informational';

export type SensitiveCategory =
  | 'estate_planning'
  | 'spend_down'
  | 'asset_transfer'
  | 'spousal_complex'
  | 'appeals'
  | 'look_back_period';

// ============================================
// UI State Types
// ============================================

export type UserMode = 'senior' | 'caregiver';

export interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  citations?: Citation[];
  retrievalStats?: RetrievalStats;
  freshnessInfo?: FreshnessInfo;
  disclaimer?: DisclaimerInfo;
  confidence?: number;
  latencyMs?: number;
  isLoading?: boolean;
  error?: string;
}

export interface Conversation {
  id: string;
  messages: Message[];
  createdAt: Date;
}

// ============================================
// Help Resources
// ============================================

export interface HelpResource {
  name: string;
  description: string;
  phone: string;
  hours?: string;
  website?: string;
}

export const HELP_RESOURCES: HelpResource[] = [
  {
    name: 'Pennsylvania Health Law Project (PHLP)',
    description: 'Free help with Medicaid questions',
    phone: '1-800-274-3258',
    hours: 'Mon-Fri 9am-5pm',
    website: 'https://www.phlp.org',
  },
  {
    name: 'Elder Law Attorney Referral',
    description: 'Legal advice for seniors',
    phone: '1-800-932-0311',
    hours: 'Mon-Fri 9am-5pm',
  },
  {
    name: 'PA Legal Aid Network',
    description: 'Free legal assistance',
    phone: '1-800-322-7572',
    hours: 'Mon-Fri 8:30am-5pm',
    website: 'https://palegalaid.net',
  },
  {
    name: 'Chester County CAO',
    description: 'Local Medicaid office',
    phone: '610-466-1000',
    hours: 'Mon-Fri 8am-4:30pm',
  },
  {
    name: 'APPRISE Medicare Counseling',
    description: 'Free Medicare help',
    phone: '610-344-6350',
    hours: 'By appointment',
  },
];

// ============================================
// Quick Topic Cards
// ============================================

export interface QuickTopic {
  id: string;
  title: string;
  description: string;
  sampleQuestions: string[];
  icon: string;
}

export const QUICK_TOPICS: QuickTopic[] = [
  {
    id: 'income-limits',
    title: 'Income Limits',
    description: 'Learn about income requirements for Medicaid programs',
    sampleQuestions: [
      'What are the income limits for QMB?',
      'How much can I earn and still qualify for SLMB?',
    ],
    icon: '💰',
  },
  {
    id: 'medicare-savings',
    title: 'Medicare Savings',
    description: 'Programs that help pay Medicare costs',
    sampleQuestions: [
      'What is the QMB program?',
      'How do I apply for Medicare Savings Programs?',
    ],
    icon: '🏥',
  },
  {
    id: 'long-term-care',
    title: 'Long-term Care',
    description: 'Nursing home and home care coverage',
    sampleQuestions: [
      'Does Medicaid cover nursing home care?',
      'What is the LIFE program?',
    ],
    icon: '🏠',
  },
  {
    id: 'prescription-help',
    title: 'Prescription Help',
    description: 'Assistance with medication costs',
    sampleQuestions: [
      'What is PACE/PACENET?',
      'How do I get Extra Help with prescriptions?',
    ],
    icon: '💊',
  },
];

// ============================================
// Utility Types
// ============================================

export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string };
