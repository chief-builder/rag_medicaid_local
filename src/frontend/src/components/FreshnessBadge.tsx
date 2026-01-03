import { useState, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { FreshnessInfo, FreshnessWarning } from '../types';
import { useUserMode } from '../hooks/useUserMode';
import styles from './FreshnessBadge.module.css';

interface FreshnessBadgeProps {
  freshnessInfo: FreshnessInfo;
}

/**
 * FreshnessBadge - Shows data currency and freshness warnings
 * Displays when data was last retrieved and warns if stale
 */
export function FreshnessBadge({ freshnessInfo }: FreshnessBadgeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { isCaregiver } = useUserMode();
  const tooltipId = useId();

  const hasWarnings = freshnessInfo.hasStaleData || (freshnessInfo.warningCount > 0);
  const hasDetails = freshnessInfo.warnings && freshnessInfo.warnings.length > 0;

  // Format the main date display
  const displayDate = formatFreshnessDate(
    freshnessInfo.effectivePeriod ||
    freshnessInfo.incomeLimitsEffective ||
    freshnessInfo.lastRetrieved
  );

  // Only show the badge if we have date info
  if (!displayDate) {
    return null;
  }

  return (
    <div className={styles.container}>
      <button
        className={`${styles.badge} ${hasWarnings ? styles.warning : styles.current}`}
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
        aria-expanded={hasDetails ? isExpanded : undefined}
        aria-controls={hasDetails ? tooltipId : undefined}
        aria-describedby={hasWarnings ? `${tooltipId}-warning` : undefined}
        disabled={!hasDetails}
        type="button"
      >
        <span className={styles.icon} aria-hidden="true">
          {hasWarnings ? '⚠' : '✓'}
        </span>

        <span className={styles.text}>
          Data current as of {displayDate}
          {hasWarnings && (
            <span id={`${tooltipId}-warning`} className="sr-only">
              Warning: Some information may be outdated
            </span>
          )}
        </span>

        {hasDetails && (
          <span
            className={`${styles.chevron} ${isExpanded ? styles.expanded : ''}`}
            aria-hidden="true"
          >
            ▼
          </span>
        )}
      </button>

      {/* Expanded details with warnings */}
      <AnimatePresence>
        {isExpanded && hasDetails && (
          <motion.div
            id={tooltipId}
            className={styles.details}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            role="region"
            aria-label="Data freshness details"
          >
            {/* Warning list */}
            {freshnessInfo.warnings && freshnessInfo.warnings.length > 0 && (
              <div className={styles.warningList}>
                <h4 className={styles.warningTitle}>
                  {freshnessInfo.warningCount} freshness {freshnessInfo.warningCount === 1 ? 'notice' : 'notices'}:
                </h4>
                <ul className={styles.warnings}>
                  {freshnessInfo.warnings.map((warning, index) => (
                    <FreshnessWarningItem key={index} warning={warning} showDetails={isCaregiver} />
                  ))}
                </ul>
              </div>
            )}

            {/* Additional date details in caregiver mode */}
            {isCaregiver && (
              <div className={styles.dateDetails}>
                {freshnessInfo.lastRetrieved && (
                  <div className={styles.dateItem}>
                    <span className={styles.dateLabel}>Last Retrieved:</span>
                    <span className={styles.dateValue}>
                      {formatFullDate(freshnessInfo.lastRetrieved)}
                    </span>
                  </div>
                )}
                {freshnessInfo.effectivePeriod && (
                  <div className={styles.dateItem}>
                    <span className={styles.dateLabel}>Effective Period:</span>
                    <span className={styles.dateValue}>
                      {freshnessInfo.effectivePeriod}
                    </span>
                  </div>
                )}
                {freshnessInfo.incomeLimitsEffective && (
                  <div className={styles.dateItem}>
                    <span className={styles.dateLabel}>Income Limits Effective:</span>
                    <span className={styles.dateValue}>
                      {freshnessInfo.incomeLimitsEffective}
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

interface FreshnessWarningItemProps {
  warning: FreshnessWarning;
  showDetails: boolean;
}

/**
 * Individual freshness warning item
 */
function FreshnessWarningItem({ warning, showDetails }: FreshnessWarningItemProps) {
  return (
    <li className={styles.warningItem}>
      <span className={styles.warningType}>{warning.dataType}:</span>
      <span className={styles.warningMessage}>{warning.message}</span>

      {showDetails && (warning.lastUpdate || warning.expectedUpdate) && (
        <div className={styles.warningDetails}>
          {warning.lastUpdate && (
            <span className={styles.warningDate}>
              Last update: {formatFullDate(warning.lastUpdate)}
            </span>
          )}
          {warning.expectedUpdate && (
            <span className={styles.warningDate}>
              Expected update: {warning.expectedUpdate}
            </span>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Format date string to "Month Year" for main display
 */
function formatFreshnessDate(dateStr?: string): string | null {
  if (!dateStr) return null;

  try {
    // Handle ISO dates or date strings
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      // If parsing fails, return the original string
      return dateStr;
    }

    return date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format date string to full date display
 */
function formatFullDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return dateStr;
    }

    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default FreshnessBadge;
