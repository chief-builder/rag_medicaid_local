import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { UserModeProvider } from './context/UserModeContext';
import './styles/global.css';
import './styles/accessibility.css';

// Configure React Query with sensible defaults for a RAG application
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't refetch on window focus for this app (answers don't change frequently)
      refetchOnWindowFocus: false,
      // Retry once on failure, then show error
      retry: 1,
      // Keep data fresh for 5 minutes
      staleTime: 5 * 60 * 1000,
    },
    mutations: {
      // Retry once for mutations (query submissions)
      retry: 1,
    },
  },
});

// Detect keyboard vs mouse navigation for accessibility
document.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    document.body.classList.add('using-keyboard');
  }
});

document.addEventListener('mousedown', () => {
  document.body.classList.remove('using-keyboard');
});

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}

const root = createRoot(container);

root.render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <UserModeProvider>
          <App />
        </UserModeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
