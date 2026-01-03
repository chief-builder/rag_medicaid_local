import { useState, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Citation, LegalWeight, SourceAuthority } from '../types';
import { useUserMode } from '../hooks/useUserMode';
import styles from './CitationCard.module.css';

interface CitationCardProps {
  citation: Citation;
  index: number;
}

/**
 * CitationCard - Displays a source citation with expandable details
 * Collapsed: Shows citation number, filename, page
 * Expanded: Shows full excerpt, document type, legal weight
 */
export function CitationCard({ citation, index }: CitationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { isCaregiver } = useUserMode();
  const contentId = useId();

  const toggleExpanded = () => setIsExpanded(!isExpanded);

  // Format the source authority badge
  const authorityLabel = getAuthorityLabel(citation.sourceAuthority);
  const authorityClass = citation.sourceAuthority === 'primary'
    ? styles.badgePrimary
    : styles.badgeSecondary;

  // Format legal weight for display
  const legalWeightLabel = getLegalWeightLabel(citation.legalWeight);

  return (
    <div className={styles.card}>
      <button
        className={styles.header}
        onClick={toggleExpanded}
        aria-expanded={isExpanded}
        aria-controls={contentId}
      >
        <span className={styles.index}>[{citation.index ?? index + 1}]</span>

        <span className={styles.title}>
          {formatFilename(citation.filename)}
          {citation.pageNumber != null && citation.pageNumber > 0 && (
            <span className={styles.page}>, Page {citation.pageNumber}</span>
          )}
        </span>

        {/* Source authority badge */}
        {citation.sourceAuthority && (
          <span className={`${styles.badge} ${authorityClass}`}>
            {authorityLabel}
          </span>
        )}

        <span
          className={`${styles.chevron} ${isExpanded ? styles.expanded : ''}`}
          aria-hidden="true"
        >
          ▼
        </span>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            id={contentId}
            className={styles.content}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Source excerpt */}
            {citation.content && (
              <div className={styles.excerpt}>
                <span className={styles.excerptLabel}>Source excerpt:</span>
                <blockquote className={styles.excerptText}>
                  "{citation.content}"
                </blockquote>
              </div>
            )}

            {/* Document metadata - shown in caregiver mode */}
            {isCaregiver && (
              <div className={styles.metadata}>
                {citation.documentType && (
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Document Type:</span>
                    <span className={styles.metaValue}>
                      {formatDocumentType(citation.documentType)}
                    </span>
                  </div>
                )}

                {citation.legalWeight && (
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Legal Weight:</span>
                    <span
                      className={styles.metaValue}
                      title={getLegalWeightDescription(citation.legalWeight)}
                    >
                      {legalWeightLabel}
                    </span>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Get display label for source authority
 */
function getAuthorityLabel(authority?: SourceAuthority): string {
  switch (authority) {
    case 'primary':
      return 'Official';
    case 'secondary':
      return 'Guidance';
    default:
      return '';
  }
}

/**
 * Get display label for legal weight
 */
function getLegalWeightLabel(weight?: LegalWeight): string {
  switch (weight) {
    case 'regulatory':
      return 'Regulatory';
    case 'guidance':
      return 'Guidance';
    case 'informational':
      return 'Informational';
    default:
      return '';
  }
}

/**
 * Get description for legal weight tooltip
 */
function getLegalWeightDescription(weight: LegalWeight): string {
  switch (weight) {
    case 'regulatory':
      return 'Legally binding rules and regulations';
    case 'guidance':
      return 'Official interpretation and policy guidance';
    case 'informational':
      return 'Educational and informational content';
  }
}

/**
 * Format document type for display
 */
function formatDocumentType(docType: string): string {
  const typeLabels: Record<string, string> = {
    msp_guide: 'Medicare Savings Program Guide',
    income_limits: 'Income Limits',
    ltc_info: 'Long-Term Care Information',
    estate_recovery: 'Estate Recovery',
    pace_pacenet: 'PACE/PACENET',
    life_program: 'LIFE Program',
    chc_waiver: 'CHC Waiver',
    general_eligibility: 'General Eligibility',
    dual_eligible: 'Dual Eligible',
    extra_help: 'Extra Help (LIS)',
    oim_ltc_handbook: 'OIM LTC Handbook',
    oim_ma_handbook: 'OIM MA Handbook',
    oim_ops_memo: 'OIM Operations Memo',
    oim_policy_clarification: 'OIM Policy Clarification',
    pa_code: 'PA Code (Regulation)',
    pa_bulletin: 'PA Bulletin',
  };
  return typeLabels[docType] || docType.replace(/_/g, ' ');
}

/**
 * Format filename for cleaner display
 */
function formatFilename(filename: string): string {
  // Remove file extension and clean up underscores
  return filename
    .replace(/\.(pdf|txt|docx?)$/i, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default CitationCard;
