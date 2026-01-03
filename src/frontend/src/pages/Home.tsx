import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Header } from '../components/Header';
import { QuickTopics } from '../components/QuickTopics';
import styles from './Home.module.css';

/**
 * Home page - Welcome screen with question input and quick topics
 * Entry point for PA Medicaid Assistant
 */
export default function Home() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/ask?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <div className={styles.page}>
      <Header />

      <main id="main-content" className={styles.main}>
        {/* Hero section */}
        <section className={styles.hero}>
          <h1 className={styles.title}>
            Pennsylvania Medicaid Assistant
          </h1>
          <p className={styles.subtitle}>
            Get answers about Medicaid eligibility, income limits, and benefits.
            Your questions are answered using official state documents.
          </p>

          {/* Query form */}
          <form onSubmit={handleSubmit} className={styles.form}>
            <label htmlFor="query-input" className="sr-only">
              Ask a question about Medicaid
            </label>
            <textarea
              id="query-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about Medicaid eligibility, income limits, or benefits..."
              className={styles.textarea}
              rows={3}
            />
            <button
              type="submit"
              className={`btn btn-primary btn-large ${styles.submitBtn}`}
              disabled={!query.trim()}
            >
              Ask Question
            </button>
          </form>
        </section>

        {/* Quick topics */}
        <QuickTopics />

        {/* Help note */}
        <section className={styles.helpNote}>
          <p>
            <strong>Need to speak with someone?</strong>
            <br />
            Call PHLP at{' '}
            <a href="tel:18002743258" className={styles.phoneLink}>
              1-800-274-3258
            </a>{' '}
            for free Medicaid help.
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <p className={styles.footerText}>
          This tool provides general information based on official Pennsylvania documents.
          For personal advice about your specific situation, please contact a qualified professional.
        </p>
      </footer>
    </div>
  );
}
