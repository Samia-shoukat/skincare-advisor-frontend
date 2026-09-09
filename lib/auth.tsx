/**
 * Auth state.
 *
 * Holds two things that are easy to confuse:
 *
 *   - `session`  — Supabase's proof of who the user is
 *   - `onboarding` — our backend's answer to what they still have to do
 *
 * The second is the important one. The server decides which onboarding step
 * comes next and returns it on every sign-in, so the client never keeps its own
 * copy of "where the user got to". A client that tracked its own progress could
 * disagree with the server after a reinstall, and the server would win anyway.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session } from '@supabase/supabase-js';

import { api, SessionResponse } from './api';
import { signOut as supabaseSignOut, supabase } from './supabase';

interface AuthState {
  loading: boolean;
  session: Session | null;
  onboarding: SessionResponse | null;
  error: string | null;
  /** Re-fetch onboarding state after completing a step. */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [onboarding, setOnboarding] = useState<SessionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Ask the backend who this is and what remains. */
  const syncWithBackend = useCallback(async (current: Session | null) => {
    if (!current) {
      setOnboarding(null);
      return;
    }
    try {
      setError(null);
      setOnboarding(await api.createSession(current.access_token));
    } catch (e) {
      // A failure here means signed in to Supabase but unknown to our backend.
      // Surfacing it rather than silently showing an empty screen matters —
      // it is almost always the API URL being wrong in development.
      setError(e instanceof Error ? e.message : 'Could not load your profile.');
    }
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await syncWithBackend(data.session);
      if (active) setLoading(false);
    });

    // Fires on sign-in, sign-out, and token refresh.
    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (_event, next) => {
        if (!active) return;
        setSession(next);
        await syncWithBackend(next);
      },
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [syncWithBackend]);

  const refresh = useCallback(async () => {
    await syncWithBackend(session);
  }, [session, syncWithBackend]);

  const signOut = useCallback(async () => {
    await supabaseSignOut();
    setOnboarding(null);
  }, []);

  const value = useMemo(
    () => ({ loading, session, onboarding, error, refresh, signOut }),
    [loading, session, onboarding, error, refresh, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}