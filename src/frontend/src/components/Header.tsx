import { Link, useLocation } from 'react-router-dom';
import { useUserMode } from '../hooks/useUserMode';
import styles from './Header.module.css';

/**
 * Header - Shared navigation header with logo, nav links, and mode toggle
 * Used across all pages for consistent navigation
 */
export function Header() {
  const location = useLocation();
  const { mode, toggleMode } = useUserMode();

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        {/* Logo / Home link */}
        <Link to="/" className={styles.logo}>
          <span className={styles.logoIcon} aria-hidden="true">🏛️</span>
          <span className={styles.logoText}>PA Medicaid Assistant</span>
        </Link>

        {/* Navigation */}
        <nav className={styles.nav} aria-label="Main navigation">
          <Link
            to="/"
            className={`${styles.navLink} ${isActive('/') ? styles.active : ''}`}
          >
            Home
          </Link>
          <Link
            to="/ask"
            className={`${styles.navLink} ${isActive('/ask') ? styles.active : ''}`}
          >
            Ask a Question
          </Link>
          <Link
            to="/help"
            className={`${styles.navLink} ${isActive('/help') ? styles.active : ''}`}
          >
            Help Resources
          </Link>
        </nav>

        {/* Mode toggle */}
        <button
          onClick={toggleMode}
          className={styles.modeToggle}
          aria-pressed={mode === 'caregiver'}
          title={mode === 'caregiver' ? 'Switch to Simple View' : 'Switch to Detailed View'}
        >
          <span className={styles.modeLabel}>
            {mode === 'caregiver' ? 'Detailed' : 'Simple'} View
          </span>
          <span
            className={`${styles.modeIndicator} ${mode === 'caregiver' ? styles.active : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>
    </header>
  );
}

export default Header;
