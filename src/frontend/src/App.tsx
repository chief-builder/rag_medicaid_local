import { Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';

// Lazy load pages for better performance
const Home = lazy(() => import('./pages/Home'));
const Chat = lazy(() => import('./pages/Chat'));
const Resources = lazy(() => import('./pages/Resources'));

// Loading fallback component
function LoadingFallback() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)',
        gap: 'var(--space-4)',
      }}
    >
      <div className="loading-spinner" aria-label="Loading" />
      <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-lg)' }}>
        Loading...
      </p>
    </div>
  );
}

// Skip link for accessibility
function SkipLink() {
  return (
    <a href="#main-content" className="skip-link">
      Skip to main content
    </a>
  );
}

export default function App() {
  return (
    <>
      <SkipLink />
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/ask" element={<Chat />} />
          <Route path="/help" element={<Resources />} />
        </Routes>
      </Suspense>
    </>
  );
}
