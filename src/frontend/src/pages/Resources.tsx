import { HELP_RESOURCES } from '../types';

/**
 * Resources page - Help phone numbers and resources
 * Will be enhanced in Phase 4
 */
export default function Resources() {
  return (
    <main
      id="main-content"
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: 'var(--space-4) var(--space-6)',
          borderBottom: '1px solid var(--bg-secondary)',
          backgroundColor: 'var(--bg-card)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <a
          href="/"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-xl)',
            color: 'var(--text-primary)',
            textDecoration: 'none',
          }}
        >
          PA Medicaid Assistant
        </a>
        <nav style={{ display: 'flex', gap: 'var(--space-4)' }}>
          <a href="/ask" className="btn btn-ghost">
            Ask a Question
          </a>
        </nav>
      </header>

      {/* Content */}
      <div
        style={{
          maxWidth: '800px',
          margin: '0 auto',
          padding: 'var(--space-8) var(--space-6)',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-3xl)',
            color: 'var(--text-primary)',
            marginBottom: 'var(--space-2)',
          }}
        >
          Help Resources
        </h1>

        <p
          style={{
            fontSize: 'var(--text-lg)',
            color: 'var(--text-secondary)',
            marginBottom: 'var(--space-8)',
          }}
        >
          Need to speak with someone? These organizations provide free help with
          Medicaid questions.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {HELP_RESOURCES.map((resource) => (
            <div
              key={resource.name}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
              }}
            >
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--text-xl)',
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                {resource.name}
              </h2>

              <p
                style={{
                  color: 'var(--text-secondary)',
                  margin: 0,
                }}
              >
                {resource.description}
              </p>

              <a
                href={`tel:${resource.phone.replace(/\D/g, '')}`}
                className="btn btn-primary"
                style={{
                  marginTop: 'var(--space-2)',
                  alignSelf: 'flex-start',
                  fontSize: 'var(--text-lg)',
                }}
              >
                📞 {resource.phone}
              </a>

              {resource.hours && (
                <p
                  style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-muted)',
                    margin: 0,
                  }}
                >
                  Hours: {resource.hours}
                </p>
              )}

              {resource.website && (
                <a
                  href={resource.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--accent-teal)',
                  }}
                >
                  Visit Website →
                </a>
              )}
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 'var(--space-12)',
            padding: 'var(--space-6)',
            backgroundColor: 'var(--accent-gold-light)',
            borderRadius: 'var(--radius-xl)',
            borderLeft: '4px solid var(--accent-gold)',
          }}
        >
          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-lg)',
              color: 'var(--text-primary)',
              marginBottom: 'var(--space-2)',
            }}
          >
            Important Note
          </h3>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            This tool provides general information based on official Pennsylvania
            documents. For personal advice about your specific situation, please
            contact one of the resources above or speak with an elder law attorney.
          </p>
        </div>
      </div>
    </main>
  );
}
