import { describe, it, expect, beforeEach } from 'vitest';
import { FreshnessChecker, DataType, FreshnessRule } from './checker.js';

describe('FreshnessChecker', () => {
  let checker: FreshnessChecker;

  beforeEach(() => {
    checker = new FreshnessChecker();
  });

  describe('checkDataType', () => {
    it('should flag stale FPL data after January', () => {
      const effectiveDate = new Date('2024-01-01');
      const checkDate = new Date('2025-02-15');

      const result = checker.checkDataType('federal_poverty_level', effectiveDate, checkDate);

      expect(result.isStale).toBe(true);
      expect(result.warningLevel).toBe('warning');
      expect(result.warningMessage).toContain('2024');
      expect(result.warningMessage).toContain('2025');
    });

    it('should NOT flag current year FPL data', () => {
      const effectiveDate = new Date('2025-01-01');
      const checkDate = new Date('2025-03-15');

      const result = checker.checkDataType('federal_poverty_level', effectiveDate, checkDate);

      expect(result.isStale).toBe(false);
      expect(result.warningLevel).toBe('none');
    });

    it('should flag stale MSP limits after April', () => {
      const effectiveDate = new Date('2024-04-01');
      const checkDate = new Date('2025-05-01');

      const result = checker.checkDataType('msp_income_limits', effectiveDate, checkDate);

      expect(result.isStale).toBe(true);
      expect(result.warningLevel).toBe('warning');
      expect(result.warningMessage).toContain('Medicare Savings Program');
    });

    it('should show info warning before typical update month', () => {
      const effectiveDate = new Date('2024-04-01');
      const checkDate = new Date('2025-04-01'); // Exactly on update month

      const result = checker.checkDataType('msp_income_limits', effectiveDate, checkDate);

      expect(result.isStale).toBe(true);
      expect(result.warningLevel).toBe('info');
    });

    it('should flag Part D costs after October', () => {
      const effectiveDate = new Date('2024-10-01');
      const checkDate = new Date('2025-11-01');

      const result = checker.checkDataType('part_d_costs', effectiveDate, checkDate);

      expect(result.isStale).toBe(true);
      expect(result.warningMessage).toContain('Part D');
    });

    it('should calculate next expected update correctly', () => {
      const effectiveDate = new Date('2024-01-01');
      const checkDate = new Date('2024-06-15'); // Before next January

      const result = checker.checkDataType('federal_poverty_level', effectiveDate, checkDate);

      expect(result.nextExpectedUpdate).toBeDefined();
      expect(result.nextExpectedUpdate?.getFullYear()).toBe(2025);
      expect(result.nextExpectedUpdate?.getMonth()).toBe(0); // January
    });

    it('should escalate to critical for very stale data', () => {
      const effectiveDate = new Date('2022-01-01');
      const checkDate = new Date('2025-03-01');

      const result = checker.checkDataType('federal_poverty_level', effectiveDate, checkDate);

      expect(result.isStale).toBe(true);
      expect(result.warningLevel).toBe('critical');
      expect(result.warningMessage).toContain('significantly outdated');
    });

    it('should handle quarterly data freshness', () => {
      const effectiveDate = new Date('2024-01-15');
      const checkDate = new Date('2024-06-01'); // 4+ months later

      const result = checker.checkDataType('chester_county_contacts', effectiveDate, checkDate);

      expect(result.isStale).toBe(true);
      expect(result.warningLevel).toBe('info');
      expect(result.warningMessage).toContain('quarterly');
    });
  });

  describe('checkDocument', () => {
    it('should check MSP guide document freshness', () => {
      const doc = {
        id: 'doc-1',
        documentType: 'msp_guide',
        effectiveDate: new Date('2024-04-01'),
      };
      const checkDate = new Date('2025-05-15');

      const result = checker.checkDocument(doc, checkDate);

      expect(result).not.toBeNull();
      expect(result?.isStale).toBe(true);
      expect(result?.dataType).toBe('msp_income_limits');
    });

    it('should check income limits document freshness', () => {
      const doc = {
        id: 'doc-2',
        documentType: 'income_limits',
        effectiveDate: new Date('2024-01-01'),
      };
      const checkDate = new Date('2025-02-01');

      const result = checker.checkDocument(doc, checkDate);

      expect(result).not.toBeNull();
      expect(result?.isStale).toBe(true);
      expect(result?.dataType).toBe('federal_poverty_level');
    });

    it('should return null for documents without type', () => {
      const doc = {
        id: 'doc-3',
        effectiveDate: new Date('2024-01-01'),
      };

      const result = checker.checkDocument(doc);
      expect(result).toBeNull();
    });

    it('should return null for documents without effective date', () => {
      const doc = {
        id: 'doc-4',
        documentType: 'msp_guide',
      };

      const result = checker.checkDocument(doc);
      expect(result).toBeNull();
    });

    it('should return null for unknown document types', () => {
      const doc = {
        id: 'doc-5',
        documentType: 'unknown_type',
        effectiveDate: new Date('2024-01-01'),
      };

      const result = checker.checkDocument(doc);
      expect(result).toBeNull();
    });
  });

  describe('getStaleDataTypes', () => {
    it('should return all stale documents', () => {
      const documents = [
        { id: 'doc-1', documentType: 'msp_guide', effectiveDate: new Date('2024-04-01') },
        { id: 'doc-2', documentType: 'income_limits', effectiveDate: new Date('2025-01-01') },
        { id: 'doc-3', documentType: 'ltc_info', effectiveDate: new Date('2023-01-01') },
      ];
      const checkDate = new Date('2025-05-15');

      const stale = checker.getStaleDataTypes(documents, checkDate);

      expect(stale.length).toBe(2); // MSP and LTC (2023 is very stale)
      expect(stale.some(s => s.dataType === 'msp_income_limits')).toBe(true);
    });

    it('should return empty array when no documents are stale', () => {
      const documents = [
        { id: 'doc-1', documentType: 'msp_guide', effectiveDate: new Date('2025-04-01') },
      ];
      const checkDate = new Date('2025-04-15');

      const stale = checker.getStaleDataTypes(documents, checkDate);

      expect(stale.length).toBe(0);
    });
  });

  describe('getRule', () => {
    it('should return rule for known data types', () => {
      const rule = checker.getRule('federal_poverty_level');

      expect(rule).toBeDefined();
      expect(rule?.updateFrequency).toBe('annually_january');
      expect(rule?.typicalUpdateMonth).toBe(1);
    });

    it('should return undefined for unknown data types', () => {
      const rule = checker.getRule('unknown' as DataType);
      expect(rule).toBeUndefined();
    });
  });

  describe('getAllRules', () => {
    it('should return all default rules', () => {
      const rules = checker.getAllRules();

      expect(rules.length).toBeGreaterThan(0);
      expect(rules.some(r => r.dataType === 'federal_poverty_level')).toBe(true);
      expect(rules.some(r => r.dataType === 'msp_income_limits')).toBe(true);
    });
  });

  describe('custom rules', () => {
    it('should use custom rules when provided', () => {
      const customRules: FreshnessRule[] = [
        {
          dataType: 'federal_poverty_level',
          updateFrequency: 'annually_april', // Changed from January
          typicalUpdateMonth: 4,
          sourceName: 'Custom Source',
        },
      ];

      const customChecker = new FreshnessChecker(customRules);
      const effectiveDate = new Date('2024-01-01');
      const checkDate = new Date('2025-02-01'); // Before April

      const result = customChecker.checkDataType('federal_poverty_level', effectiveDate, checkDate);

      // Should not be stale yet because custom rule says April
      expect(result.isStale).toBe(false);
    });
  });
});
