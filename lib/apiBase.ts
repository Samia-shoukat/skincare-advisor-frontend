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

/**
 * Ask Supabase where the backend is right now.
 *
 * Test builds run against a laptop behind a temporary tunnel whose address
 * changes on every reconnect. Supabase has a permanent address and the app
 * already holds its key, so it makes a reliable noticeboard: the laptop
 * publishes its current address there (scripts/publish_backend_url.py) and the
 * app reads it.
 *
 * Only ever called when the build allows an override, and the answer is still
 * checked by `isAcceptableBase`, so this cannot point the app at a plaintext
 * server. Kept short and failure-tolerant: if the lookup is slow or fails, the
 * built-in address is used.
 */
async function discover(): Promise<string | null> {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(
      `${base}/rest/v1/app_config?key=eq.backend_url&select=value`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: controller.signal },
    );
    clearTimeout(timer);
    if (!response.ok) return null;
    const rows = (await response.json()) as { value?: string }[];
    const value = rows?.[0]?.value;
    return value && isAcceptableBase(value) ? value.replace(/\/+$/, '') : null;
  } catch {
    return null;
  }
}

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
    // A manually entered address wins: someone typing one is overriding
    // whatever discovery would have said.
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored && isAcceptableBase(stored)) {
        cached = stored.trim().replace(/\/+$/, '');
        return cached;
      }
    } catch {
      // Fall through.
    }

    const discovered = await discover();
    if (discovered) {
      cached = discovered;
      return discovered;
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

/**
 * Forget the cached address and look again.
 *
 * Called when a request fails with a network error: in a test build that
 * usually means the tunnel rotated, and the new address is already on the
 * noticeboard. Returns the address now in force.
 */
export async function refreshApiBase(): Promise<string> {
  if (!SERVER_OVERRIDE_ALLOWED) return currentApiBase();
  cached = null;

  // Discovery FIRST, ahead of any saved address.
  //
  // A saved address normally wins, because someone typing one means it. But
  // this path only runs after a request has already failed, and by then a
  // saved address that no longer answers is not a preference -- it is a trap:
  // it outranks discovery on every future launch, so the app stays stranded on
  // a dead server until someone clears it by hand. That happened in testing.
  //
  // So a failure demotes the saved address: discovery is asked, and whatever
  // it returns replaces the stored value.
  const discovered = await discover();
  if (discovered) {
    cached = discovered;
    try {
      await AsyncStorage.setItem(STORAGE_KEY, discovered);
    } catch {
      // In-memory value still stands for this session.
    }
    return discovered;
  }

  return getApiBase();
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
