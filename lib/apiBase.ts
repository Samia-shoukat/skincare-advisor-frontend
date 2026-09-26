/**
 * Where the backend lives.
 *
 * Normally this is `EXPO_PUBLIC_API_URL`, fixed when the app was built.
 *
 * ## The override, and why it exists
 *
 * Test builds are handed to a phone while the backend runs on a laptop behind
 * a temporary HTTPS tunnel. Those tunnel addresses change every time the tunnel
 * restarts, and rebuilding the app for a new address takes twenty minutes. The
 * override lets a tester paste the new address into the app instead.
 *
 * It is **off unless the build sets `EXPO_PUBLIC_ALLOW_SERVER_OVERRIDE=1`**, so
 * a shipped release has no way to be pointed at another server -- which would
 * otherwise be a way to send someone's face photograph somewhere it should
 * never go.
 *
 * Even when enabled, only `https://` addresses are accepted (plus localhost
 * during development), for the same reason `uploadImage.ts` refuses anything
 * else: FR-CAM-003 puts the image on the wire, and it goes encrypted or not at
 * all.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'apiBaseUrl:v1';

const BUILT_IN = process.env.EXPO_PUBLIC_API_URL ?? '';

/** Whether this build permits changing the server address from inside the app. */
export const SERVER_OVERRIDE_ALLOWED = process.env.EXPO_PUBLIC_ALLOW_SERVER_OVERRIDE === '1';

let cached: string | null = null;

/** True for an address this app is willing to send a face photograph to. */
export function isAcceptableBase(url: string): boolean {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (trimmed.startsWith('https://')) return trimmed.length > 'https://'.length;
  // Development only, and only loopback: never a LAN address over plain HTTP.
  return __DEV__ && /^http:\/\/(127\.0\.0\.1|localhost|10\.0\.2\.2)(:\d+)?$/.test(trimmed);
}

/** The address to use for the next request. */
export async function getApiBase(): Promise<string> {
  if (cached !== null) return cached;
  if (SERVER_OVERRIDE_ALLOWED) {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored && isAcceptableBase(stored)) {
        cached = stored.trim().replace(/\/+$/, '');
        return cached;
      }
    } catch {
      // Fall through to the built-in address.
    }
  }
  cached = BUILT_IN;
  return BUILT_IN;
}

/** Synchronous best guess, for code that cannot await. */
export function currentApiBase(): string {
  return cached ?? BUILT_IN;
}

/** Save a new address. Returns false if this build or that address disallows it. */
export async function setApiBase(url: string): Promise<boolean> {
  if (!SERVER_OVERRIDE_ALLOWED || !isAcceptableBase(url)) return false;
  const clean = url.trim().replace(/\/+$/, '');
  try {
    await AsyncStorage.setItem(STORAGE_KEY, clean);
  } catch {
    return false;
  }
  cached = clean;
  return true;
}

/** Back to the address compiled into the build. */
export async function resetApiBase(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing useful to do.
  }
  cached = BUILT_IN;
}
