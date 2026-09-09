/**
 * Supabase client and auth calls.
 *
 * The only place the app talks to Supabase. Everything else goes through our
 * own backend, which verifies the token issued here.
 *
 * On passwords: this app never handles one directly. `signUp` and
 * `signInWithPassword` hand the value straight to Supabase, which hashes it
 * with bcrypt. No password is stored beyond the screen, logged, or sent to our
 * backend — the backend receives a signed JWT and nothing else.
 *
 * The anon key is safe to ship; it is designed to be public and grants nothing
 * on its own. The service role key is not, and must never appear here.
 */

import 'react-native-url-polyfill/auto';

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be set in .env',
  );
}

const isWeb = Platform.OS === 'web';

export const supabase = createClient(url, anonKey, {
  auth: {
    // On web, Supabase uses localStorage by default. Forcing AsyncStorage
    // there breaks the OAuth redirect, which lands before React has mounted.
    storage: isWeb ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // OAuth returns the session in a URL fragment. On web that fragment is
    // real and must be read; native has no URL bar, and the token is extracted
    // manually in signInWithGoogle below.
    detectSessionInUrl: isWeb,
  },
});

export const MIN_PASSWORD_LENGTH = 8;

// ---------------------------------------------------------------------------
// Email and password
// ---------------------------------------------------------------------------

export interface SignUpResult {
  /**
   * True when Supabase has "Confirm email" enabled: the account exists but no
   * session is issued until the link is clicked. Without this flag the app
   * would wait on a spinner for a session that is not coming.
   */
  needsEmailConfirmation: boolean;
}

export async function registerWithPassword(
  email: string,
  password: string,
): Promise<SignUpResult> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw error;
  return { needsEmailConfirmation: data.session === null };
}

export async function loginWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw error;
  return data.session;
}

/**
 * Password reset. Required, not optional — an app that can lock someone out
 * over a forgotten password and offers no way back has a broken account
 * lifecycle rather than a missing feature.
 */
export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    { redirectTo: Linking.createURL('/reset-password') },
  );
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Google
// ---------------------------------------------------------------------------

// Closes the in-app browser automatically once the redirect fires.
WebBrowser.maybeCompleteAuthSession();

/**
 * Google sign-in.
 *
 * Two paths, because the platforms genuinely differ:
 *
 *   Web — Supabase redirects the page, Google returns to it, and
 *   `detectSessionInUrl` picks the session out of the fragment. Nothing to do
 *   here but start it.
 *
 *   Native — there is no page to redirect. The URL opens in a system browser
 *   sheet, and when it returns to the app's own scheme the tokens are read out
 *   of the fragment and handed to `setSession` by hand.
 *
 * Requires the Google provider to be configured in the Supabase console. Until
 * it is, this throws with Supabase's own message rather than failing silently.
 */
export async function signInWithGoogle() {
  const redirectTo = Linking.createURL('/auth/callback');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      // On native the browser must be opened deliberately, not by the SDK.
      skipBrowserRedirect: !isWeb,
    },
  });
  if (error) throw error;

  if (isWeb) return; // the page is already navigating away

  if (!data?.url) throw new Error('Google sign-in did not return a URL.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  // The user closed the sheet. Not an error — just nothing to do.
  if (result.type !== 'success') return;

  const fragment = result.url.split('#')[1] ?? '';
  const params = new URLSearchParams(fragment);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');

  if (!access_token || !refresh_token) {
    throw new Error(params.get('error_description') ?? 'Google sign-in was not completed.');
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });
  if (sessionError) throw sessionError;
}

// ---------------------------------------------------------------------------

export async function signOut() {
  await supabase.auth.signOut();
}

/**
 * Turn a Supabase auth error into something worth showing a user.
 *
 * "Invalid login credentials" stays vague on purpose: saying which half was
 * wrong tells someone probing an address whether an account exists there.
 */
export function authErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const text = raw.toLowerCase();

  if (text.includes('invalid login credentials')) {
    return 'That email and password combination is not recognised.';
  }
  if (text.includes('already registered') || text.includes('already been registered')) {
    return 'An account already exists for this email. Try logging in instead.';
  }
  if (text.includes('provider is not enabled')) {
    return 'Google sign-in is not set up yet. Use email for now.';
  }
  if (text.includes('password')) {
    return `Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (text.includes('email')) {
    return 'Check the email address and try again.';
  }
  if (text.includes('rate') || text.includes('too many')) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  if (text.includes('network') || text.includes('fetch')) {
    return "Can't reach the server. Check your connection.";
  }
  return 'Something went wrong. Try again.';
}