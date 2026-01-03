import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, createMockCitation } from '../test/test-utils';
import { CitationCard } from './CitationCard';

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

describe('CitationCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCaregiver.mockReturnValue(false);
  });

  describe('Collapsed State', () => {
    it('renders citation index', () => {
      const citation = createMockCitation({ index: 1 });
      render(<CitationCard citation={citation} index={0} />);

      expect(screen.getByText('[1]')).toBeInTheDocument();
    });

    it('uses prop index when citation.index is not provided', () => {
      const citation = createMockCitation({ index: undefined });
      render(<CitationCard citation={citation} index={2} />);

      expect(screen.getByText('[3]')).toBeInTheDocument(); // index + 1
    });

    it('renders formatted filename without extension', () => {
      const citation = createMockCitation({ filename: 'MSP_Income_Limits_2024.pdf' });
      render(<CitationCard citation={citation} index={0} />);

      expect(screen.getByText(/MSP Income Limits 2024/)).toBeInTheDocument();
    });

    it('renders page number when provided', () => {
      const citation = createMockCitation({ pageNumber: 5 });
      render(<CitationCard citation={citation} index={0} />);

      expect(screen.getByText(/, Page 5/)).toBeInTheDocument();
    });

    it('does not render page number when zero', () => {
      const citation = createMockCitation({ pageNumber: 0 });
      render(<CitationCard citation={citation} index={0} />);

      expect(screen.queryByText(/Page 0/)).not.toBeInTheDocument();
    });

    it('renders source authority badge for primary sources', () => {
      const citation = createMockCitation({ sourceAuthority: 'primary' });
      render(<CitationCard citation={citation} index={0} />);

      expect(screen.getByText('Official')).toBeInTheDocument();
    });

    it('renders source authority badge for secondary sources', () => {
      const citation = createMockCitation({ sourceAuthority: 'secondary' });
      render(<CitationCard citation={citation} index={0} />);

      expect(screen.getByText('Guidance')).toBeInTheDocument();
    });

    it('has accessible expand button', () => {
      const citation = createMockCitation();
      render(<CitationCard citation={citation} index={0} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).toHaveAttribute('aria-controls');
    });
  });

  describe('Expand/Collapse', () => {
    it('expands when clicked', async () => {
      const user = userEvent.setup();
      const citation = createMockCitation({ content: 'Source excerpt text' });
      render(<CitationCard citation={citation} index={0} />);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(button).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText('"Source excerpt text"')).toBeInTheDocument();
    });

    it('collapses when clicked again', async () => {
      const user = userEvent.setup();
      const citation = createMockCitation({ content: 'Source excerpt text' });
      render(<CitationCard citation={citation} index={0} />);

      const button = screen.getByRole('button');

      // Expand
      await user.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');

      // Collapse
      await user.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('shows chevron indicator that rotates on expand', async () => {
      const user = userEvent.setup();
      const citation = createMockCitation();
      render(<CitationCard citation={citation} index={0} />);

      const chevron = screen.getByText('▼');
      expect(chevron).toBeInTheDocument();

      // Click to expand
      await user.click(screen.getByRole('button'));

      // Chevron should have expanded class (visual indicator)
      expect(chevron.className).toContain('expanded');
    });
  });

  describe('Expanded Content', () => {
    it('shows source excerpt when expanded', async () => {
      const user = userEvent.setup();
      const citation = createMockCitation({
        content: 'The QMB income limit is 100% FPL.',
      });
      render(<CitationCard citation={citation} index={0} />);

      await user.click(screen.getByRole('button'));

      expect(screen.getByText('Source excerpt:')).toBeInTheDocument();
      expect(
        screen.getByText('"The QMB income limit is 100% FPL."')
      ).toBeInTheDocument();
    });

    it('does not show excerpt section when content is empty', async () => {
      const user = userEvent.setup();
      const citation = createMockCitation({ content: undefined });
      render(<CitationCard citation={citation} index={0} />);

      await user.click(screen.getByRole('button'));

      expect(screen.queryByText('Source excerpt:')).not.toBeInTheDocument();
    });
  });

  describe('Metadata in Caregiver Mode', () => {
    beforeEach(() => {
      mockIsCaregiver.mockReturnValue(true);
    });

    it('shows document type when expanded in caregiver mode', async () => {
      const user = userEvent.setup();
      const citation = createMockCitation({ documentType: 'income_limits' });
      render(<CitationCard citation={citation} index={0} />);

      await user.click(screen.getByRole('button'));

      expect(screen.getByText('Document Type:')).toBeInTheDocument();
      expect(screen.getByText('Income Limits')).toBeInTheDocument();
    });

    it('shows legal weight when expanded in caregiver mode', async () => {
      const user = userEvent.setup();
      const citation = createMockCitation({ legalWeight: 'regulatory' });
      render(<CitationCard citation={citation} index={0} />);

      await user.click(screen.getByRole('button'));

      expect(screen.getByText('Legal Weight:')).toBeInTheDocument();
      expect(screen.getByText('Regulatory')).toBeInTheDocument();
    });

    it('shows guidance legal weight', async () => {
      const user = userEvent.setup();
      const citation = createMockCitation({ legalWeight: 'guidance' });
      render(<CitationCard citation={citation} index={0} />);

      await user.click(screen.getByRole('button'));

      expect(screen.getByText('Guidance')).toBeInTheDocument();
    });

    it('shows informational legal weight', async () => {
      const user = userEvent.setup();
      const citation = createMockCitation({ legalWeight: 'informational' });
      render(<CitationCard citation={citation} index={0} />);

      await user.click(screen.getByRole('button'));

      expect(screen.getByText('Informational')).toBeInTheDocument();
    });

    it('formats various document types correctly', async () => {
      const user = userEvent.setup();
      const citation = createMockCitation({ documentType: 'oim_ltc_handbook' });
      render(<CitationCard citation={citation} index={0} />);

      await user.click(screen.getByRole('button'));

      expect(screen.getByText('OIM LTC Handbook')).toBeInTheDocument();
    });
  });

  describe('Metadata in Senior Mode', () => {
    beforeEach(() => {
      mockIsCaregiver.mockReturnValue(false);
    });

    it('does not show document type in senior mode', async () => {
      const user = userEvent.setup();
      const citation = createMockCitation({ documentType: 'income_limits' });
      render(<CitationCard citation={citation} index={0} />);

      await user.click(screen.getByRole('button'));

      expect(screen.queryByText('Document Type:')).not.toBeInTheDocument();
    });

    it('does not show legal weight in senior mode', async () => {
      const user = userEvent.setup();
      const citation = createMockCitation({ legalWeight: 'regulatory' });
      render(<CitationCard citation={citation} index={0} />);

      await user.click(screen.getByRole('button'));

      expect(screen.queryByText('Legal Weight:')).not.toBeInTheDocument();
    });

    it('still shows source excerpt in senior mode', async () => {
      const user = userEvent.setup();
      const citation = createMockCitation({ content: 'Excerpt here' });
      render(<CitationCard citation={citation} index={0} />);

      await user.click(screen.getByRole('button'));

      expect(screen.getByText('"Excerpt here"')).toBeInTheDocument();
    });
  });

  describe('Filename Formatting', () => {
    it('removes .pdf extension', () => {
      const citation = createMockCitation({ filename: 'document.pdf' });
      render(<CitationCard citation={citation} index={0} />);

      expect(screen.queryByText(/\.pdf/)).not.toBeInTheDocument();
    });

    it('removes .txt extension', () => {
      const citation = createMockCitation({ filename: 'document.txt' });
      render(<CitationCard citation={citation} index={0} />);

      expect(screen.queryByText(/\.txt/)).not.toBeInTheDocument();
    });

    it('replaces underscores with spaces', () => {
      const citation = createMockCitation({ filename: 'my_important_document.pdf' });
      render(<CitationCard citation={citation} index={0} />);

      expect(screen.getByText(/my important document/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes for expandable content', async () => {
      const user = userEvent.setup();
      const citation = createMockCitation({ content: 'Test content' });
      render(<CitationCard citation={citation} index={0} />);

      const button = screen.getByRole('button');
      const controlsId = button.getAttribute('aria-controls');

      // Expand to make content visible
      await user.click(button);

      const content = document.getElementById(controlsId!);
      expect(content).toBeInTheDocument();
    });

    it('has hidden aria attribute on chevron', () => {
      const citation = createMockCitation();
      render(<CitationCard citation={citation} index={0} />);

      const chevron = screen.getByText('▼');
      expect(chevron).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
