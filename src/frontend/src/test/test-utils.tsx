import { render, type RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserModeProvider } from '../context/UserModeContext';
import type { Message, Citation, FreshnessInfo, DisclaimerInfo, RetrievalStats } from '../types';

/**
 * Create a new QueryClient for testing
 */
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * All providers wrapper for tests
 */
function AllProviders({ children }: { children: React.ReactNode }) {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <UserModeProvider>{children}</UserModeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

/**
 * Custom render function that wraps components with all providers
 */
function customRender(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

// Re-export everything from testing-library
export * from '@testing-library/react';
export { customRender as render };

// ============================================
// Mock Data Factories
// ============================================

/**
 * Create a mock user message
 */
export function createMockUserMessage(content = 'Test question'): Message {
  return {
    id: `msg-user-${Date.now()}`,
    type: 'user',
    content,
    timestamp: new Date('2024-01-15T10:30:00'),
  };
}

/**
 * Create a mock assistant message
 */
export function createMockAssistantMessage(
  content = 'Test answer',
  options: Partial<Message> = {}
): Message {
  return {
    id: `msg-assistant-${Date.now()}`,
    type: 'assistant',
    content,
    timestamp: new Date('2024-01-15T10:30:05'),
    ...options,
  };
}

/**
 * Create a mock loading message
 */
export function createMockLoadingMessage(): Message {
  return {
    id: `msg-loading-${Date.now()}`,
    type: 'assistant',
    content: '',
    timestamp: new Date(),
    isLoading: true,
  };
}

/**
 * Create a mock error message
 */
export function createMockErrorMessage(error = 'Something went wrong'): Message {
  return {
    id: `msg-error-${Date.now()}`,
    type: 'assistant',
    content: '',
    timestamp: new Date(),
    error,
  };
}

/**
 * Create a mock citation
 */
export function createMockCitation(overrides: Partial<Citation> = {}): Citation {
  return {
    index: 1,
    chunkId: 'chunk-123',
    documentId: 'doc-456',
    filename: 'MSP_Income_Limits_2024.pdf',
    title: 'Medicare Savings Program Income Limits',
    pageNumber: 5,
    chunkIndex: 2,
    content: 'The QMB income limit for 2024 is 100% of the Federal Poverty Level.',
    documentType: 'income_limits',
    sourceAuthority: 'primary',
    legalWeight: 'regulatory',
    ...overrides,
  };
}

/**
 * Create mock retrieval stats
 */
export function createMockRetrievalStats(
  overrides: Partial<RetrievalStats> = {}
): RetrievalStats {
  return {
    vectorResults: 10,
    bm25Results: 10,
    fusedResults: 15,
    rerankedResults: 10,
    finalResults: 5,
    ...overrides,
  };
}

/**
 * Create mock freshness info
 */
export function createMockFreshnessInfo(
  overrides: Partial<FreshnessInfo> = {}
): FreshnessInfo {
  return {
    lastRetrieved: '2024-01-15T10:00:00Z',
    lastRetrievedFormatted: 'January 15, 2024',
    effectivePeriod: '2024',
    incomeLimitsEffective: 'January 1, 2024',
    hasStaleData: false,
    warningCount: 0,
    ...overrides,
  };
}

/**
 * Create mock disclaimer info
 */
export function createMockDisclaimerInfo(
  overrides: Partial<DisclaimerInfo> = {}
): DisclaimerInfo {
  return {
    category: 'estate_planning',
    text: 'This involves complex legal matters. Consider consulting with an elder law attorney.',
    referral: 'Elder Law Attorney: 1-800-932-0311',
    ...overrides,
  };
}

/**
 * Create a complete mock assistant message with all metadata
 */
export function createMockCompleteAssistantMessage(): Message {
  return createMockAssistantMessage(
    'The QMB income limit for 2024 is 100% of the Federal Poverty Level, which is $1,255 per month for an individual.',
    {
      citations: [createMockCitation(), createMockCitation({ index: 2, filename: 'SLMB_Guide.pdf' })],
      retrievalStats: createMockRetrievalStats(),
      freshnessInfo: createMockFreshnessInfo(),
      confidence: 0.92,
      latencyMs: 450,
    }
  );
}
