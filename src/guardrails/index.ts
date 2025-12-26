import { createChildLogger } from '../utils/logger.js';
import { detectSensitiveTopic, SensitiveCategory } from './detector.js';
import { getDisclaimer, getReferral } from './disclaimers.js';

const logger = createChildLogger('guardrails');

export interface GuardrailResult {
  isSensitive: boolean;
  category?: SensitiveCategory;
  disclaimerRequired: boolean;
  disclaimer?: string;
  referral?: string;
  shouldProceed: boolean;
  confidence: number;
}

export interface QueryResponse {
  answer: string;
  citations: Array<{ filename: string; pageNumber?: number; excerpt: string }>;
  confidence: number;
  queryId: string;
  latencyMs: number;
  retrievalStats: {
    vectorResults: number;
    bm25Results: number;
    finalResults: number;
  };
}

/**
 * Guardrails engine for detecting sensitive topics and adding appropriate disclaimers
 */
export class GuardrailsEngine {
  /**
   * Check a query for sensitive topics
   */
  async checkQuery(query: string): Promise<GuardrailResult> {
    logger.debug({ query: query.substring(0, 100) }, 'Checking query for sensitive topics');

    const detection = detectSensitiveTopic(query);

    if (!detection.isSensitive) {
      return {
        isSensitive: false,
        disclaimerRequired: false,
        shouldProceed: true,
        confidence: 1.0,
      };
    }

    const disclaimer = getDisclaimer(detection.category!);
    const referral = getReferral(detection.category!);

    logger.info(
      { category: detection.category, confidence: detection.confidence },
      'Sensitive topic detected'
    );

    return {
      isSensitive: true,
      category: detection.category,
      disclaimerRequired: true,
      disclaimer,
      referral,
      shouldProceed: true, // We still answer but add disclaimers
      confidence: detection.confidence,
    };
  }

  /**
   * Wrap a response with appropriate disclaimers if needed
   */
  async wrapResponse(
    response: QueryResponse,
    guardrailResult: GuardrailResult
  ): Promise<QueryResponse> {
    if (!guardrailResult.disclaimerRequired || !guardrailResult.disclaimer) {
      return response;
    }

    // Append disclaimer to the answer
    let wrappedAnswer = response.answer;

    // Add disclaimer section
    wrappedAnswer += '\n\n---\n';
    wrappedAnswer += `**Important Notice:** ${guardrailResult.disclaimer}`;

    // Add referral if available
    if (guardrailResult.referral) {
      wrappedAnswer += `\n\n**For Professional Help:** ${guardrailResult.referral}`;
    }

    return {
      ...response,
      answer: wrappedAnswer,
    };
  }
}

// Singleton instance
let guardrailsInstance: GuardrailsEngine | null = null;

export function getGuardrailsEngine(): GuardrailsEngine {
  if (!guardrailsInstance) {
    guardrailsInstance = new GuardrailsEngine();
  }
  return guardrailsInstance;
}

export function resetGuardrailsEngine(): void {
  guardrailsInstance = null;
}

export { SensitiveCategory } from './detector.js';
export { detectSensitiveTopic } from './detector.js';
