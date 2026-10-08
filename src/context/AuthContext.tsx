import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { authService } from '../services/authService';
import { AuthSession, User } from '../types/auth';

export interface AuthContextType {
  user: User | null;
  session: AuthSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  register: (username: string, password: string, email: string) => Promise<AuthSession>;
  login: (username: string, password: string) => Promise<AuthSession>;
  logout: () => Promise<void>;
  signIn: (usernameOrEmail: string, password: string) => Promise<AuthSession>;
  signUp: (username: string, email: string, password: string) => Promise<AuthSession>;
  signInDemo: (userId: string) => Promise<AuthSession>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Restore session on app launch
    authService
      .getActiveSession()
      .then((restored) => {
        setSession(restored);
      })
      .finally(() => {
        setIsLoading(false);
      });

    // Subscribe to auth state updates
    const unsubscribe = authService.subscribe((currentSession) => {
      setSession(currentSession);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const register = useCallback(
    async (username: string, password: string, email: string) => {
      try {
        setIsLoading(true);
        setError(null);
        const newSession = await authService.register(username, password, email);
        setSession(newSession);
        return newSession;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Registration failed.';
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const login = useCallback(async (username: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const newSession = await authService.login(username, password);
      setSession(newSession);
      return newSession;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      await authService.logout();
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signInDemo = useCallback(async (userId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const newSession = await authService.signInDemoUser(userId);
      setSession(newSession);
      return newSession;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Demo login failed.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: session?.user || null,
        session,
        isAuthenticated: Boolean(session?.user),
        isLoading,
        error,
        register,
        login,
        logout,
        signIn: login,
        signUp: (username, email, password) => register(username, password, email),
        signInDemo,
        signOut: logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
