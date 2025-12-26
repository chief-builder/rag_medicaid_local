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
  | 'chester_county_contacts';

/**
 * Update frequency types
 */
export type UpdateFrequency =
  | 'annually_january'
  | 'annually_april'
  | 'annually_october'
  | 'quarterly'
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
      case 'annually_october':
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

      case 'quarterly':
        // Check if more than 3 months old
        const monthsDiff = (checkYear - effectiveYear) * 12 + (checkMonth - (effectiveDate.getMonth() + 1));
        if (monthsDiff > 3) {
          isStale = true;
          warningLevel = 'info';
          warningMessage = `This ${formatDataType(rule.dataType)} may be outdated. Contact information should be verified quarterly.`;
        }
        break;

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
