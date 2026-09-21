/**
 * Offline copy of the user's routine. SRS 2.4: "Stored routines are viewable
 * offline."
 *
 * One routine per signed-in account, keyed by user id so a second account on
 * the same phone never sees the first one's routine. Contains the routine and
 * product names only -- no image, no safety answers.
 *
 * Every read and write is wrapped: a storage failure must never stop the app
 * showing a routine it just fetched from the server.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Routine, StringsBundle } from './api';

const key = (userId: string) => `routine:v2:${userId}`;

/**
 * The routine and the string bundle it was shown with. The bundle is kept too
 * because the routine screen's copy -- including the FR-REC-007 disclaimer --
 * comes from the server, and an offline cold start has no server to ask.
 */
export interface SavedRoutine {
  routine: Routine;
  copy: StringsBundle;
}

export async function saveRoutine(
  userId: string,
  routine: Routine,
  copy: StringsBundle,
): Promise<void> {
  try {
    await AsyncStorage.setItem(key(userId), JSON.stringify({ routine, copy }));
  } catch {
    // Not fatal. The routine is still on the server.
  }
}

export async function loadRoutine(userId: string): Promise<SavedRoutine | null> {
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    return raw ? (JSON.parse(raw) as SavedRoutine) : null;
  } catch {
    return null;
  }
}

/** Called on sign-out and account deletion (DR-002). */
export async function clearRoutine(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key(userId));
  } catch {
    // Nothing useful to do.
  }
}
