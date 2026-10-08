import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { AuthSession, AuthState, User } from '../types/auth';
import {
  clearSession,
  getStoredSession,
  login,
  logout,
  register,
  saveSession,
  type LoginInput,
  type RegisterInput,
} from './auth.service';

interface AuthContextValue extends AuthState {
  signIn: (input: LoginInput) => Promise<{ error: string | null }>;
  signUp: (input: RegisterInput) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  session: AuthSession | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): React.JSX.Element {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore persisted session on mount
  useEffect(() => {
    void (async () => {
      try {
        const stored = await getStoredSession();
        if (stored && stored.expiresAt && stored.expiresAt > Date.now()) {
          setSession(stored);
        } else if (stored) {
          // Session expired
          await clearSession();
        }
      } catch (err) {
        console.error('[AuthContext] Failed to restore session:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const signIn = useCallback(
    async (input: LoginInput): Promise<{ error: string | null }> => {
      const result = await login(input);
      if (result.session) {
        setSession(result.session);
        return { error: null };
      }
      return { error: result.error };
    },
    []
  );

  const signUp = useCallback(
    async (input: RegisterInput): Promise<{ error: string | null }> => {
      const result = await register(input);
      if (result.session) {
        setSession(result.session);
        return { error: null };
      }
      return { error: result.error };
    },
    []
  );

  const signOut = useCallback(async (): Promise<void> => {
    await logout();
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isAuthenticated: !!session?.user,
      user: session?.user ?? null,
      isLoading,
      signIn,
      signUp,
      signOut,
    }),
    [session, isLoading, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Access the auth context. Must be used inside <AuthProvider>.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within <AuthProvider>');
  }
  return ctx;
}

export type { User, AuthSession };

