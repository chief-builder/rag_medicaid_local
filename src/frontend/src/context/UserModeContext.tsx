import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { UserMode } from '../types';

interface UserModeContextType {
  mode: UserMode;
  toggleMode: () => void;
  setMode: (mode: UserMode) => void;
  isCaregiver: boolean;
  isSenior: boolean;
}

const UserModeContext = createContext<UserModeContextType | undefined>(undefined);

const STORAGE_KEY = 'pa-medicaid-user-mode';

/**
 * Get the initial mode from localStorage or default to 'senior'
 */
function getInitialMode(): UserMode {
  if (typeof window === 'undefined') {
    return 'senior';
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'caregiver' || stored === 'senior') {
      return stored;
    }
  } catch {
    // localStorage may not be available
  }

  return 'senior';
}

interface UserModeProviderProps {
  children: ReactNode;
}

export function UserModeProvider({ children }: UserModeProviderProps) {
  const [mode, setModeState] = useState<UserMode>(getInitialMode);

  // Persist mode changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // localStorage may not be available
    }
  }, [mode]);

  const setMode = useCallback((newMode: UserMode) => {
    setModeState(newMode);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((current) => (current === 'senior' ? 'caregiver' : 'senior'));
  }, []);

  const value: UserModeContextType = {
    mode,
    toggleMode,
    setMode,
    isCaregiver: mode === 'caregiver',
    isSenior: mode === 'senior',
  };

  return (
    <UserModeContext.Provider value={value}>
      {children}
    </UserModeContext.Provider>
  );
}

/**
 * Hook to access the user mode context
 * @throws Error if used outside of UserModeProvider
 */
export function useUserMode(): UserModeContextType {
  const context = useContext(UserModeContext);

  if (context === undefined) {
    throw new Error('useUserMode must be used within a UserModeProvider');
  }

  return context;
}

export { UserModeContext };
