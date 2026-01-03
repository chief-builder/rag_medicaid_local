import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  render,
  createMockUserMessage,
  createMockAssistantMessage,
  createMockLoadingMessage,
  createMockErrorMessage,
  createMockCitation,
  createMockRetrievalStats,
  createMockFreshnessInfo,
  createMockDisclaimerInfo,
  createMockCompleteAssistantMessage,
} from '../test/test-utils';
import { MessageBubble } from './MessageBubble';

// Mock useUserMode to control caregiver/senior mode
const mockIsCaregiver = vi.fn(() => false);
vi.mock('../hooks/useUserMode', () => ({
  useUserMode: () => ({
    mode: mockIsCaregiver() ? 'caregiver' : 'senior',
    isCaregiver: mockIsCaregiver(),
    isSenior: !mockIsCaregiver(),
    toggleMode: vi.fn(),
    setMode: vi.fn(),
  }),
}));

describe('MessageBubble', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCaregiver.mockReturnValue(false);
  });

  describe('User Messages', () => {
    it('renders user message content', () => {
      const message = createMockUserMessage('What are QMB income limits?');
      render(<MessageBubble message={message} />);

      expect(screen.getByText('What are QMB income limits?')).toBeInTheDocument();
    });

    it('has correct role and aria-label for user messages', () => {
      const message = createMockUserMessage('Test question');
      render(<MessageBubble message={message} />);

      const article = screen.getByRole('article');
      expect(article).toHaveAttribute('aria-label', expect.stringContaining('Your question'));
    });

    it('displays formatted timestamp', () => {
      const message = createMockUserMessage('Test');
      render(<MessageBubble message={message} />);

      // Check time element exists
      const timeElement = document.querySelector('time');
      expect(timeElement).toBeInTheDocument();
      expect(timeElement).toHaveAttribute('dateTime');
    });
  });

  describe('Assistant Messages', () => {
    it('renders assistant message content', () => {
      const message = createMockAssistantMessage('The QMB income limit is $1,255 per month.');
      render(<MessageBubble message={message} />);

      expect(
        screen.getByText('The QMB income limit is $1,255 per month.')
      ).toBeInTheDocument();
    });

    it('has correct role and aria-label for assistant messages', () => {
      const message = createMockAssistantMessage('Test answer');
      render(<MessageBubble message={message} />);

      const article = screen.getByRole('article');
      expect(article).toHaveAttribute('aria-label', expect.stringContaining('Answer'));
    });

    it('renders paragraphs for multi-line content', () => {
      const message = createMockAssistantMessage('First paragraph.\nSecond paragraph.');
      render(<MessageBubble message={message} />);

      expect(screen.getByText('First paragraph.')).toBeInTheDocument();
      expect(screen.getByText('Second paragraph.')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('displays loading indicator', () => {
      const message = createMockLoadingMessage();
      render(<MessageBubble message={message} />);

      expect(screen.getByText('Finding your answer...')).toBeInTheDocument();
    });

    it('has accessible loading status', () => {
      const message = createMockLoadingMessage();
      render(<MessageBubble message={message} />);

      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-label', 'Finding your answer');
    });

    it('shows animated dots', () => {
      const message = createMockLoadingMessage();
      render(<MessageBubble message={message} />);

      // Check for the loading dots container
      const dots = document.querySelectorAll('span');
      expect(dots.length).toBeGreaterThan(0);
    });
  });

  describe('Error State', () => {
    it('displays error message', () => {
      const message = createMockErrorMessage('Failed to connect to server');
      render(<MessageBubble message={message} />);

      expect(screen.getByText('Failed to connect to server')).toBeInTheDocument();
    });

    it('shows error title', () => {
      const message = createMockErrorMessage('Network error');
      render(<MessageBubble message={message} />);

      expect(screen.getByText("We couldn't find an answer")).toBeInTheDocument();
    });

    it('has accessible alert role', () => {
      const message = createMockErrorMessage('Error');
      render(<MessageBubble message={message} />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('shows PHLP contact for help', () => {
      const message = createMockErrorMessage('Error');
      render(<MessageBubble message={message} />);

      expect(screen.getByText('1-800-274-3258')).toBeInTheDocument();
    });
  });

  describe('Simple View (Senior Mode)', () => {
    beforeEach(() => {
      mockIsCaregiver.mockReturnValue(false);
    });

    it('does not show citations in simple view', () => {
      const message = createMockAssistantMessage('Answer', {
        citations: [createMockCitation()],
      });
      render(<MessageBubble message={message} />);

      expect(screen.queryByText(/Sources/)).not.toBeInTheDocument();
    });

    it('does not show retrieval stats in simple view', () => {
      const message = createMockAssistantMessage('Answer', {
        retrievalStats: createMockRetrievalStats(),
      });
      render(<MessageBubble message={message} />);

      expect(screen.queryByText(/Retrieval Stats/)).not.toBeInTheDocument();
    });

    it('does not show freshness info in simple view', () => {
      const message = createMockAssistantMessage('Answer', {
        freshnessInfo: createMockFreshnessInfo(),
      });
      render(<MessageBubble message={message} />);

      expect(screen.queryByText(/January 15, 2024/)).not.toBeInTheDocument();
    });

    it('strips source info text from content in simple view', () => {
      const message = createMockAssistantMessage(
        'Main answer here.\n---\n**Source Information**\nDetails about sources.'
      );
      render(<MessageBubble message={message} />);

      expect(screen.getByText('Main answer here.')).toBeInTheDocument();
      expect(screen.queryByText('Source Information')).not.toBeInTheDocument();
    });
  });

  describe('Detailed View (Caregiver Mode)', () => {
    beforeEach(() => {
      mockIsCaregiver.mockReturnValue(true);
    });

    it('shows citations in detailed view', () => {
      const message = createMockAssistantMessage('Answer', {
        citations: [createMockCitation({ filename: 'MSP_Guide.pdf' })],
      });
      render(<MessageBubble message={message} />);

      expect(screen.getByText(/Sources \(1\)/)).toBeInTheDocument();
    });

    it('shows retrieval stats in detailed view', () => {
      const message = createMockAssistantMessage('Answer', {
        retrievalStats: createMockRetrievalStats({ vectorResults: 10 }),
      });
      render(<MessageBubble message={message} />);

      expect(screen.getByText('Retrieval Stats:')).toBeInTheDocument();
      expect(screen.getByText('Vector: 10')).toBeInTheDocument();
    });

    it('shows latency in detailed view when available', () => {
      const message = createMockAssistantMessage('Answer', {
        retrievalStats: createMockRetrievalStats(),
        latencyMs: 450,
      });
      render(<MessageBubble message={message} />);

      expect(screen.getByText('Latency: 450ms')).toBeInTheDocument();
    });

    it('shows confidence in detailed view when available', () => {
      const message = createMockAssistantMessage('Answer', {
        retrievalStats: createMockRetrievalStats(),
        confidence: 0.92,
      });
      render(<MessageBubble message={message} />);

      expect(screen.getByText('Confidence: 92%')).toBeInTheDocument();
    });

    it('shows freshness badge in detailed view', () => {
      const message = createMockAssistantMessage('Answer', {
        freshnessInfo: createMockFreshnessInfo({
          effectivePeriod: '2024',
        }),
      });
      render(<MessageBubble message={message} />);

      // FreshnessBadge shows "Data current as of" text
      expect(screen.getByText(/Data current as of/i)).toBeInTheDocument();
    });
  });

  describe('Disclaimers', () => {
    it('shows disclaimer banner when disclaimer is present', () => {
      const message = createMockAssistantMessage('Answer', {
        disclaimer: createMockDisclaimerInfo(),
      });
      render(<MessageBubble message={message} />);

      expect(
        screen.getByText(/This involves complex legal matters/i)
      ).toBeInTheDocument();
    });

    it('shows disclaimer in both simple and detailed view', () => {
      mockIsCaregiver.mockReturnValue(false);
      const message = createMockAssistantMessage('Answer', {
        disclaimer: createMockDisclaimerInfo(),
      });
      render(<MessageBubble message={message} />);

      expect(
        screen.getByText(/This involves complex legal matters/i)
      ).toBeInTheDocument();
    });
  });

  describe('Complete Message', () => {
    it('renders a fully loaded message with all metadata in detailed view', () => {
      mockIsCaregiver.mockReturnValue(true);
      const message = createMockCompleteAssistantMessage();
      render(<MessageBubble message={message} />);

      // Main content
      expect(screen.getByText(/The QMB income limit/)).toBeInTheDocument();

      // Citations
      expect(screen.getByText(/Sources \(2\)/)).toBeInTheDocument();

      // Stats
      expect(screen.getByText('Retrieval Stats:')).toBeInTheDocument();

      // Confidence and latency
      expect(screen.getByText('Confidence: 92%')).toBeInTheDocument();
      expect(screen.getByText('Latency: 450ms')).toBeInTheDocument();
    });
  });
});
