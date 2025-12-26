import { vi } from 'vitest';
import type { EmbeddingResult } from '../../src/types/index.js';

/**
 * Mock LM Studio client for testing without actual LLM calls
 */
export interface MockLMStudioOptions {
  embeddingDimension?: number;
  defaultAnswer?: string;
  citedIndices?: number[];
}

export function createMockLMStudioClient(options: MockLMStudioOptions = {}) {
  const {
    embeddingDimension = 768,
    defaultAnswer = 'This is a mock answer based on the provided documents.',
    citedIndices = [1],
  } = options;

  return {
    embed: vi.fn().mockImplementation(async (text: string): Promise<EmbeddingResult> => {
      // Generate deterministic mock embedding based on text content
      const embedding = new Array(embeddingDimension).fill(0).map((_, i) => {
        const charSum = text.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
        return Math.sin(charSum * (i + 1) * 0.001) * 0.5;
      });

      return {
        embedding,
        model: 'mock-embedding-model',
        tokenCount: Math.ceil(text.length / 4),
      };
    }),

    embedBatch: vi.fn().mockImplementation(async (texts: string[]): Promise<EmbeddingResult[]> => {
      return Promise.all(texts.map(async (text) => {
        const embedding = new Array(embeddingDimension).fill(0).map((_, i) => {
          const charSum = text.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
          return Math.sin(charSum * (i + 1) * 0.001) * 0.5;
        });

        return {
          embedding,
          model: 'mock-embedding-model',
          tokenCount: Math.ceil(text.length / 4),
        };
      }));
    }),

    chat: vi.fn().mockImplementation(async (): Promise<string> => {
      return defaultAnswer;
    }),

    generateAnswer: vi.fn().mockImplementation(async (
      query: string,
      contexts: Array<{ index: number; content: string }>
    ): Promise<{ answer: string; citedIndices: number[] }> => {
      const answer = `Based on the documents, ${defaultAnswer} [${citedIndices.join('][')}]`;
      return { answer, citedIndices };
    }),

    rerankListwise: vi.fn().mockImplementation(async (
      query: string,
      documents: Array<{ id: string; content: string }>,
      topN: number
    ): Promise<Array<{ id: string; score: number }>> => {
      // Return documents in original order with descending scores
      return documents.slice(0, topN).map((doc, i) => ({
        id: doc.id,
        score: 1 - i * 0.1,
      }));
    }),

    ocrToMarkdown: vi.fn().mockImplementation(async (): Promise<string> => {
      return '# Mock Document\n\nThis is mock OCR content.';
    }),

    healthCheck: vi.fn().mockResolvedValue(true),
  };
}

/**
 * Sample document content for testing
 */
export const SAMPLE_DOCUMENTS = {
  mspGuide: {
    id: 'doc-msp-001',
    content: `# Medicare Savings Programs Guide

Medicare Savings Programs (MSPs) help pay Medicare costs for people with limited income and resources.

## Qualified Medicare Beneficiary (QMB)
- Pays Part A and Part B premiums, deductibles, and coinsurance
- Income limit: 100% FPL ($1,255/month for individual in 2025)
- Resource limit: $9,430 individual, $14,130 couple

## Specified Low-Income Medicare Beneficiary (SLMB)
- Pays Part B premium only
- Income limit: 120% FPL ($1,506/month for individual in 2025)
- Resource limit: $9,430 individual, $14,130 couple

## Qualifying Individual (QI)
- Pays Part B premium only
- Income limit: 135% FPL ($1,695/month for individual in 2025)
- Resource limit: $9,430 individual, $14,130 couple

## How to Apply
Apply through Pennsylvania COMPASS at compass.state.pa.us or contact your local County Assistance Office.
Chester County CAO: 610-466-1000`,
    filename: 'msp-guide.pdf',
    pageNumber: 1,
  },

  estatePlanning: {
    id: 'doc-estate-001',
    content: `# Estate Recovery Information

## What is Estate Recovery?
After a Medicaid recipient passes away, the state may seek reimbursement from their estate for Medicaid benefits received.

## Protected Assets
- Home is protected while living or if spouse/dependent lives there
- Life insurance with face value under $1,500
- Burial funds up to $2,500
- Personal belongings

## Hardship Waivers
Estate recovery may be waived if it would cause undue hardship, such as:
- The only asset is a small family business
- Recovery would cause loss of essential income
- Property has minimal equity

Contact PHLP at 1-800-274-3258 for help with estate recovery questions.`,
    filename: 'estate-recovery-faq.pdf',
    pageNumber: 1,
  },

  ltcInfo: {
    id: 'doc-ltc-001',
    content: `# Long-Term Care Medicaid Information

## Spousal Impoverishment Protections
When one spouse needs nursing home care, the community spouse can keep:
- Community Spouse Resource Allowance (CSRA): Up to $157,920 (2025)
- Minimum Monthly Maintenance Needs Allowance (MMMNA): $2,555/month (2025)
- Home (exempt as long as community spouse lives there)
- One vehicle
- Personal belongings and household goods

## Home Exemption
The home is an exempt asset if:
- The applicant intends to return home, OR
- A spouse, minor, blind, or disabled child lives there

## Long-Term Care Alternatives
- LIFE (Living Independence for the Elderly) - PACE program
- Community HealthChoices (CHC) Waiver - home and community-based services`,
    filename: 'ltc-information.pdf',
    pageNumber: 2,
  },
};

/**
 * Create mock query results for testing retrieval pipeline
 */
export function createMockQueryResults(documents: typeof SAMPLE_DOCUMENTS[keyof typeof SAMPLE_DOCUMENTS][]) {
  return documents.map((doc, index) => ({
    id: doc.id,
    score: 1 - index * 0.1,
    payload: {
      chunkId: doc.id,
      documentId: `doc-${index}`,
      content: doc.content,
      pageNumber: doc.pageNumber,
      chunkIndex: index,
      metadata: {
        filename: doc.filename,
        title: doc.filename.replace('.pdf', ''),
      },
    },
  }));
}
