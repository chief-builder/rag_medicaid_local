import { createChildLogger } from '../utils/logger.js';
import { FreshnessChecker, getFreshnessChecker, FreshnessCheck, DataType } from './checker.js';
import { Citation } from '../types/index.js';

const logger = createChildLogger('freshness-display');

/**
 * Source freshness information to display with answers
 */
export interface SourceFreshnessInfo {
  /** When sources were last retrieved/ingested */
  lastRetrieved: Date;
  /** Formatted date string for display */
  lastRetrievedFormatted: string;
  /** Effective period description (e.g., "Calendar Year 2025") */
  effectivePeriod?: string;
  /** Income limits effective period if applicable */
  incomeLimitsEffective?: string;
  /** Any freshness warnings */
  warnings: FreshnessWarning[];
  /** Whether any sources are stale */
  hasStaleData: boolean;
}

/**
 * A warning about potentially stale data
 */
export interface FreshnessWarning {
  /** Type of warning */
  level: 'info' | 'warning' | 'critical';
  /** Human-readable warning message */
  message: string;
  /** Data type that triggered the warning */
  dataType?: DataType;
}

/**
 * Document metadata used for freshness calculations
 */
export interface DocumentMetadata {
  documentType?: string;
  effectiveDate?: Date | string;
  updateFrequency?: string;
  filename?: string;
}

/**
 * Service for generating freshness information to display with answers
 */
export class FreshnessDisplayService {
  private checker: FreshnessChecker;
  private systemIngestionDate: Date | null = null;

  constructor(checker?: FreshnessChecker) {
    this.checker = checker || getFreshnessChecker();
  }

  /**
   * Set the system-level last ingestion date
   */
  setSystemIngestionDate(date: Date): void {
    this.systemIngestionDate = date;
    logger.debug({ date: date.toISOString() }, 'System ingestion date set');
  }

  /**
   * Get the system-level last ingestion date
   */
  getSystemIngestionDate(): Date | null {
    return this.systemIngestionDate;
  }

  /**
   * Generate freshness information for an answer based on cited documents
   */
  generateFreshnessInfo(
    citations: Citation[],
    documentMetadata: Map<string, DocumentMetadata>,
    checkDate: Date = new Date()
  ): SourceFreshnessInfo {
    const warnings: FreshnessWarning[] = [];
    let hasStaleData = false;

    // Determine last retrieved date
    const lastRetrieved = this.systemIngestionDate || new Date();
    const lastRetrievedFormatted = this.formatDate(lastRetrieved);

    // Determine effective period from cited documents
    const effectivePeriod = this.determineEffectivePeriod(citations, documentMetadata);
    const incomeLimitsEffective = this.determineIncomeLimitsEffective(citations, documentMetadata);

    // Check each cited document for staleness
    for (const citation of citations) {
      const metadata = documentMetadata.get(citation.documentId);
      if (!metadata) continue;

      const freshnessCheck = this.checkDocumentFreshness(metadata, checkDate);
      if (freshnessCheck?.isStale) {
        hasStaleData = true;
        if (freshnessCheck.warningMessage) {
          warnings.push({
            level: this.mapWarningLevel(freshnessCheck.warningLevel),
            message: freshnessCheck.warningMessage,
            dataType: freshnessCheck.dataType,
          });
        }
      }
    }

    // Add general freshness warnings based on check date
    const generalWarnings = this.generateGeneralWarnings(checkDate);
    warnings.push(...generalWarnings);

    // Deduplicate warnings by message
    const uniqueWarnings = this.deduplicateWarnings(warnings);

    return {
      lastRetrieved,
      lastRetrievedFormatted,
      effectivePeriod,
      incomeLimitsEffective,
      warnings: uniqueWarnings,
      hasStaleData,
    };
  }

  /**
   * Format freshness information as a string to append to answers
   */
  formatFreshnessSection(info: SourceFreshnessInfo): string {
    const lines: string[] = [];

    lines.push('---');
    lines.push('**Source Information**');
    lines.push(`- Sources last retrieved: ${info.lastRetrievedFormatted}`);

    if (info.effectivePeriod) {
      lines.push(`- Applies to: ${info.effectivePeriod}`);
    }

    if (info.incomeLimitsEffective) {
      lines.push(`- Income limits effective: ${info.incomeLimitsEffective}`);
    }

    // Add warnings
    if (info.warnings.length > 0) {
      lines.push('');
      for (const warning of info.warnings) {
        const icon = this.getWarningIcon(warning.level);
        lines.push(`${icon} ${warning.message}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Check freshness of a document based on its metadata
   */
  private checkDocumentFreshness(
    metadata: DocumentMetadata,
    checkDate: Date
  ): FreshnessCheck | null {
    if (!metadata.documentType || !metadata.effectiveDate) {
      return null;
    }

    const effectiveDate = metadata.effectiveDate instanceof Date
      ? metadata.effectiveDate
      : new Date(metadata.effectiveDate);

    return this.checker.checkDocument(
      {
        id: 'temp',
        documentType: metadata.documentType,
        effectiveDate,
      },
      checkDate
    );
  }

  /**
   * Determine effective period from cited documents
   */
  private determineEffectivePeriod(
    citations: Citation[],
    documentMetadata: Map<string, DocumentMetadata>
  ): string | undefined {
    // Find the most recent effective date
    let latestYear: number | undefined;

    for (const citation of citations) {
      const metadata = documentMetadata.get(citation.documentId);
      if (metadata?.effectiveDate) {
        const date = metadata.effectiveDate instanceof Date
          ? metadata.effectiveDate
          : new Date(metadata.effectiveDate);
        const year = date.getFullYear();
        if (!latestYear || year > latestYear) {
          latestYear = year;
        }
      }
    }

    if (latestYear) {
      return `Calendar Year ${latestYear} (unless otherwise noted)`;
    }

    return undefined;
  }

  /**
   * Determine income limits effective period
   */
  private determineIncomeLimitsEffective(
    citations: Citation[],
    documentMetadata: Map<string, DocumentMetadata>
  ): string | undefined {
    // Check if any citations are income-related
    const incomeTypes = ['income_limits', 'msp_guide', 'general_eligibility'];

    for (const citation of citations) {
      const metadata = documentMetadata.get(citation.documentId);
      if (metadata?.documentType && incomeTypes.includes(metadata.documentType)) {
        // MSP limits typically effective April - March
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;

        if (month >= 4) {
          return `April ${year} - March ${year + 1}`;
        } else {
          return `April ${year - 1} - March ${year}`;
        }
      }
    }

    return undefined;
  }

  /**
   * Generate general freshness warnings based on the current date
   */
  private generateGeneralWarnings(checkDate: Date): FreshnessWarning[] {
    const warnings: FreshnessWarning[] = [];
    const year = checkDate.getFullYear();
    const month = checkDate.getMonth() + 1;

    // Warning about FPL updates in January
    if (month === 1 || month === 2) {
      warnings.push({
        level: 'info',
        message: `Note: ${year} Federal Poverty Level figures are typically published in January. ` +
          `If reading this in early ${year}, some limits may still reflect ${year - 1} values.`,
      });
    }

    // Warning about MSP updates in April
    if (month >= 3 && month <= 5) {
      warnings.push({
        level: 'info',
        message: `Note: Medicare Savings Program limits typically update in April. ` +
          `If reading this in March-May ${year}, verify current limits apply.`,
      });
    }

    return warnings;
  }

  /**
   * Map warning level from FreshnessCheck to display level
   */
  private mapWarningLevel(level: 'none' | 'info' | 'warning' | 'critical'): 'info' | 'warning' | 'critical' {
    if (level === 'none') return 'info';
    return level;
  }

  /**
   * Get icon for warning level
   */
  private getWarningIcon(level: 'info' | 'warning' | 'critical'): string {
    switch (level) {
      case 'critical':
        return '🚨';
      case 'warning':
        return '⚠️';
      case 'info':
      default:
        return 'ℹ️';
    }
  }

  /**
   * Format a date for display
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  /**
   * Deduplicate warnings by message
   */
  private deduplicateWarnings(warnings: FreshnessWarning[]): FreshnessWarning[] {
    const seen = new Set<string>();
    return warnings.filter((w) => {
      if (seen.has(w.message)) {
        return false;
      }
      seen.add(w.message);
      return true;
    });
  }
}

// Singleton instance
let displayServiceInstance: FreshnessDisplayService | null = null;

/**
 * Get the freshness display service singleton
 */
export function getFreshnessDisplayService(): FreshnessDisplayService {
  if (!displayServiceInstance) {
    displayServiceInstance = new FreshnessDisplayService();
  }
  return displayServiceInstance;
}

/**
 * Reset the freshness display service (for testing)
 */
export function resetFreshnessDisplayService(): void {
  displayServiceInstance = null;
}
