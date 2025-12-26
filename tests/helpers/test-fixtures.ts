import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '..', 'fixtures');

export interface SeniorIntent {
  id: string;
  intent: string;
  variations: string[];
  expectedPrograms?: string[];
  expectedTopics?: string[];
  expectedInfo?: string[];
  expectedDocTypes?: string[];
  sensitiveCategory: string | null;
}

export interface GoldenAnswer {
  queryId: string;
  query: string;
  expectedAnswer: {
    mustContain: string[];
    shouldContain: string[];
    mustNotContain: string[];
    citationCount: { min: number; max: number };
  };
}

/**
 * Load senior intent test queries
 */
export async function loadSeniorIntents(): Promise<SeniorIntent[]> {
  const content = await readFile(
    join(FIXTURES_DIR, 'queries', 'senior-intents.json'),
    'utf-8'
  );
  const data = JSON.parse(content);
  return data.queries;
}

/**
 * Load golden answers for validation
 */
export async function loadGoldenAnswers(): Promise<GoldenAnswer[]> {
  const content = await readFile(
    join(FIXTURES_DIR, 'expected', 'golden-answers.json'),
    'utf-8'
  );
  const data = JSON.parse(content);
  return data.goldenAnswers;
}

/**
 * Validate an answer against golden answer expectations
 */
export function validateAnswer(
  answer: string,
  citations: Array<{ filename: string }>,
  expected: GoldenAnswer['expectedAnswer']
): { passed: boolean; errors: string[] } {
  const errors: string[] = [];
  const lowerAnswer = answer.toLowerCase();

  // Check mustContain
  for (const term of expected.mustContain) {
    if (!lowerAnswer.includes(term.toLowerCase())) {
      errors.push(`Missing required term: "${term}"`);
    }
  }

  // Check mustNotContain
  for (const term of expected.mustNotContain) {
    if (lowerAnswer.includes(term.toLowerCase())) {
      errors.push(`Contains forbidden term: "${term}"`);
    }
  }

  // Check citation count
  if (citations.length < expected.citationCount.min) {
    errors.push(`Too few citations: ${citations.length} < ${expected.citationCount.min}`);
  }
  if (citations.length > expected.citationCount.max) {
    errors.push(`Too many citations: ${citations.length} > ${expected.citationCount.max}`);
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}

/**
 * Generate test cases from senior intents
 */
export function generateTestCases(intents: SeniorIntent[]) {
  const testCases: Array<{
    name: string;
    query: string;
    intent: string;
    expectations: {
      programs?: string[];
      topics?: string[];
      sensitiveCategory: string | null;
    };
  }> = [];

  for (const intent of intents) {
    // Add main intent as test case
    testCases.push({
      name: `${intent.id}: ${intent.intent}`,
      query: intent.intent,
      intent: intent.id,
      expectations: {
        programs: intent.expectedPrograms,
        topics: intent.expectedTopics,
        sensitiveCategory: intent.sensitiveCategory,
      },
    });

    // Add variations as additional test cases
    for (let i = 0; i < intent.variations.length; i++) {
      testCases.push({
        name: `${intent.id}-v${i + 1}: ${intent.variations[i].substring(0, 50)}...`,
        query: intent.variations[i],
        intent: intent.id,
        expectations: {
          programs: intent.expectedPrograms,
          topics: intent.expectedTopics,
          sensitiveCategory: intent.sensitiveCategory,
        },
      });
    }
  }

  return testCases;
}
