import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useSubmitQuery, createUserMessage, createAssistantMessage, createLoadingMessage, createErrorMessage } from '../hooks/useQuery';
import { useUserMode } from '../hooks/useUserMode';
import { QueryInput } from '../components/QueryInput';
import { MessageBubble } from '../components/MessageBubble';
import { HelpPanel } from '../components/HelpPanel';
import type { Message } from '../types';
import styles from './Chat.module.css';

/**
 * Chat page - Main Q&A interface
 * Accessible, senior-friendly chat for Medicaid questions
 */
export default function Chat() {
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { mode, toggleMode } = useUserMode();
  const hasProcessedInitialQuery = useRef(false);

  const queryMutation = useSubmitQuery({
    onSuccess: (response) => {
      // Replace loading message with actual response
      setMessages((prev) => {
        const withoutLoading = prev.filter((m) => !m.isLoading);
        return [...withoutLoading, createAssistantMessage(response)];
      });
    },
    onError: (error) => {
      // Replace loading message with error
      setMessages((prev) => {
        const withoutLoading = prev.filter((m) => !m.isLoading);
        return [...withoutLoading, createErrorMessage(error.message)];
      });
    },
  });

  // Handle initial query from URL parameter
  useEffect(() => {
    const initialQuery = searchParams.get('q');
    if (initialQuery && !hasProcessedInitialQuery.current) {
      hasProcessedInitialQuery.current = true;
      handleSubmit(initialQuery);
    }
  }, [searchParams]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (query: string) => {
    // Add user message
    setMessages((prev) => [...prev, createUserMessage(query)]);

    // Add loading placeholder
    setMessages((prev) => [...prev, createLoadingMessage()]);

    // Submit query
    queryMutation.mutate(query);
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <Link to="/" className={styles.logo}>
          PA Medicaid Assistant
        </Link>

        <div className={styles.headerActions}>
          {/* Mode toggle */}
          <button
            onClick={toggleMode}
            className={styles.modeToggle}
            aria-pressed={mode === 'caregiver'}
            title={mode === 'caregiver' ? 'Switch to simple view' : 'Switch to detailed view'}
          >
            <span className={styles.modeLabel}>
              {mode === 'caregiver' ? 'Detailed' : 'Simple'} View
            </span>
            <span
              className={`${styles.modeIndicator} ${mode === 'caregiver' ? styles.active : ''}`}
              aria-hidden="true"
            />
          </button>

          <Link to="/help" className="btn btn-ghost">
            Need Help?
          </Link>
        </div>
      </header>

      {/* Main content with sidebar layout */}
      <div className={styles.layout}>
        <main id="main-content" className={styles.main}>
          {/* Messages area */}
          <div className={styles.messagesContainer}>
            <div className={styles.messages}>
              {messages.length === 0 ? (
                <EmptyState />
              ) : (
                <>
                  {messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>
          </div>

          {/* Input area */}
          <div className={styles.inputContainer}>
            <QueryInput
              onSubmit={handleSubmit}
              isLoading={queryMutation.isPending}
              autoFocus={messages.length === 0}
            />
          </div>
        </main>

        {/* Help panel sidebar (desktop) */}
        <aside className={styles.helpSidebar}>
          <HelpPanel variant="sidebar" />
        </aside>
      </div>

      {/* Help panel FAB (mobile) */}
      <HelpPanel variant="floating" />
    </div>
  );
}

/**
 * Empty state shown when no messages yet
 */
function EmptyState() {
  return (
    <div className={styles.emptyState}>
      <h2 className={styles.emptyTitle}>Ask a Question</h2>
      <p className={styles.emptyDescription}>
        Get answers about Pennsylvania Medicaid eligibility, income limits, and benefits.
        Your questions are answered using official state documents.
      </p>

      <div className={styles.exampleQuestions}>
        <p className={styles.exampleLabel}>Try asking:</p>
        <ul className={styles.exampleList}>
          <li>&quot;What are the income limits for QMB?&quot;</li>
          <li>&quot;How do I apply for Medicare Savings Programs?&quot;</li>
          <li>&quot;Does Medicaid cover nursing home care?&quot;</li>
          <li>&quot;What is the LIFE program?&quot;</li>
        </ul>
      </div>

      <div className={styles.helpNote}>
        <strong>Need to speak with someone?</strong>
        <br />
        Call PHLP at{' '}
        <a href="tel:18002743258" className={styles.phoneLink}>
          1-800-274-3258
        </a>
        {' '}for free Medicaid help.
      </div>
    </div>
  );
}
