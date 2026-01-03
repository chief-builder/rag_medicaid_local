import { Header } from '../components/Header';
import { HELP_RESOURCES } from '../types';
import styles from './Resources.module.css';

/**
 * Resources page - Help phone numbers and resources
 * Provides contact information for Medicaid assistance
 */
export default function Resources() {
  return (
    <div className={styles.page}>
      <Header />

      <main id="main-content" className={styles.main}>
        <div className={styles.content}>
          <h1 className={styles.title}>Help Resources</h1>
          <p className={styles.subtitle}>
            Need to speak with someone? These organizations provide free help with
            Medicaid questions.
          </p>

          {/* Resource cards */}
          <div className={styles.cards}>
            {HELP_RESOURCES.map((resource) => (
              <article key={resource.name} className={styles.card}>
                <h2 className={styles.cardTitle}>{resource.name}</h2>
                <p className={styles.cardDescription}>{resource.description}</p>

                <a
                  href={`tel:${resource.phone.replace(/\D/g, '')}`}
                  className={`btn btn-primary ${styles.phoneBtn}`}
                >
                  {resource.phone}
                </a>

                {resource.hours && (
                  <p className={styles.hours}>Hours: {resource.hours}</p>
                )}

                {resource.website && (
                  <a
                    href={resource.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.websiteLink}
                  >
                    Visit Website
                  </a>
                )}
              </article>
            ))}
          </div>

          {/* Important note */}
          <aside className={styles.note}>
            <h3 className={styles.noteTitle}>Important Note</h3>
            <p className={styles.noteText}>
              This tool provides general information based on official Pennsylvania
              documents. For personal advice about your specific situation, please
              contact one of the resources above or speak with an elder law attorney.
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}
