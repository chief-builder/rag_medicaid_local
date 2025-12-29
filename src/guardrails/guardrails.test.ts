import { describe, it, expect, beforeEach } from 'vitest';
import { detectSensitiveTopic, isCategoryDetected, getCategoryKeywords } from './detector.js';
import { getDisclaimer, getReferral, getChesterCountyResources } from './disclaimers.js';
import { GuardrailsEngine } from './index.js';

describe('Sensitive Topic Detection', () => {
  describe('detectSensitiveTopic', () => {
    it('should detect estate planning questions', () => {
      const query = 'How should I set up a trust to protect my assets?';
      const result = detectSensitiveTopic(query);
      expect(result.isSensitive).toBe(true);
      expect(result.category).toBe('estate_planning');
      expect(result.matchedKeywords).toContain('trust');
    });

    it('should detect asset transfer questions', () => {
      const query = 'Can I transfer my house to my children before applying for Medicaid?';
      const result = detectSensitiveTopic(query);
      expect(result.isSensitive).toBe(true);
      expect(result.category).toBe('asset_transfer');
    });

    it('should detect spend down questions', () => {
      const query = 'How can I spend down my assets to qualify for Medicaid?';
      const result = detectSensitiveTopic(query);
      expect(result.isSensitive).toBe(true);
      expect(result.category).toBe('spend_down');
      expect(result.matchedKeywords).toContain('spend down');
    });

    it('should detect spousal complex questions', () => {
      const query = 'Should I get a divorce to qualify for Medicaid?';
      const result = detectSensitiveTopic(query);
      expect(result.isSensitive).toBe(true);
      expect(result.category).toBe('spousal_complex');
    });

    it('should detect appeals questions', () => {
      const query = 'My Medicaid application was denied. How do I appeal?';
      const result = detectSensitiveTopic(query);
      expect(result.isSensitive).toBe(true);
      expect(result.category).toBe('appeals');
    });

    it('should return not sensitive for general questions', () => {
      const query = 'What are the income limits for Medicare Savings Programs?';
      const result = detectSensitiveTopic(query);
      expect(result.isSensitive).toBe(false);
      expect(result.category).toBeUndefined();
    });

    it('should return not sensitive for simple eligibility questions', () => {
      const query = 'Am I eligible for QMB?';
      const result = detectSensitiveTopic(query);
      expect(result.isSensitive).toBe(false);
    });

    it('should handle multiple keywords in same category', () => {
      const query = 'Should I give away my house or put it in a trust to avoid Medicaid taking it?';
      const result = detectSensitiveTopic(query);
      expect(result.isSensitive).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('isCategoryDetected', () => {
    it('should return true when specific category is detected', () => {
      const query = 'How do I appeal a Medicaid denial?';
      expect(isCategoryDetected(query, 'appeals')).toBe(true);
      expect(isCategoryDetected(query, 'estate_planning')).toBe(false);
    });
  });

  describe('getCategoryKeywords', () => {
    it('should return keywords for each category', () => {
      expect(getCategoryKeywords('estate_planning')).toContain('trust');
      expect(getCategoryKeywords('asset_transfer')).toContain('transfer home');
      expect(getCategoryKeywords('spend_down')).toContain('spend down');
    });

    it('should return keywords for look_back_period category', () => {
      const keywords = getCategoryKeywords('look_back_period');
      expect(keywords).toContain('look-back');
      expect(keywords).toContain('60 months');
      expect(keywords).toContain('penalty period');
    });
  });

  describe('look_back_period detection', () => {
    it('should detect look-back period questions', () => {
      const result = detectSensitiveTopic('What is the 60 month look-back period?');
      expect(result.isSensitive).toBe(true);
      expect(result.category).toBe('look_back_period');
    });

    it('should detect 5-year lookback questions', () => {
      const result = detectSensitiveTopic('How does the 5-year lookback work for Medicaid?');
      expect(result.isSensitive).toBe(true);
      expect(result.category).toBe('look_back_period');
    });

    it('should detect penalty period questions', () => {
      const result = detectSensitiveTopic('Will I get a transfer penalty for gifting money?');
      expect(result.isSensitive).toBe(true);
      expect(result.category).toBe('look_back_period');
    });

    it('should detect divestment questions', () => {
      const result = detectSensitiveTopic('What is considered divestment under Medicaid rules?');
      expect(result.isSensitive).toBe(true);
      expect(result.category).toBe('look_back_period');
    });
  });
});

describe('Disclaimers', () => {
  describe('getDisclaimer', () => {
    it('should return appropriate disclaimer for estate planning', () => {
      const disclaimer = getDisclaimer('estate_planning');
      expect(disclaimer).toContain('elder law attorney');
      expect(disclaimer).toContain('legal advice');
    });

    it('should return appropriate disclaimer for asset transfers', () => {
      const disclaimer = getDisclaimer('asset_transfer');
      expect(disclaimer).toContain('5 years');
      expect(disclaimer).toContain('penalties');
    });

    it('should return appropriate disclaimer for spend down', () => {
      const disclaimer = getDisclaimer('spend_down');
      expect(disclaimer).toContain('penalty periods');
    });

    it('should return appropriate disclaimer for appeals', () => {
      const disclaimer = getDisclaimer('appeals');
      expect(disclaimer).toContain('right to appeal');
      expect(disclaimer).toContain('30 days');
    });

    it('should return appropriate disclaimer for look_back_period', () => {
      const disclaimer = getDisclaimer('look_back_period');
      expect(disclaimer).toContain('60-month');
      expect(disclaimer).toContain('5-year');
      expect(disclaimer).toContain('penalty period');
      expect(disclaimer).toContain('elder law attorney');
    });
  });

  describe('getReferral', () => {
    it('should include PHLP for spend down questions', () => {
      const referral = getReferral('spend_down');
      expect(referral).toContain('PHLP');
      expect(referral).toContain('1-800-274-3258');
    });

    it('should include attorney referral for estate planning', () => {
      const referral = getReferral('estate_planning');
      expect(referral).toContain('Elder Law Attorney');
    });

    it('should include legal aid for appeals', () => {
      const referral = getReferral('appeals');
      expect(referral).toContain('PHLP');
    });

    it('should include elder law attorney for look_back_period', () => {
      const referral = getReferral('look_back_period');
      expect(referral).toContain('Elder Law Attorney');
      expect(referral).toContain('PA Bar Association');
      expect(referral).toContain('PHLP');
    });
  });

  describe('getChesterCountyResources', () => {
    it('should include Chester County CAO', () => {
      const resources = getChesterCountyResources();
      expect(resources).toContain('Chester County');
      expect(resources).toContain('610-466-1000');
    });

    it('should include APPRISE', () => {
      const resources = getChesterCountyResources();
      expect(resources).toContain('APPRISE');
      expect(resources).toContain('610-344-6350');
    });
  });
});

describe('GuardrailsEngine', () => {
  let engine: GuardrailsEngine;

  beforeEach(() => {
    engine = new GuardrailsEngine();
  });

  describe('checkQuery', () => {
    it('should detect sensitive topics and return disclaimer info', async () => {
      const result = await engine.checkQuery('How do I transfer my house to avoid Medicaid?');
      expect(result.isSensitive).toBe(true);
      expect(result.disclaimerRequired).toBe(true);
      expect(result.disclaimer).toBeDefined();
      expect(result.referral).toBeDefined();
      expect(result.shouldProceed).toBe(true);
    });

    it('should allow normal questions without disclaimers', async () => {
      const result = await engine.checkQuery('What is the income limit for SLMB?');
      expect(result.isSensitive).toBe(false);
      expect(result.disclaimerRequired).toBe(false);
      expect(result.shouldProceed).toBe(true);
    });
  });

  describe('wrapResponse', () => {
    it('should append disclaimer to sensitive topic responses', async () => {
      const guardrailResult = await engine.checkQuery('How do I transfer my house?');
      const response = {
        answer: 'Here is information about home transfers.',
        citations: [{ filename: 'test.pdf', excerpt: 'test' }],
        confidence: 85,
        queryId: 'test-123',
        latencyMs: 100,
        retrievalStats: { vectorResults: 5, bm25Results: 5, finalResults: 3 },
      };

      const wrapped = await engine.wrapResponse(response, guardrailResult);
      expect(wrapped.answer).toContain('Important Notice');
      expect(wrapped.answer).toContain('5 years');
    });

    it('should not modify non-sensitive responses', async () => {
      const guardrailResult = await engine.checkQuery('What is QMB?');
      const response = {
        answer: 'QMB is the Qualified Medicare Beneficiary program.',
        citations: [{ filename: 'test.pdf', excerpt: 'test' }],
        confidence: 90,
        queryId: 'test-456',
        latencyMs: 80,
        retrievalStats: { vectorResults: 5, bm25Results: 5, finalResults: 3 },
      };

      const wrapped = await engine.wrapResponse(response, guardrailResult);
      expect(wrapped.answer).toBe(response.answer);
    });
  });
});
