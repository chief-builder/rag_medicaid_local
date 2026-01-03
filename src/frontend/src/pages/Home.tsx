import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

/**
 * Home page - Welcome screen with question input and quick topics
 * Will be fully implemented in Phase 6
 */
export default function Home() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      // Navigate to chat with the query as a URL parameter
      navigate(`/ask?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <main
      id="main-content"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-6)',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      <div style={{ maxWidth: '600px', width: '100%', textAlign: 'center' }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-4xl)',
            color: 'var(--text-primary)',
            marginBottom: 'var(--space-4)',
          }}
        >
          PA Medicaid Assistant
        </h1>

        <p
          style={{
            fontSize: 'var(--text-lg)',
            color: 'var(--text-secondary)',
            marginBottom: 'var(--space-8)',
            lineHeight: 'var(--line-height-relaxed)',
          }}
        >
          Get answers about Pennsylvania Medicaid eligibility, income limits,
          and benefits. Your questions are answered using official state
          documents.
        </p>

        <form onSubmit={handleSubmit} style={{ marginBottom: 'var(--space-8)' }}>
          <label htmlFor="query-input" className="sr-only">
            Ask a question about Medicaid
          </label>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexDirection: 'column' }}>
            <textarea
              id="query-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about Medicaid eligibility, income limits, or benefits..."
              style={{
                width: '100%',
                minHeight: '80px',
                padding: 'var(--space-4)',
                fontSize: 'var(--text-base)',
                borderRadius: 'var(--radius-lg)',
                border: '2px solid var(--bg-secondary)',
                resize: 'vertical',
              }}
              rows={3}
            />
            <button
              type="submit"
              className="btn btn-primary btn-large"
              style={{ width: '100%' }}
              disabled={!query.trim()}
            >
              Ask Question
            </button>
          </div>
        </form>

        <nav style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center' }}>
          <a href="/ask" className="btn btn-secondary">
            Chat
          </a>
          <a href="/help" className="btn btn-secondary">
            Help Resources
          </a>
        </nav>
      </div>
    </main>
  );
}
