import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import styles from './QueryInput.module.css';

interface QueryInputProps {
  onSubmit: (query: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  initialValue?: string;
  autoFocus?: boolean;
}

const MAX_CHARS = 2000;

/**
 * QueryInput - Accessible question input with large touch targets
 * Designed for seniors with large fonts, clear buttons, and simple interaction
 */
export function QueryInput({
  onSubmit,
  isLoading = false,
  placeholder = 'Ask about Medicaid eligibility, income limits, or benefits...',
  initialValue = '',
  autoFocus = false,
}: QueryInputProps) {
  const [value, setValue] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [value]);

  // Focus on mount if autoFocus
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed && !isLoading) {
      onSubmit(trimmed);
      setValue('');
    }
  };

  // Submit on Enter (without Shift), allow Shift+Enter for newlines
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const charsRemaining = MAX_CHARS - value.length;
  const isOverLimit = charsRemaining < 0;
  const isNearLimit = charsRemaining < 200 && charsRemaining >= 0;
  const canSubmit = value.trim().length > 0 && !isOverLimit && !isLoading;

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.inputWrapper}>
        <label htmlFor="query-input" className="sr-only">
          Type your question about Medicaid
        </label>

        <textarea
          ref={textareaRef}
          id="query-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={styles.textarea}
          disabled={isLoading}
          rows={2}
          aria-describedby="char-count input-hint"
          aria-invalid={isOverLimit}
        />

        <div className={styles.footer}>
          <span
            id="input-hint"
            className={styles.hint}
          >
            Press Enter to send, Shift+Enter for new line
          </span>

          <span
            id="char-count"
            className={`${styles.charCount} ${isOverLimit ? styles.overLimit : ''} ${isNearLimit ? styles.nearLimit : ''}`}
            aria-live="polite"
          >
            {isOverLimit ? (
              <span role="alert">{Math.abs(charsRemaining)} over limit</span>
            ) : isNearLimit ? (
              `${charsRemaining} characters left`
            ) : null}
          </span>
        </div>
      </div>

      <motion.button
        type="submit"
        className={styles.submitButton}
        disabled={!canSubmit}
        whileHover={canSubmit ? { scale: 1.02 } : {}}
        whileTap={canSubmit ? { scale: 0.98 } : {}}
        aria-label={isLoading ? 'Sending your question...' : 'Send question'}
      >
        {isLoading ? (
          <>
            <span className={styles.spinner} aria-hidden="true" />
            <span>Sending...</span>
          </>
        ) : (
          <>
            <SendIcon />
            <span>Send</span>
          </>
        )}
      </motion.button>
    </form>
  );
}

function SendIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

export default QueryInput;
