/**
 * Sensitive topic categories for Medicaid/Medicare questions
 */
export type SensitiveCategory =
  | 'estate_planning'
  | 'spend_down'
  | 'asset_transfer'
  | 'spousal_complex'
  | 'appeals';

export interface DetectionResult {
  isSensitive: boolean;
  category?: SensitiveCategory;
  matchedKeywords: string[];
  confidence: number;
}

/**
 * Keywords and patterns for each sensitive category
 */
const SENSITIVE_PATTERNS: Record<SensitiveCategory, { keywords: string[]; weight: number }> = {
  estate_planning: {
    keywords: [
      'estate plan',
      'will',
      'trust',
      'inheritance',
      'heir',
      'beneficiary',
      'probate',
      'estate tax',
      'living trust',
      'irrevocable trust',
      'take my estate',
      'when i die',
      'after death',
      'after i die',
      'my estate when',
    ],
    weight: 1.0,
  },
  spend_down: {
    keywords: [
      'spend down',
      'reduce assets',
      'lower assets',
      'get rid of money',
      'hide assets',
      'protect assets',
      'qualify faster',
      'become eligible',
    ],
    weight: 1.2,
  },
  asset_transfer: {
    keywords: [
      'transfer home',
      'transfer house',
      'transfer my house',
      'transfer my home',
      'give away',
      'gift money',
      'deed to child',
      'put in child\'s name',
      'transfer property',
      'sign over',
      'quitclaim',
      'avoid medicaid',
      'transfer to my children',
      'transfer to children',
      'give to my children',
    ],
    weight: 1.3,
  },
  spousal_complex: {
    keywords: [
      'divorce for medicaid',
      'spousal refusal',
      'separate for medicaid',
      'divorce to qualify',
      'legal separation',
      'refuse to pay',
    ],
    weight: 1.1,
  },
  appeals: {
    keywords: [
      'appeal',
      'denied',
      'fair hearing',
      'dispute',
      'fight decision',
      'overturn',
      'wrong decision',
      'disagree with',
    ],
    weight: 0.8,
  },
};

/**
 * Detect sensitive topics in a query
 */
export function detectSensitiveTopic(query: string): DetectionResult {
  const lowerQuery = query.toLowerCase();
  const matchedKeywords: string[] = [];
  let highestCategory: SensitiveCategory | undefined;
  let highestScore = 0;

  for (const [category, config] of Object.entries(SENSITIVE_PATTERNS) as Array<
    [SensitiveCategory, { keywords: string[]; weight: number }]
  >) {
    const matches = config.keywords.filter((keyword) =>
      lowerQuery.includes(keyword.toLowerCase())
    );

    if (matches.length > 0) {
      const score = matches.length * config.weight;
      if (score > highestScore) {
        highestScore = score;
        highestCategory = category;
        matchedKeywords.push(...matches);
      }
    }
  }

  if (highestCategory) {
    // Normalize confidence to 0-1 range
    const confidence = Math.min(highestScore / 2, 1.0);

    return {
      isSensitive: true,
      category: highestCategory,
      matchedKeywords: [...new Set(matchedKeywords)],
      confidence,
    };
  }

  return {
    isSensitive: false,
    matchedKeywords: [],
    confidence: 0,
  };
}

/**
 * Check if a specific category is detected
 */
export function isCategoryDetected(query: string, category: SensitiveCategory): boolean {
  const result = detectSensitiveTopic(query);
  return result.isSensitive && result.category === category;
}

/**
 * Get all sensitive keywords for a category
 */
export function getCategoryKeywords(category: SensitiveCategory): string[] {
  return SENSITIVE_PATTERNS[category]?.keywords || [];
}
