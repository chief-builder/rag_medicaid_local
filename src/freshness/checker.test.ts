import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  FreshnessChecker,
  getFreshnessChecker,
  resetFreshnessChecker,
  DataType,
  FreshnessRule,
  DocumentWithFreshness,
} from './checker.js';

describe('FreshnessChecker', () => {
  let checker: FreshnessChecker;

  beforeEach(() => {
    resetFreshnessChecker();
    checker = new FreshnessChecker();
  });

  afterEach(() => {
    resetFreshnessChecker();
  });

  describe('checkDataType', () => {
    describe('annually_january updates', () => {
      it('should not flag data as stale before update month', () => {
        const effectiveDate = new Date('2024-01-15');
        const checkDate = new Date('2024-12-15'); // Before January 2025

        const result = checker.checkDataType('federal_poverty_level', effectiveDate, checkDate);

        expect(result.isStale).toBe(false);
        expect(result.warningLevel).toBe('none');
      });

      it('should flag data as stale after update month in new year', () => {
        const effectiveDate = new Date('2024-01-15');
        const checkDate = new Date('2025-02-15'); // After January 2025

        const result = checker.checkDataType('federal_poverty_level', effectiveDate, checkDate);

        expect(result.isStale).toBe(true);
        expect(result.warningLevel).toBe('warning');
        expect(result.warningMessage).toContain('2024');
        expect(result.warningMessage).toContain('2025');
      });

      it('should return info level during update month', () => {
        const effectiveDate = new Date('2024-01-15');
        const checkDate = new Date('2025-01-15'); // During January 2025

        const result = checker.checkDataType('federal_poverty_level', effectiveDate, checkDate);

        expect(result.isStale).toBe(true);
        expect(result.warningLevel).toBe('info');
      });

      it('should escalate to critical for very old data', () => {
        const effectiveDate = new Date('2022-01-15');
        const checkDate = new Date('2025-02-15'); // More than 1 year stale

        const result = checker.checkDataType('federal_poverty_level', effectiveDate, checkDate);

        expect(result.isStale).toBe(true);
        expect(result.warningLevel).toBe('critical');
        expect(result.warningMessage).toContain('significantly outdated');
      });

      it('should calculate next expected update correctly', () => {
        const effectiveDate = new Date('2024-01-15');
        const checkDate = new Date('2024-06-15'); // Before next January

        const result = checker.checkDataType('federal_poverty_level', effectiveDate, checkDate);

        // Check year and month (ignore timezone differences)
        expect(result.nextExpectedUpdate?.getFullYear()).toBe(2025);
        expect(result.nextExpectedUpdate?.getMonth()).toBe(0); // January
      });
    });

    describe('annually_april updates (MSP)', () => {
      it('should not flag MSP data as stale before April', () => {
        const effectiveDate = new Date('2024-04-15');
        const checkDate = new Date('2025-03-15'); // Before April 2025

        const result = checker.checkDataType('msp_income_limits', effectiveDate, checkDate);

        expect(result.isStale).toBe(false);
      });

      it('should flag MSP data as stale after April in new year', () => {
        const effectiveDate = new Date('2024-04-15');
        const checkDate = new Date('2025-05-15'); // After April 2025

        const result = checker.checkDataType('msp_income_limits', effectiveDate, checkDate);

        expect(result.isStale).toBe(true);
        expect(result.warningMessage).toContain('April');
      });
    });

    describe('quarterly updates', () => {
      it('should not flag quarterly data within 3 months', () => {
        const effectiveDate = new Date('2024-01-15');
        const checkDate = new Date('2024-04-01'); // Within 3 months

        const result = checker.checkDataType('chester_county_contacts', effectiveDate, checkDate);

        expect(result.isStale).toBe(false);
      });

      it('should flag quarterly data after 3 months', () => {
        const effectiveDate = new Date('2024-01-15');
        const checkDate = new Date('2024-05-15'); // More than 3 months

        const result = checker.checkDataType('chester_county_contacts', effectiveDate, checkDate);

        expect(result.isStale).toBe(true);
        expect(result.warningLevel).toBe('info');
      });
    });

    describe('monthly updates', () => {
      it('should not flag monthly data within 1 month', () => {
        const effectiveDate = new Date('2024-01-15');
        const checkDate = new Date('2024-02-10'); // Within 1 month

        const result = checker.checkDataType('oim_ltc_handbook', effectiveDate, checkDate);

        expect(result.isStale).toBe(false);
      });

      it('should flag monthly data after 1 month with info level', () => {
        const effectiveDate = new Date('2024-01-15');
        const checkDate = new Date('2024-03-15'); // More than 1 month

        const result = checker.checkDataType('oim_ltc_handbook', effectiveDate, checkDate);

        expect(result.isStale).toBe(true);
        expect(result.warningLevel).toBe('info');
      });

      it('should flag monthly data after 3 months with warning level', () => {
        const effectiveDate = new Date('2024-01-15');
        const checkDate = new Date('2024-05-15'); // More than 3 months

        const result = checker.checkDataType('oim_ltc_handbook', effectiveDate, checkDate);

        expect(result.isStale).toBe(true);
        expect(result.warningLevel).toBe('warning');
      });
    });

    describe('weekly updates', () => {
      it('should not flag weekly data within 7 days', () => {
        const effectiveDate = new Date('2024-01-15');
        const checkDate = new Date('2024-01-20'); // 5 days

        const result = checker.checkDataType('oim_ops_memo', effectiveDate, checkDate);

        expect(result.isStale).toBe(false);
      });

      it('should flag weekly data after 7 days with info level', () => {
        const effectiveDate = new Date('2024-01-15');
        const checkDate = new Date('2024-01-25'); // 10 days

        const result = checker.checkDataType('oim_ops_memo', effectiveDate, checkDate);

        expect(result.isStale).toBe(true);
        expect(result.warningLevel).toBe('info');
      });

      it('should flag weekly data after 14 days with warning level', () => {
        const effectiveDate = new Date('2024-01-15');
        const checkDate = new Date('2024-02-05'); // 21 days

        const result = checker.checkDataType('oim_ops_memo', effectiveDate, checkDate);

        expect(result.isStale).toBe(true);
        expect(result.warningLevel).toBe('warning');
      });
    });

    describe('as_needed updates', () => {
      it('should never flag as_needed data as stale', () => {
        const effectiveDate = new Date('2020-01-15'); // Very old
        const checkDate = new Date('2025-01-15');

        const result = checker.checkDataType('pa_code_chapter_258', effectiveDate, checkDate);

        expect(result.isStale).toBe(false);
      });
    });

    it('should return not stale for unknown data types', () => {
      const effectiveDate = new Date('2020-01-15');
      const checkDate = new Date('2025-01-15');

      const result = checker.checkDataType('unknown_type' as DataType, effectiveDate, checkDate);

      expect(result.isStale).toBe(false);
      expect(result.warningLevel).toBe('none');
    });
  });

  describe('checkDocument', () => {
    it('should return null for documents without documentType', () => {
      const doc: DocumentWithFreshness = {
        id: 'doc-1',
        effectiveDate: new Date('2024-01-15'),
      };

      const result = checker.checkDocument(doc);

      expect(result).toBeNull();
    });

    it('should return null for documents without effectiveDate', () => {
      const doc: DocumentWithFreshness = {
        id: 'doc-1',
        documentType: 'msp_guide',
      };

      const result = checker.checkDocument(doc);

      expect(result).toBeNull();
    });

    it('should map msp_guide to msp_income_limits data type', () => {
      const doc: DocumentWithFreshness = {
        id: 'doc-1',
        documentType: 'msp_guide',
        effectiveDate: new Date('2024-04-15'),
      };

      const result = checker.checkDocument(doc, new Date('2025-05-15'));

      expect(result).not.toBeNull();
      expect(result!.dataType).toBe('msp_income_limits');
      expect(result!.isStale).toBe(true);
    });

    it('should map income_limits to federal_poverty_level data type', () => {
      const doc: DocumentWithFreshness = {
        id: 'doc-1',
        documentType: 'income_limits',
        effectiveDate: new Date('2024-01-15'),
      };

      const result = checker.checkDocument(doc, new Date('2024-06-15'));

      expect(result).not.toBeNull();
      expect(result!.dataType).toBe('federal_poverty_level');
    });

    it('should return null for unmapped document types', () => {
      const doc: DocumentWithFreshness = {
        id: 'doc-1',
        documentType: 'unknown_document_type',
        effectiveDate: new Date('2024-01-15'),
      };

      const result = checker.checkDocument(doc);

      expect(result).toBeNull();
    });
  });

  describe('getStaleDataTypes', () => {
    it('should return only stale documents', () => {
      const documents: DocumentWithFreshness[] = [
        { id: '1', documentType: 'msp_guide', effectiveDate: new Date('2025-04-15') }, // Current
        { id: '2', documentType: 'msp_guide', effectiveDate: new Date('2023-04-15') }, // Old
        { id: '3', documentType: 'income_limits', effectiveDate: new Date('2024-01-15') }, // Stale
      ];

      const stale = checker.getStaleDataTypes(documents, new Date('2025-05-15'));

      expect(stale.length).toBe(2); // Only docs 2 and 3 are stale
      expect(stale.every((s) => s.isStale)).toBe(true);
    });

    it('should return empty array when no documents are stale', () => {
      const documents: DocumentWithFreshness[] = [
        { id: '1', documentType: 'msp_guide', effectiveDate: new Date('2024-04-15') },
      ];

      const stale = checker.getStaleDataTypes(documents, new Date('2024-06-15'));

      expect(stale.length).toBe(0);
    });

    it('should skip documents that cannot be checked', () => {
      const documents: DocumentWithFreshness[] = [
        { id: '1' }, // No type or date
        { id: '2', documentType: 'unknown' }, // Unknown type
        { id: '3', documentType: 'msp_guide', effectiveDate: new Date('2023-04-15') },
      ];

      const stale = checker.getStaleDataTypes(documents, new Date('2025-05-15'));

      expect(stale.length).toBe(1);
    });
  });

  describe('getRule and getAllRules', () => {
    it('should return rule for known data type', () => {
      const rule = checker.getRule('federal_poverty_level');

      expect(rule).toBeDefined();
      expect(rule!.updateFrequency).toBe('annually_january');
      expect(rule!.sourceName).toBe('Federal Register');
    });

    it('should return undefined for unknown data type', () => {
      const rule = checker.getRule('nonexistent' as DataType);

      expect(rule).toBeUndefined();
    });

    it('should return all rules', () => {
      const rules = checker.getAllRules();

      expect(rules.length).toBeGreaterThan(0);
      expect(rules.some((r) => r.dataType === 'federal_poverty_level')).toBe(true);
      expect(rules.some((r) => r.dataType === 'msp_income_limits')).toBe(true);
    });
  });

  describe('custom rules', () => {
    it('should use custom rules when provided', () => {
      const customRules: FreshnessRule[] = [
        {
          dataType: 'federal_poverty_level',
          updateFrequency: 'monthly', // Override to monthly
          sourceName: 'Custom Source',
        },
      ];

      const customChecker = new FreshnessChecker(customRules);

      const effectiveDate = new Date('2024-01-15');
      const checkDate = new Date('2024-03-15'); // More than 1 month

      const result = customChecker.checkDataType('federal_poverty_level', effectiveDate, checkDate);

      expect(result.isStale).toBe(true); // Would be false with default annual rule
    });
  });
});

describe('getFreshnessChecker', () => {
  beforeEach(() => {
    resetFreshnessChecker();
  });

  afterEach(() => {
    resetFreshnessChecker();
  });

  it('should return singleton instance', () => {
    const checker1 = getFreshnessChecker();
    const checker2 = getFreshnessChecker();

    expect(checker1).toBe(checker2);
  });

  it('should return new instance after reset', () => {
    const checker1 = getFreshnessChecker();
    resetFreshnessChecker();
    const checker2 = getFreshnessChecker();

    expect(checker1).not.toBe(checker2);
  });
});
