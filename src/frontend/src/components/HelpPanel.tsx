import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HELP_RESOURCES, type HelpResource } from '../types';
import styles from './HelpPanel.module.css';

interface HelpPanelProps {
  /** Whether to show as floating panel (mobile) or sidebar (desktop) */
  variant?: 'sidebar' | 'floating';
}

/**
 * HelpPanel - Always-accessible help resources
 * Desktop: Fixed sidebar on right
 * Mobile: Floating action button with bottom sheet
 */
export function HelpPanel({ variant = 'sidebar' }: HelpPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (variant === 'floating') {
    return <FloatingHelpPanel isOpen={isOpen} setIsOpen={setIsOpen} />;
  }

  return <SidebarHelpPanel />;
}

/**
 * Desktop sidebar variant
 */
function SidebarHelpPanel() {
  return (
    <aside className={styles.sidebar} aria-label="Help resources">
      <div className={styles.sidebarHeader}>
        <h2 className={styles.sidebarTitle}>Need Help?</h2>
        <p className={styles.sidebarSubtitle}>
          Free assistance is available
        </p>
      </div>

      <div className={styles.resourceList}>
        {HELP_RESOURCES.map((resource) => (
          <HelpResourceCard key={resource.phone} resource={resource} compact />
        ))}
      </div>

      <div className={styles.sidebarNote}>
        <p>All services are free and confidential</p>
      </div>
    </aside>
  );
}

/**
 * Mobile floating action button with bottom sheet
 */
function FloatingHelpPanel({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}) {
  return (
    <>
      {/* Floating Action Button */}
      <button
        className={styles.fab}
        onClick={() => setIsOpen(true)}
        aria-label="Get help"
        aria-expanded={isOpen}
        aria-controls="help-sheet"
      >
        <span className={styles.fabIcon} aria-hidden="true">📞</span>
        <span className={styles.fabLabel}>Help</span>
      </button>

      {/* Bottom Sheet */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className={styles.backdrop}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />

            {/* Sheet */}
            <motion.div
              id="help-sheet"
              className={styles.sheet}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              role="dialog"
              aria-label="Help resources"
              aria-modal="true"
            >
              <div className={styles.sheetHandle} aria-hidden="true" />

              <div className={styles.sheetHeader}>
                <h2 className={styles.sheetTitle}>Need Help?</h2>
                <button
                  className={styles.closeButton}
                  onClick={() => setIsOpen(false)}
                  aria-label="Close help panel"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>

              <p className={styles.sheetSubtitle}>
                Tap to call for free assistance
              </p>

              <div className={styles.sheetContent}>
                {HELP_RESOURCES.map((resource) => (
                  <HelpResourceCard key={resource.phone} resource={resource} />
                ))}
              </div>

              <div className={styles.sheetNote}>
                <p>All services are free and confidential</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

interface HelpResourceCardProps {
  resource: HelpResource;
  compact?: boolean;
}

/**
 * Individual help resource card with click-to-call
 */
function HelpResourceCard({ resource, compact = false }: HelpResourceCardProps) {
  const phoneDigits = resource.phone.replace(/\D/g, '');

  return (
    <a
      href={`tel:${phoneDigits}`}
      className={`${styles.resourceCard} ${compact ? styles.compact : ''}`}
    >
      <div className={styles.resourceIcon} aria-hidden="true">
        📞
      </div>

      <div className={styles.resourceInfo}>
        <span className={styles.resourceName}>{resource.name}</span>
        <span className={styles.resourcePhone}>{resource.phone}</span>
        {!compact && resource.description && (
          <span className={styles.resourceDesc}>{resource.description}</span>
        )}
        {!compact && resource.hours && (
          <span className={styles.resourceHours}>{resource.hours}</span>
        )}
      </div>

      <div className={styles.callIndicator} aria-hidden="true">
        →
      </div>
    </a>
  );
}

export default HelpPanel;
