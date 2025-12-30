import { describe, it, expect, beforeEach } from 'vitest';
import { FreshnessChecker, DataType, FreshnessRule } from './checker.js';

describe('FreshnessChecker', () => {
  let checker: FreshnessChecker;

  beforeEach(() => {
    checker = new FreshnessChecker();
  });

  describe('checkDataType', () => {
    it('should flag stale FPL data after January', () => {
      // Use dates where effective year < check year AND check month >= update month (1 = January)
      // AND check month > update month for 'warning' level
      const effectiveDate = new Date(2024, 0, 1);
      const checkDate = new Date(2025, 1, 15); // Feb > Jan, so warningLevel = 'warning'

      const result = checker.checkDataType('federal_poverty_level', effectiveDate, checkDate);

      expect(result.isStale).toBe(true);
      // Since checkMonth (2) > updateMonth (1), it should be 'warning'
      expect(result.warningLevel).toBe('warning');
      expect(result.warningMessage).toContain('2024');
      expect(result.warningMessage).toContain('2025');
    });

    it('should NOT flag current year FPL data', () => {
      // FPL updates in January, so 2025-01-01 effective date checked in March 2025
      // checkYear (2025) > effectiveYear (2025) is FALSE, so NOT stale
      const effectiveDate = new Date(2025, 0, 1);
      const checkDate = new Date(2025, 2, 15);

      const result = checker.checkDataType('federal_poverty_level', effectiveDate, checkDate);

      expect(result.isStale).toBe(false);
      expect(result.warningLevel).toBe('none');
    });

    it('should flag stale MSP limits after April', () => {
      // MSP updates in April (month 4)
      // checkYear (2025) > effectiveYear (2024) AND checkMonth (5) >= updateMonth (4)
      // checkMonth (5) > updateMonth (4) so warningLevel = 'warning'
      const effectiveDate = new Date(2024, 3, 1);
      const checkDate = new Date(2025, 4, 1);

      const result = checker.checkDataType('msp_income_limits', effectiveDate, checkDate);

      expect(result.isStale).toBe(true);
      expect(result.warningLevel).toBe('warning');
      expect(result.warningMessage).toContain('Medicare Savings Program');
    });

    it('should show info warning ON typical update month', () => {
      // MSP updates in April (month 4)
      // checkYear (2025) > effectiveYear (2024) AND checkMonth (4) >= updateMonth (4)
      // checkMonth (4) == updateMonth (4) so warningLevel = 'info' (not > updateMonth)
      const effectiveDate = new Date(2024, 3, 1);
      const checkDate = new Date(2025, 3, 1); // Exactly on update month

      const result = checker.checkDataType('msp_income_limits', effectiveDate, checkDate);

      expect(result.isStale).toBe(true);
      expect(result.warningLevel).toBe('info');
    });

    it('should flag Part D costs after October', () => {
      const effectiveDate = new Date(2024, 9, 1);
      const checkDate = new Date(2025, 10, 1);

      const result = checker.checkDataType('part_d_costs', effectiveDate, checkDate);

      expect(result.isStale).toBe(true);
      expect(result.warningMessage).toContain('Part D');
    });

    it('should calculate next expected update correctly', () => {
      const effectiveDate = new Date(2024, 0, 1);
      const checkDate = new Date(2024, 5, 15); // Before next January

      const result = checker.checkDataType('federal_poverty_level', effectiveDate, checkDate);

      expect(result.nextExpectedUpdate).toBeDefined();
      expect(result.nextExpectedUpdate?.getFullYear()).toBe(2025);
      expect(result.nextExpectedUpdate?.getMonth()).toBe(0); // January
    });

    it('should escalate to critical for very stale data', () => {
      const effectiveDate = new Date(2022, 0, 1);
      const checkDate = new Date(2025, 2, 1);

      const result = checker.checkDataType('federal_poverty_level', effectiveDate, checkDate);

      expect(result.isStale).toBe(true);
      expect(result.warningLevel).toBe('critical');
      expect(result.warningMessage).toContain('significantly outdated');
    });

    it('should handle quarterly data freshness', () => {
      const effectiveDate = new Date(2024, 0, 15);
      const checkDate = new Date(2024, 5, 1); // 4+ months later

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
        effectiveDate: new Date(2024, 3, 1),
      };
      const checkDate = new Date(2025, 4, 15);

      const result = checker.checkDocument(doc, checkDate);

      expect(result).not.toBeNull();
      expect(result?.isStale).toBe(true);
      expect(result?.dataType).toBe('msp_income_limits');
    });

    it('should check income limits document freshness', () => {
      const doc = {
        id: 'doc-2',
        documentType: 'income_limits',
        effectiveDate: new Date(2024, 0, 1),
      };
      const checkDate = new Date(2025, 1, 1);

      const result = checker.checkDocument(doc, checkDate);

      expect(result).not.toBeNull();
      expect(result?.isStale).toBe(true);
      expect(result?.dataType).toBe('federal_poverty_level');
    });

    it('should return null for documents without type', () => {
      const doc = {
        id: 'doc-3',
        effectiveDate: new Date(2024, 0, 1),
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
        effectiveDate: new Date(2024, 0, 1),
      };

      const result = checker.checkDocument(doc);
      expect(result).toBeNull();
    });
  });

  describe('getStaleDataTypes', () => {
    it('should return all stale documents', () => {
      const documents = [
        { id: 'doc-1', documentType: 'msp_guide', effectiveDate: new Date(2024, 3, 1) },
        { id: 'doc-2', documentType: 'income_limits', effectiveDate: new Date(2025, 0, 1) },
        { id: 'doc-3', documentType: 'ltc_info', effectiveDate: new Date(2023, 0, 1) },
      ];
      const checkDate = new Date(2025, 4, 15);

      const stale = checker.getStaleDataTypes(documents, checkDate);

      expect(stale.length).toBe(2); // MSP and LTC (2023 is very stale)
      expect(stale.some(s => s.dataType === 'msp_income_limits')).toBe(true);
    });

    it('should return empty array when no documents are stale', () => {
      const documents = [
        { id: 'doc-1', documentType: 'msp_guide', effectiveDate: new Date(2025, 3, 1) },
      ];
      const checkDate = new Date(2025, 3, 15);

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
      const effectiveDate = new Date(2024, 0, 1);
      const checkDate = new Date(2025, 1, 1); // Before April

      const result = customChecker.checkDataType('federal_poverty_level', effectiveDate, checkDate);

      // Should not be stale yet because custom rule says April
      expect(result.isStale).toBe(false);
    });
  });

  describe('Phase 1 data types - Weekly updates', () => {
    it('should flag OIM ops memo data as stale after 7 days', () => {
      const effectiveDate = new Date(2025, 0, 1);
      const checkDate = new Date(2025, 0, 20); // 19 days later (> 14 days for warning)

      const result = checker.checkDataType('oim_ops_memo', effectiveDate, checkDate);

      expect(result.isStale).toBe(true);
      expect(result.warningLevel).toBe('warning');
      expect(result.warningMessage).toContain('weekly');
    });

    it('should NOT flag OIM ops memo data within 7 days', () => {
      const effectiveDate = new Date(2025, 0, 10);
      const checkDate = new Date(2025, 0, 15); // 5 days later

      const result = checker.checkDataType('oim_ops_memo', effectiveDate, checkDate);

      expect(result.isStale).toBe(false);
      expect(result.warningLevel).toBe('none');
    });

    it('should flag policy clarifications as stale after 7 days', () => {
      const effectiveDate = new Date(2025, 1, 1);
      const checkDate = new Date(2025, 1, 12); // 11 days later

      const result = checker.checkDataType('oim_policy_clarification', effectiveDate, checkDate);

      expect(result.isStale).toBe(true);
      expect(result.warningMessage).toContain('weekly');
    });

    it('should flag PA Bulletin DHS notices as stale after 7 days', () => {
      const effectiveDate = new Date(2025, 2, 1);
      const checkDate = new Date(2025, 2, 10); // 9 days later

      const result = checker.checkDataType('pa_bulletin_dhs', effectiveDate, checkDate);

      expect(result.isStale).toBe(true);
    });

    it('should show info level for weekly data 8-14 days old', () => {
      const effectiveDate = new Date(2025, 0, 1);
      const checkDate = new Date(2025, 0, 10); // 9 days later

      const result = checker.checkDataType('oim_ops_memo', effectiveDate, checkDate);

      expect(result.isStale).toBe(true);
      expect(result.warningLevel).toBe('info');
    });

    it('should show warning level for weekly data over 14 days old', () => {
      const effectiveDate = new Date(2025, 0, 1);
      const checkDate = new Date(2025, 0, 20); // 19 days later

      const result = checker.checkDataType('oim_ops_memo', effectiveDate, checkDate);

      expect(result.isStale).toBe(true);
      expect(result.warningLevel).toBe('warning');
    });
  });

  describe('Phase 1 data types - Monthly updates', () => {
    it('should flag OIM LTC handbook as stale after 1 month', () => {
      const effectiveDate = new Date(2025, 0, 1);
      const checkDate = new Date(2025, 2, 15); // ~2.5 months later

      const result = checker.checkDataType('oim_ltc_handbook', effectiveDate, checkDate);

      expect(result.isStale).toBe(true);
      expect(result.warningMessage).toContain('monthly');
    });

    it('should NOT flag OIM LTC handbook within 1 month', () => {
      const effectiveDate = new Date(2025, 0, 15);
      const checkDate = new Date(2025, 1, 1); // < 1 month

      const result = checker.checkDataType('oim_ltc_handbook', effectiveDate, checkDate);

      expect(result.isStale).toBe(false);
    });

    it('should flag OIM MA handbook as stale after 1 month', () => {
      const effectiveDate = new Date(2025, 1, 1);
      const checkDate = new Date(2025, 3, 1); // 2 months later

      const result = checker.checkDataType('oim_ma_handbook', effectiveDate, checkDate);

      expect(result.isStale).toBe(true);
      expect(result.warningMessage).toContain('handbook');
    });

    it('should show info level for monthly data 2-3 months old', () => {
      const effectiveDate = new Date(2025, 0, 1);
      const checkDate = new Date(2025, 2, 15); // ~2.5 months

      const result = checker.checkDataType('oim_ltc_handbook', effectiveDate, checkDate);

      expect(result.isStale).toBe(true);
      expect(result.warningLevel).toBe('info');
    });

    it('should show warning level for monthly data over 3 months old', () => {
      const effectiveDate = new Date(2025, 0, 1);
      const checkDate = new Date(2025, 4, 15); // ~4.5 months

      const result = checker.checkDataType('oim_ltc_handbook', effectiveDate, checkDate);

      expect(result.isStale).toBe(true);
      expect(result.warningLevel).toBe('warning');
    });
  });

  describe('Phase 1 data types - As-needed updates', () => {
    it('should NOT flag PA Code chapter as stale (as-needed schedule)', () => {
      const effectiveDate = new Date(2024, 0, 1);
      const checkDate = new Date(2025, 5, 1); // 18 months later

      const result = checker.checkDataType('pa_code_chapter_258', effectiveDate, checkDate);

      // as_needed frequency should not automatically flag as stale
      expect(result.isStale).toBe(false);
    });
  });

  describe('Phase 1 document type mapping', () => {
    it('should check oim_ltc_handbook document type', () => {
      const doc = {
        id: 'doc-1',
        documentType: 'oim_ltc_handbook',
        effectiveDate: new Date(2025, 0, 1),
      };
      const checkDate = new Date(2025, 3, 1);

      const result = checker.checkDocument(doc, checkDate);

      expect(result).not.toBeNull();
      expect(result?.dataType).toBe('oim_ltc_handbook');
      expect(result?.isStale).toBe(true);
    });

    it('should check oim_ops_memo document type', () => {
      const doc = {
        id: 'doc-2',
        documentType: 'oim_ops_memo',
        effectiveDate: new Date(2025, 0, 1),
      };
      const checkDate = new Date(2025, 0, 15);

      const result = checker.checkDocument(doc, checkDate);

      expect(result).not.toBeNull();
      expect(result?.dataType).toBe('oim_ops_memo');
    });

    it('should check pa_code document type', () => {
      const doc = {
        id: 'doc-3',
        documentType: 'pa_code',
        effectiveDate: new Date(2024, 5, 1),
      };
      const checkDate = new Date(2025, 0, 1);

      const result = checker.checkDocument(doc, checkDate);

      expect(result).not.toBeNull();
      expect(result?.dataType).toBe('pa_code_chapter_258');
    });

    it('should check pa_bulletin document type', () => {
      const doc = {
        id: 'doc-4',
        documentType: 'pa_bulletin',
        effectiveDate: new Date(2025, 0, 1),
      };
      const checkDate = new Date(2025, 0, 15);

      const result = checker.checkDocument(doc, checkDate);

      expect(result).not.toBeNull();
      expect(result?.dataType).toBe('pa_bulletin_dhs');
    });
  });

  describe('Phase 1 rules configuration', () => {
    it('should have rules for all Phase 1 data types', () => {
      const rules = checker.getAllRules();
      const phase1Types = [
        'oim_ops_memo',
        'oim_policy_clarification',
        'pa_bulletin_dhs',
        'oim_ltc_handbook',
        'oim_ma_handbook',
        'pa_code_chapter_258',
      ];

      for (const dataType of phase1Types) {
        const rule = rules.find((r) => r.dataType === dataType);
        expect(rule).toBeDefined();
      }
    });

    it('should have correct update frequency for OIM sources', () => {
      expect(checker.getRule('oim_ops_memo')?.updateFrequency).toBe('weekly');
      expect(checker.getRule('oim_policy_clarification')?.updateFrequency).toBe('weekly');
      expect(checker.getRule('oim_ltc_handbook')?.updateFrequency).toBe('monthly');
      expect(checker.getRule('oim_ma_handbook')?.updateFrequency).toBe('monthly');
    });

    it('should have correct update frequency for PA sources', () => {
      expect(checker.getRule('pa_bulletin_dhs')?.updateFrequency).toBe('weekly');
      expect(checker.getRule('pa_code_chapter_258')?.updateFrequency).toBe('as_needed');
    });

    it('should have source URLs for all Phase 1 rules', () => {
      const phase1Types: DataType[] = [
        'oim_ops_memo',
        'oim_policy_clarification',
        'pa_bulletin_dhs',
        'oim_ltc_handbook',
        'oim_ma_handbook',
        'pa_code_chapter_258',
      ];

      for (const dataType of phase1Types) {
        const rule = checker.getRule(dataType);
        expect(rule?.sourceUrl).toBeDefined();
      }
    });
  });

  // Phase 3: CHC Managed Care Tests
  describe('Phase 3: CHC Managed Care freshness', () => {
    it('should have rules for all CHC data types', () => {
      const rules = checker.getAllRules();
      const chcTypes = [
        'chc_publications',
        'chc_handbook_upmc',
        'chc_handbook_amerihealth',
        'chc_handbook_phw',
      ];

      for (const dataType of chcTypes) {
        const rule = rules.find((r) => r.dataType === dataType);
        expect(rule).toBeDefined();
      }
    });

    it('should have quarterly frequency for CHC publications', () => {
      expect(checker.getRule('chc_publications')?.updateFrequency).toBe('quarterly');
    });

    it('should have annual frequency for MCO handbooks', () => {
      expect(checker.getRule('chc_handbook_upmc')?.updateFrequency).toBe('annually_january');
      expect(checker.getRule('chc_handbook_amerihealth')?.updateFrequency).toBe('annually_january');
      expect(checker.getRule('chc_handbook_phw')?.updateFrequency).toBe('annually_january');
    });

    it('should have source URLs for all CHC rules', () => {
      const chcTypes: DataType[] = [
        'chc_publications',
        'chc_handbook_upmc',
        'chc_handbook_amerihealth',
        'chc_handbook_phw',
      ];

      for (const dataType of chcTypes) {
        const rule = checker.getRule(dataType);
        expect(rule?.sourceUrl).toBeDefined();
      }
    });

    it('should detect stale CHC publications after 3 months', () => {
      const effectiveDate = new Date(2025, 0, 1);
      const checkDate = new Date(2025, 4, 1); // 4 months later

      const result = checker.checkDataType('chc_publications', effectiveDate, checkDate);

      expect(result.isStale).toBe(true);
      expect(result.warningLevel).toBe('info');
    });

    it('should not detect stale CHC publications within 3 months', () => {
      const effectiveDate = new Date(2025, 0, 1);
      const checkDate = new Date(2025, 2, 1); // 2 months later

      const result = checker.checkDataType('chc_publications', effectiveDate, checkDate);

      expect(result.isStale).toBe(false);
    });

    it('should detect stale MCO handbook after annual update month', () => {
      const effectiveDate = new Date(2024, 0, 1); // Last year
      const checkDate = new Date(2025, 1, 1); // After January this year

      const result = checker.checkDataType('chc_handbook_upmc', effectiveDate, checkDate);

      expect(result.isStale).toBe(true);
      // 'warning' because we're past the update month (checkMonth > updateMonth)
      expect(result.warningLevel).toBe('warning');
    });

    it('should map chc_publications document type correctly', () => {
      const doc = {
        id: 'doc-chc-1',
        documentType: 'chc_publications',
        effectiveDate: new Date(2025, 0, 1),
      };
      const checkDate = new Date(2025, 0, 15);

      const result = checker.checkDocument(doc, checkDate);

      expect(result).not.toBeNull();
      expect(result?.dataType).toBe('chc_publications');
    });

    it('should map chc_handbook document type correctly', () => {
      const doc = {
        id: 'doc-chc-2',
        documentType: 'chc_handbook',
        effectiveDate: new Date(2025, 0, 1),
      };
      const checkDate = new Date(2025, 0, 15);

      const result = checker.checkDocument(doc, checkDate);

      expect(result).not.toBeNull();
      // Maps to default UPMC handbook type
      expect(result?.dataType).toBe('chc_handbook_upmc');
    });
  });
});
