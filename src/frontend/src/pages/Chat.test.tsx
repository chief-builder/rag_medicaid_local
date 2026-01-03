import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../test/test-utils';
import Chat from './Chat';

// Mock the useQuery hook
vi.mock('../hooks/useQuery', () => ({
  useSubmitQuery: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
  createUserMessage: vi.fn((content: string) => ({
    id: `user-${Date.now()}`,
    type: 'user',
    content,
    timestamp: new Date(),
  })),
  createAssistantMessage: vi.fn((response: unknown) => ({
    id: `assistant-${Date.now()}`,
    type: 'assistant',
    content: (response as { answer: string }).answer,
    timestamp: new Date(),
  })),
  createLoadingMessage: vi.fn(() => ({
    id: `loading-${Date.now()}`,
    type: 'assistant',
    content: '',
    timestamp: new Date(),
    isLoading: true,
  })),
  createErrorMessage: vi.fn((error: string) => ({
    id: `error-${Date.now()}`,
    type: 'assistant',
    content: '',
    timestamp: new Date(),
    error,
  })),
}));

describe('Chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty State', () => {
    it('renders the empty state when no messages', () => {
      render(<Chat />);

      expect(screen.getByText('Ask a Question')).toBeInTheDocument();
      expect(
        screen.getByText(/Get answers about Pennsylvania Medicaid/i)
      ).toBeInTheDocument();
    });

    it('displays example questions', () => {
      render(<Chat />);

      expect(screen.getByText('Try asking:')).toBeInTheDocument();
      expect(
        screen.getByText('"What are the income limits for QMB?"')
      ).toBeInTheDocument();
      expect(
        screen.getByText('"How do I apply for Medicare Savings Programs?"')
      ).toBeInTheDocument();
    });

    it('shows PHLP contact information', () => {
      render(<Chat />);

      // Check for PHLP contact info in empty state
      expect(screen.getByText(/Need to speak with someone/i)).toBeInTheDocument();
      // Phone number appears as a link
      expect(screen.getByRole('link', { name: '1-800-274-3258' })).toBeInTheDocument();
    });
  });

  describe('Header', () => {
    it('renders the logo with link to home', () => {
      render(<Chat />);

      const logoLink = screen.getByRole('link', { name: /PA Medicaid Assistant/i });
      expect(logoLink).toBeInTheDocument();
      expect(logoLink).toHaveAttribute('href', '/');
    });

    it('renders the mode toggle button', () => {
      render(<Chat />);

      // Button contains "Simple View" or "Detailed View" text
      const toggleButton = screen.getByRole('button', { name: /View/i });
      expect(toggleButton).toBeInTheDocument();
    });

    it('toggles between Simple and Detailed view', async () => {
      const user = userEvent.setup();
      render(<Chat />);

      // Initially shows Simple View (default is senior mode)
      expect(screen.getByText(/Simple.*View/)).toBeInTheDocument();

      // Click to toggle
      const toggleButton = screen.getByRole('button', { name: /View/i });
      await user.click(toggleButton);

      // Now shows Detailed View
      expect(screen.getByText(/Detailed.*View/)).toBeInTheDocument();
    });

    it('renders the Help link', () => {
      render(<Chat />);

      const helpLink = screen.getByRole('link', { name: /Need Help?/i });
      expect(helpLink).toBeInTheDocument();
      expect(helpLink).toHaveAttribute('href', '/help');
    });
  });

  describe('Query Input', () => {
    it('renders the query input', () => {
      render(<Chat />);

      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
    });

    it('focuses input when empty state is shown', () => {
      render(<Chat />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveFocus();
    });
  });

  describe('Layout', () => {
    it('renders the main content area', () => {
      render(<Chat />);

      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('renders the help sidebar', () => {
      render(<Chat />);

      // The sidebar help panel should be present
      const aside = document.querySelector('aside');
      expect(aside).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper landmark structure', () => {
      render(<Chat />);

      expect(screen.getByRole('banner')).toBeInTheDocument(); // header
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('has accessible mode toggle with aria-pressed', () => {
      render(<Chat />);

      const toggleButton = screen.getByRole('button', { name: /View/i });
      expect(toggleButton).toHaveAttribute('aria-pressed');
    });
  });
});
