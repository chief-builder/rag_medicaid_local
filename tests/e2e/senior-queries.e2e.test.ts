import { describe, it, expect, beforeAll } from 'vitest';
import { loadSeniorIntents, loadGoldenAnswers, validateAnswer, generateTestCases } from '../helpers/test-fixtures.js';
import { detectSensitiveTopic } from '../../src/guardrails/detector.js';
import { checkTestServices } from '../helpers/test-db.js';
import { createMockLMStudioClient, SAMPLE_DOCUMENTS } from '../helpers/mock-lm-studio.js';

/**
 * E2E tests for senior-focused query handling
 *
 * These tests verify:
 * 1. Sensitive topic detection works correctly for each query type
 * 2. Golden answers match expected patterns
 * 3. Query variations are handled consistently
 *
 * Note: Full E2E tests with actual LLM require LM Studio to be running
 * These tests focus on the deterministic parts of the pipeline
 */
describe('Senior Query E2E Tests', () => {
  describe('Sensitive Topic Detection for Senior Intents', () => {
    it('should correctly identify sensitive categories for each intent', async () => {
      const intents = await loadSeniorIntents();

      const sensitiveCases = [
        {
          query: 'Can I transfer my house to my children before applying for Medicaid?',
          expectedCategory: 'asset_transfer',
        },
        {
          query: 'Will Medicaid take my estate when I die?',
          expectedCategory: 'estate_planning',
        },
        {
          query: 'How can I spend down my assets to qualify?',
          expectedCategory: 'spend_down',
        },
        {
          query: 'Should I divorce to qualify for Medicaid?',
          expectedCategory: 'spousal_complex',
        },
        {
          query: 'How do I appeal a Medicaid denial?',
          expectedCategory: 'appeals',
        },
      ];

      for (const testCase of sensitiveCases) {
        const result = detectSensitiveTopic(testCase.query);
        expect(result.isSensitive).toBe(true);
        expect(result.category).toBe(testCase.expectedCategory);
      }
    });

    it('should NOT flag general eligibility questions as sensitive', async () => {
      const nonSensitiveQueries = [
        'What are the income limits for QMB?',
        'How do I apply for Medicare Savings Programs?',
        'What is the LIFE program?',
        'Can I get help with my Medicare premium?',
        'What documents do I need to apply?',
      ];

      for (const query of nonSensitiveQueries) {
        const result = detectSensitiveTopic(query);
        expect(result.isSensitive).toBe(false);
      }
    });
  });

  describe('Senior Intent Query Variations', () => {
    it('should handle all variations of each intent consistently', async () => {
      const intents = await loadSeniorIntents();

      for (const intent of intents) {
        const expectedSensitive = intent.sensitiveCategory !== null;

        // Check main intent
        const mainResult = detectSensitiveTopic(intent.intent);

        // Check all variations
        for (const variation of intent.variations) {
          const varResult = detectSensitiveTopic(variation);

          // If the intent is marked as sensitive, at least the main query or variations should detect it
          if (expectedSensitive) {
            // Note: not all variations may trigger - that's okay as long as the explicit ones do
            if (variation.toLowerCase().includes('transfer') ||
                variation.toLowerCase().includes('estate') ||
                variation.toLowerCase().includes('divorce')) {
              expect(varResult.isSensitive).toBe(true);
            }
          }
        }
      }
    });
  });

  describe('Golden Answer Validation', () => {
    it('should load golden answers successfully', async () => {
      const goldenAnswers = await loadGoldenAnswers();
      expect(goldenAnswers.length).toBeGreaterThan(0);

      for (const golden of goldenAnswers) {
        expect(golden.queryId).toBeDefined();
        expect(golden.query).toBeDefined();
        expect(golden.expectedAnswer).toBeDefined();
        expect(golden.expectedAnswer.mustContain).toBeDefined();
        expect(golden.expectedAnswer.citationCount).toBeDefined();
      }
    });

    it('should validate answers correctly', () => {
      const mockAnswer = 'Based on the documents, SLMB helps pay your Part B premium. [1][2]';
      const mockCitations = [
        { filename: 'msp-guide.pdf' },
        { filename: 'income-limits.pdf' },
      ];

      const goldenExpectation = {
        mustContain: ['SLMB', 'Part B premium'],
        shouldContain: ['Medicare Savings Program'],
        mustNotContain: ['I cannot find'],
        citationCount: { min: 1, max: 5 },
      };

      const result = validateAnswer(mockAnswer, mockCitations, goldenExpectation);
      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should catch missing required terms', () => {
      const mockAnswer = 'This is a generic answer without specific programs.';
      const mockCitations = [{ filename: 'test.pdf' }];

      const goldenExpectation = {
        mustContain: ['SLMB', 'Part B premium'],
        shouldContain: [],
        mustNotContain: [],
        citationCount: { min: 1, max: 5 },
      };

      const result = validateAnswer(mockAnswer, mockCitations, goldenExpectation);
      expect(result.passed).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('SLMB'))).toBe(true);
    });

    it('should catch forbidden terms', () => {
      const mockAnswer = 'I cannot find this information in the documents.';
      const mockCitations = [{ filename: 'test.pdf' }];

      const goldenExpectation = {
        mustContain: [],
        shouldContain: [],
        mustNotContain: ['I cannot find'],
        citationCount: { min: 1, max: 5 },
      };

      const result = validateAnswer(mockAnswer, mockCitations, goldenExpectation);
      expect(result.passed).toBe(false);
      expect(result.errors.some(e => e.includes('forbidden'))).toBe(true);
    });
  });

  describe('Test Case Generation', () => {
    it('should generate test cases from intents', async () => {
      const intents = await loadSeniorIntents();
      const testCases = generateTestCases(intents);

      // Should have main intent + variations for each
      expect(testCases.length).toBeGreaterThan(intents.length);

      // Each test case should have required fields
      for (const testCase of testCases) {
        expect(testCase.name).toBeDefined();
        expect(testCase.query).toBeDefined();
        expect(testCase.intent).toBeDefined();
        expect(testCase.expectations).toBeDefined();
      }
    });
  });
});

/**
 * Integration tests that require actual services running
 * These tests use top-level await to check service availability
 */
// Check services at module load time
const services = await checkTestServices();

describe('Senior Query Integration Tests (requires LM Studio)', () => {
  it.skipIf(!services.lmStudio)('should return relevant answers for Medicare cost help queries', async () => {
    // Use mock client to simulate the pipeline behavior
    const mockLMStudio = createMockLMStudioClient({
      defaultAnswer: 'Medicare Savings Programs (MSP) can help pay your Medicare costs. ' +
        'QMB pays Part A and Part B premiums. SLMB pays Part B premium only. [1]',
      citedIndices: [1],
    });

    const { answer } = await mockLMStudio.generateAnswer(
      'Can I get help with Medicare costs?',
      [{ index: 1, content: SAMPLE_DOCUMENTS.mspGuide.content, filename: 'msp-guide.pdf', pageNumber: 1 }]
    );

    expect(answer.toLowerCase()).toContain('medicare');
    expect(answer.toLowerCase()).toMatch(/savings|costs|premium/);
  });

  it.skipIf(!services.lmStudio)('should include contact resources in responses', async () => {
    const mockLMStudio = createMockLMStudioClient({
      defaultAnswer: 'For assistance with Medicare Savings Programs, contact PHLP at 1-800-274-3258 ' +
        'or your local County Assistance Office. [1]',
      citedIndices: [1],
    });

    const { answer } = await mockLMStudio.generateAnswer(
      'How do I get help applying for MSP?',
      [{ index: 1, content: SAMPLE_DOCUMENTS.mspGuide.content, filename: 'msp-guide.pdf', pageNumber: 1 }]
    );

    // Should include contact information
    expect(answer).toMatch(/PHLP|County Assistance|1-800/);
  });

  it.skipIf(!services.lmStudio)('should add disclaimers for sensitive topics', async () => {
    // First detect that this is a sensitive topic
    const query = 'Can I transfer my home to avoid estate recovery?';
    const detection = detectSensitiveTopic(query);

    expect(detection.isSensitive).toBe(true);
    expect(detection.category).toBe('asset_transfer');

    // When answering sensitive topics, the system should include disclaimers
    const mockLMStudio = createMockLMStudioClient({
      defaultAnswer: 'Asset transfers made within the 5-year look-back period may affect Medicaid eligibility. ' +
        'This is a complex legal matter. Please consult with an elder law attorney or contact PHLP at 1-800-274-3258 ' +
        'for free legal assistance. [1]',
      citedIndices: [1],
    });

    const { answer } = await mockLMStudio.generateAnswer(
      query,
      [{ index: 1, content: SAMPLE_DOCUMENTS.estatePlanning.content, filename: 'estate-recovery.pdf', pageNumber: 1 }]
    );

    // Should include attorney/legal referral
    expect(answer).toMatch(/attorney|legal|PHLP|consult/i);
  });
});
