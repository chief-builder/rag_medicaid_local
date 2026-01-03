import { motion } from 'framer-motion';
import type { Message } from '../types';
import { useUserMode } from '../hooks/useUserMode';
import { CitationCard } from './CitationCard';
import { FreshnessBadge } from './FreshnessBadge';
import { DisclaimerBanner } from './DisclaimerBanner';
import styles from './MessageBubble.module.css';

/**
 * Strip source information text from content for Simple View mode
 * Removes Citations, Source Information, and Note sections from the raw text
 */
function stripSourceInfo(content: string): string {
  // Split by common section markers and keep only the main answer
  const markers = [
    /\nCitations:.*$/s,
    /\n---\n\*\*Source Information\*\*.*$/s,
    /\n---\s*\n.*$/s,
  ];

  let cleaned = content;
  for (const marker of markers) {
    cleaned = cleaned.replace(marker, '');
  }

  return cleaned.trim();
}

interface MessageBubbleProps {
  message: Message;
}

/**
 * MessageBubble - Displays a chat message with appropriate styling
 * User messages appear on the right, assistant messages on the left
 */
export function MessageBubble({ message }: MessageBubbleProps) {
  const { isCaregiver } = useUserMode();
  const isUser = message.type === 'user';

  // Simple View (senior mode) hides detailed citation info
  // Detailed View (caregiver mode) shows citations and freshness info
  const showDetailedInfo = isCaregiver;

  // Get display content - strip source info in Simple View
  const displayContent = showDetailedInfo
    ? message.content
    : stripSourceInfo(message.content);

  // Format timestamp for display
  const formattedTime = message.timestamp.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <motion.div
      className={`${styles.container} ${isUser ? styles.user : styles.assistant}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      role="article"
      aria-label={`${isUser ? 'Your question' : 'Answer'} at ${formattedTime}`}
    >
      <div className={styles.bubble}>
        {/* Loading state */}
        {message.isLoading && <LoadingContent />}

        {/* Error state */}
        {message.error && <ErrorContent error={message.error} />}

        {/* Normal content */}
        {!message.isLoading && !message.error && (
          <>
            <div className={styles.content}>
              {displayContent.split('\n').map((paragraph, i) => (
                <p key={i} className={styles.paragraph}>
                  {paragraph}
                </p>
              ))}
            </div>

            {/* Citations - expandable cards (only in Detailed View) */}
            {showDetailedInfo && message.citations && message.citations.length > 0 && (
              <div className={styles.citations}>
                <span className={styles.citationsLabel}>
                  Sources ({message.citations.length}):
                </span>
                <div className={styles.citationCards}>
                  {message.citations.map((citation) => (
                    <CitationCard key={citation.index} citation={citation} />
                  ))}
                </div>
              </div>
            )}

            {/* Freshness badge - shows data currency (only in Detailed View) */}
            {showDetailedInfo && message.freshnessInfo && (
              <FreshnessBadge freshnessInfo={message.freshnessInfo} />
            )}

            {/* Disclaimer banner for sensitive topics */}
            {message.disclaimer && (
              <div className={styles.disclaimerWrapper}>
                <DisclaimerBanner disclaimer={message.disclaimer} />
              </div>
            )}

            {/* Caregiver mode: show retrieval stats */}
            {isCaregiver && message.retrievalStats && (
              <div className={styles.stats}>
                <span className={styles.statsLabel}>Retrieval Stats:</span>
                <div className={styles.statsGrid}>
                  <span>Vector: {message.retrievalStats.vectorResults}</span>
                  <span>BM25: {message.retrievalStats.bm25Results}</span>
                  <span>Fused: {message.retrievalStats.fusedResults}</span>
                  <span>Final: {message.retrievalStats.finalResults}</span>
                  {message.latencyMs && <span>Latency: {message.latencyMs}ms</span>}
                  {message.confidence !== undefined && (
                    <span>Confidence: {Math.round(message.confidence * 100)}%</span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <time className={styles.timestamp} dateTime={message.timestamp.toISOString()}>
        {formattedTime}
      </time>
    </motion.div>
  );
}

/**
 * Loading state content with calming animation
 */
function LoadingContent() {
  return (
    <div className={styles.loading} role="status" aria-label="Finding your answer">
      <div className={styles.loadingDots}>
        <motion.span
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: 0 }}
        />
        <motion.span
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: 0.2 }}
        />
        <motion.span
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: 0.4 }}
        />
      </div>
      <span className={styles.loadingText}>Finding your answer...</span>
    </div>
  );
}

/**
 * Error state content with friendly message
 */
function ErrorContent({ error }: { error: string }) {
  return (
    <div className={styles.error} role="alert">
      <span className={styles.errorIcon} aria-hidden="true">⚠️</span>
      <div>
        <p className={styles.errorTitle}>We couldn't find an answer</p>
        <p className={styles.errorMessage}>{error}</p>
        <p className={styles.errorHelp}>
          For immediate help, call PHLP at{' '}
          <a href="tel:18002743258" className={styles.phoneLink}>
            1-800-274-3258
          </a>
        </p>
      </div>
    </div>
  );
}

export default MessageBubble;
