/**
 * Products the user has hearted on their routine.
 *
 * ## This never leaves the phone
 *
 * Same rules as the routine log (lib/routineLog.ts): no endpoint, nothing
 * uploaded, nothing fed back into the rules engine. A favourite is a bookmark,
 * not a preference the system learns from -- and turning it into one would be
 * a change the consent screen never described (DR-002).
 *
 * Stored per account, and cleared with everything else on sign-out.
 *
 * Each entry keeps the brand and name it was saved with, so the list still
 * reads correctly after a new scan produces a routine that no longer includes
 * the product.
 *
 * Every read and write is wrapped. A storage failure falls back to an empty
 * list rather than an error screen.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ProductOption } from './api';

const key = (userId: string) => `favorites:v1:${userId}`;

export interface Favorite extends ProductOption {
  /** The routine step's server label at the time it was saved, e.g. "Gentle cleanser". */
  stepLabel: string;
}

export async function loadFavorites(userId: string): Promise<Favorite[]> {
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    const list = raw ? (JSON.parse(raw) as Favorite[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function saveFavorites(userId: string, list: Favorite[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key(userId), JSON.stringify(list));
  } catch {
    // The in-memory list still stands for this session.
  }
}

/** Part of signing out: nothing of this account stays on the phone (DR-002). */
export async function clearFavorites(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key(userId));
  } catch {
    // Nothing useful to do.
  }
}
