/**
 * Frontend types for the PA Medicaid Assistant
 * Re-exports shared API types and defines frontend-specific types
 */

// Re-export all shared API types
export type {
  DocumentType,
  SourceAuthority,
  LegalWeight,
  SensitiveCategory,
  QueryRequest,
  Citation,
  RetrievalStats,
  FreshnessWarning,
  FreshnessInfo,
  DisclaimerInfo,
  QueryResponse,
  HealthResponse,
  MetricsResponse,
} from '@shared/api-types';

// ============================================
// UI State Types (Frontend-specific)
// ============================================

export type UserMode = 'senior' | 'caregiver';

// Import types we need for Message interface
import type {
  Citation,
  RetrievalStats,
  FreshnessInfo,
  DisclaimerInfo,
} from '@shared/api-types';

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
// Help Resources (Frontend-specific)
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
// Quick Topic Cards (Frontend-specific)
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
// Utility Types (Frontend-specific)
// ============================================

export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string };
