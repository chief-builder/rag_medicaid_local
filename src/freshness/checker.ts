import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('freshness-checker');

/**
 * Data types that have specific update schedules
 */
export type DataType =
  | 'federal_poverty_level'
  | 'msp_income_limits'
  | 'nursing_home_fbr'
  | 'spousal_protection'
  | 'part_d_costs'
  | 'pace_pacenet_limits'
  | 'chester_county_contacts'
  // Phase 1 additions
  | 'oim_ops_memo'
  | 'oim_policy_clarification'
  | 'pa_bulletin_dhs'
  | 'oim_ltc_handbook'
  | 'oim_ma_handbook'
  | 'pa_code_chapter_258'
  // Phase 3: CHC Managed Care additions
  | 'chc_publications'
  | 'chc_handbook_upmc'
  | 'chc_handbook_amerihealth'
  | 'chc_handbook_phw';

/**
 * Update frequency types
 */
export type UpdateFrequency =
  | 'annually_january'
  | 'annually_april'
  | 'annually_october'
  | 'quarterly'
  | 'monthly'
  | 'weekly'
  | 'as_needed';

/**
 * Warning levels for stale data
 */
export type WarningLevel = 'none' | 'info' | 'warning' | 'critical';

/**
 * Result of a freshness check
 */
export interface FreshnessCheck {
  dataType: DataType;
  isStale: boolean;
  staleSince?: Date;
  nextExpectedUpdate?: Date;
  warningLevel: WarningLevel;
  warningMessage?: string;
}

/**
 * Freshness rule configuration
 */
export interface FreshnessRule {
  dataType: DataType;
  updateFrequency: UpdateFrequency;
  typicalUpdateMonth?: number; // 1=Jan, 4=Apr, 10=Oct
  sourceName: string;
  sourceUrl?: string;
  lastKnownUpdate?: Date;
}

/**
 * Document with freshness metadata
 */
export interface DocumentWithFreshness {
  id: string;
  documentType?: string;
  effectiveDate?: Date;
  updateFrequency?: UpdateFrequency;
}

/**
 * Default freshness rules based on Medicaid/Medicare update schedules
 */
const DEFAULT_RULES: FreshnessRule[] = [
  {
    dataType: 'federal_poverty_level',
    updateFrequency: 'annually_january',
    typicalUpdateMonth: 1,
    sourceName: 'Federal Register',
    sourceUrl: 'https://aspe.hhs.gov/poverty-guidelines',
  },
  {
    dataType: 'msp_income_limits',
    updateFrequency: 'annually_april',
    typicalUpdateMonth: 4,
    sourceName: 'CMS/PHLP',
  },
  {
    dataType: 'nursing_home_fbr',
    updateFrequency: 'annually_january',
    typicalUpdateMonth: 1,
    sourceName: 'SSA',
    sourceUrl: 'https://www.ssa.gov/oact/cola/SSI.html',
  },
  {
    dataType: 'spousal_protection',
    updateFrequency: 'annually_january',
    typicalUpdateMonth: 1,
    sourceName: 'CMS',
  },
  {
    dataType: 'part_d_costs',
    updateFrequency: 'annually_october',
    typicalUpdateMonth: 10,
    sourceName: 'Medicare.gov',
    sourceUrl: 'https://www.medicare.gov/drug-coverage-part-d',
  },
  {
    dataType: 'pace_pacenet_limits',
    updateFrequency: 'annually_january',
    typicalUpdateMonth: 1,
    sourceName: 'PA Aging',
    sourceUrl: 'https://www.aging.pa.gov',
  },
  {
    dataType: 'chester_county_contacts',
    updateFrequency: 'quarterly',
    sourceName: 'County websites',
  },
  // Phase 1 additions - OIM and PA Code/Bulletin sources
  {
    dataType: 'oim_ops_memo',
    updateFrequency: 'weekly',
    sourceName: 'PA DHS Office of Income Maintenance',
    sourceUrl: 'http://services.dpw.state.pa.us/oimpolicymanuals/ma/300_OpsMemo_PolicyClarifications/300_Operations_Memoranda.htm',
  },
  {
    dataType: 'oim_policy_clarification',
    updateFrequency: 'weekly',
    sourceName: 'PA DHS Office of Income Maintenance',
    sourceUrl: 'http://services.dpw.state.pa.us/oimpolicymanuals/ma/300_Forms_Operations_Memoranda_and_Policy_Clarifications/300_Policy_Clarifications.htm',
  },
  {
    dataType: 'pa_bulletin_dhs',
    updateFrequency: 'weekly',
    sourceName: 'Pennsylvania Bulletin',
    sourceUrl: 'https://www.pacodeandbulletin.gov/Display/pabull',
  },
  {
    dataType: 'oim_ltc_handbook',
    updateFrequency: 'monthly',
    sourceName: 'PA DHS Office of Income Maintenance',
    sourceUrl: 'http://services.dpw.state.pa.us/oimpolicymanuals/ltc/Long-Term_Care_Handbook.htm',
  },
  {
    dataType: 'oim_ma_handbook',
    updateFrequency: 'monthly',
    sourceName: 'PA DHS Office of Income Maintenance',
    sourceUrl: 'http://services.dpw.state.pa.us/oimpolicymanuals/ma/Medical_Assistance_Handbook.htm',
  },
  {
    dataType: 'pa_code_chapter_258',
    updateFrequency: 'as_needed',
    sourceName: 'Pennsylvania Code',
    sourceUrl: 'https://www.pacodeandbulletin.gov/Display/pacode?file=/secure/pacode/data/055/chapter258/chap258toc.html',
  },
  // Phase 3: CHC Managed Care additions
  {
    dataType: 'chc_publications',
    updateFrequency: 'quarterly',
    sourceName: 'PA DHS Community HealthChoices',
    sourceUrl: 'https://www.pa.gov/agencies/dhs/resources/aging-physical-disabilities/community-healthchoices/publications',
  },
  {
    dataType: 'chc_handbook_upmc',
    updateFrequency: 'annually_january',
    typicalUpdateMonth: 1,
    sourceName: 'UPMC Community HealthChoices',
    sourceUrl: 'https://www.upmchealthplan.com/chc/member-handbook',
  },
  {
    dataType: 'chc_handbook_amerihealth',
    updateFrequency: 'annually_january',
    typicalUpdateMonth: 1,
    sourceName: 'AmeriHealth Caritas PA Community HealthChoices',
    sourceUrl: 'https://www.amerihealthcaritaschc.com/member/resources/handbooks',
  },
  {
    dataType: 'chc_handbook_phw',
    updateFrequency: 'annually_january',
    typicalUpdateMonth: 1,
    sourceName: 'PA Health & Wellness',
    sourceUrl: 'https://www.pahealthwellness.com/members/chc/resources',
  },
];

/**
 * Freshness checker for document data
 */
export class FreshnessChecker {
  private rules: Map<DataType, FreshnessRule>;

  constructor(customRules?: FreshnessRule[]) {
    this.rules = new Map();
    const rulesToUse = customRules || DEFAULT_RULES;

    for (const rule of rulesToUse) {
      this.rules.set(rule.dataType, rule);
    }
  }

  /**
   * Check freshness of a specific data type
   */
  checkDataType(dataType: DataType, effectiveDate: Date, checkDate: Date = new Date()): FreshnessCheck {
    const rule = this.rules.get(dataType);

    if (!rule) {
      logger.debug({ dataType }, 'No freshness rule found for data type');
      return {
        dataType,
        isStale: false,
        warningLevel: 'none',
      };
    }

    return this.evaluateFreshness(rule, effectiveDate, checkDate);
  }

  /**
   * Check freshness of a document
   */
  checkDocument(doc: DocumentWithFreshness, checkDate: Date = new Date()): FreshnessCheck | null {
    if (!doc.documentType || !doc.effectiveDate) {
      return null;
    }

    // Map document types to data types
    const dataTypeMap: Record<string, DataType> = {
      msp_guide: 'msp_income_limits',
      income_limits: 'federal_poverty_level',
      ltc_info: 'nursing_home_fbr',
      estate_recovery: 'nursing_home_fbr',
      pace_pacenet: 'pace_pacenet_limits',
      life_program: 'nursing_home_fbr',
      chc_waiver: 'nursing_home_fbr',
      general_eligibility: 'federal_poverty_level',
      // Phase 1 additions
      oim_ltc_handbook: 'oim_ltc_handbook',
      oim_ma_handbook: 'oim_ma_handbook',
      oim_ops_memo: 'oim_ops_memo',
      oim_policy_clarification: 'oim_policy_clarification',
      pa_code: 'pa_code_chapter_258',
      pa_bulletin: 'pa_bulletin_dhs',
      // Phase 3: CHC Managed Care additions
      chc_publications: 'chc_publications',
      chc_handbook: 'chc_handbook_upmc', // Default to UPMC; specific MCO handled via metadata
    };

    const dataType = dataTypeMap[doc.documentType];
    if (!dataType) {
      return null;
    }

    return this.checkDataType(dataType, doc.effectiveDate, checkDate);
  }

  /**
   * Evaluate freshness based on rule
   */
  private evaluateFreshness(
    rule: FreshnessRule,
    effectiveDate: Date,
    checkDate: Date
  ): FreshnessCheck {
    const effectiveYear = effectiveDate.getFullYear();
    const checkYear = checkDate.getFullYear();
    const checkMonth = checkDate.getMonth() + 1; // 1-indexed

    let isStale = false;
    let warningLevel: WarningLevel = 'none';
    let warningMessage: string | undefined;
    let staleSince: Date | undefined;
    let nextExpectedUpdate: Date | undefined;

    switch (rule.updateFrequency) {
      case 'annually_january':
      case 'annually_april':
      case 'annually_october': {
        const updateMonth = rule.typicalUpdateMonth || 1;

        // If we're in a new year and past the update month, data may be stale
        if (checkYear > effectiveYear && checkMonth >= updateMonth) {
          isStale = true;
          staleSince = new Date(checkYear, updateMonth - 1, 1);
          warningMessage = `This ${formatDataType(rule.dataType)} data is from ${effectiveYear}. ` +
            `${checkYear} updates are typically available after ${getMonthName(updateMonth)} ${checkYear}.`;
          warningLevel = checkMonth > updateMonth ? 'warning' : 'info';
        }

        // Calculate next expected update
        if (checkMonth < updateMonth) {
          nextExpectedUpdate = new Date(checkYear, updateMonth - 1, 1);
        } else {
          nextExpectedUpdate = new Date(checkYear + 1, updateMonth - 1, 1);
        }
        break;
      }

      case 'quarterly': {
        // Check if more than 3 months old
        const monthsDiffQuarterly = (checkYear - effectiveYear) * 12 + (checkMonth - (effectiveDate.getMonth() + 1));
        if (monthsDiffQuarterly > 3) {
          isStale = true;
          warningLevel = 'info';
          warningMessage = `This ${formatDataType(rule.dataType)} may be outdated. Contact information should be verified quarterly.`;
        }
        break;
      }

      case 'monthly': {
        // Check if more than 1 month old
        const monthsDiffMonthly = (checkYear - effectiveYear) * 12 + (checkMonth - (effectiveDate.getMonth() + 1));
        if (monthsDiffMonthly > 1) {
          isStale = true;
          warningLevel = monthsDiffMonthly > 3 ? 'warning' : 'info';
          warningMessage = `This ${formatDataType(rule.dataType)} may be outdated. Policy handbooks should be checked monthly.`;
        }
        break;
      }

      case 'weekly': {
        // Check if more than 1 week old (approximately 7 days)
        const daysDiff = Math.floor((checkDate.getTime() - effectiveDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff > 7) {
          isStale = true;
          warningLevel = daysDiff > 14 ? 'warning' : 'info';
          warningMessage = `This ${formatDataType(rule.dataType)} may be outdated. This source should be checked weekly for updates.`;
        }
        break;
      }

      case 'as_needed':
        // No automatic staleness for as-needed data
        break;
    }

    // Escalate to critical if more than a year stale
    if (isStale && checkYear > effectiveYear + 1) {
      warningLevel = 'critical';
      warningMessage = `This ${formatDataType(rule.dataType)} data is from ${effectiveYear} and is significantly outdated. ` +
        `Please verify current information with ${rule.sourceName}.`;
    }

    logger.debug(
      { dataType: rule.dataType, effectiveYear, checkYear, isStale, warningLevel },
      'Freshness check result'
    );

    return {
      dataType: rule.dataType,
      isStale,
      staleSince,
      nextExpectedUpdate,
      warningLevel,
      warningMessage,
    };
  }

  /**
   * Get all stale data types as of a given date
   */
  getStaleDataTypes(documents: DocumentWithFreshness[], checkDate: Date = new Date()): FreshnessCheck[] {
    const staleChecks: FreshnessCheck[] = [];

    for (const doc of documents) {
      const check = this.checkDocument(doc, checkDate);
      if (check?.isStale) {
        staleChecks.push(check);
      }
    }

    return staleChecks;
  }

  /**
   * Get freshness rule for a data type
   */
  getRule(dataType: DataType): FreshnessRule | undefined {
    return this.rules.get(dataType);
  }

  /**
   * Get all rules
   */
  getAllRules(): FreshnessRule[] {
    return Array.from(this.rules.values());
  }
}

/**
 * Format data type for display
 */
function formatDataType(dataType: DataType): string {
  const formats: Record<DataType, string> = {
    federal_poverty_level: 'Federal Poverty Level (FPL)',
    msp_income_limits: 'Medicare Savings Program income limits',
    nursing_home_fbr: 'nursing home income limits',
    spousal_protection: 'spousal protection amounts',
    part_d_costs: 'Part D prescription drug costs',
    pace_pacenet_limits: 'PACE/PACENET income limits',
    chester_county_contacts: 'Chester County contact information',
    // Phase 1 additions
    oim_ops_memo: 'OIM Operations Memoranda',
    oim_policy_clarification: 'OIM Policy Clarifications',
    pa_bulletin_dhs: 'PA Bulletin DHS notices',
    oim_ltc_handbook: 'OIM Long-Term Care Handbook',
    oim_ma_handbook: 'OIM Medical Assistance Handbook',
    pa_code_chapter_258: 'PA Code Chapter 258 (Estate Recovery)',
    // Phase 3: CHC Managed Care additions
    chc_publications: 'CHC Publications Hub',
    chc_handbook_upmc: 'UPMC Community HealthChoices Handbook',
    chc_handbook_amerihealth: 'AmeriHealth Caritas CHC Handbook',
    chc_handbook_phw: 'PA Health & Wellness CHC Handbook',
  };

  return formats[dataType] || dataType;
}

/**
 * Get month name from number
 */
function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return months[month - 1] || 'Unknown';
}

// Singleton instance
let checkerInstance: FreshnessChecker | null = null;

export function getFreshnessChecker(): FreshnessChecker {
  if (!checkerInstance) {
    checkerInstance = new FreshnessChecker();
  }
  return checkerInstance;
}

export function resetFreshnessChecker(): void {
  checkerInstance = null;
}
