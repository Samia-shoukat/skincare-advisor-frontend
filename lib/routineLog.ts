/**
 * Which routine steps the user has ticked off today.
 *
 * ## This never leaves the phone
 *
 * There is no endpoint behind it and none is planned. Adherence is not part of
 * the analysis, does not feed the rules engine, and is not something the system
 * makes any claim about — it is a checklist, the same as ticking items on
 * paper. Sending it anywhere would turn a personal note into a health record
 * the SRS never asked for and the consent screen never mentioned (DR-002).
 *
 * Kept per account and per calendar day. Yesterday's ticks are not today's, and
 * a second account on the same phone starts with an empty list. Clearing the
 * account clears these too, via `clearRoutineLog` in the sign-out path.
 *
 * ## The day boundary is the phone's local date
 *
 * Deliberately not UTC. "Today" on a checklist means the user's day, and a
 * user in Pakistan ticking a step at 9pm should not see it move to yesterday
 * because UTC has not rolled over. The consequence is that crossing a timezone
 * can show a day's ticks as a different day's; for a checklist that is a fair
 * trade against the alternative being wrong every evening.
 *
 * Every read and write is wrapped. Storage failing must never stop the screen
 * drawing — it falls back to an unticked list, which is recoverable, rather
 * than to an error.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const key = (userId: string) => `routineLog:v1:${userId}`;

/** Local calendar date as YYYY-MM-DD. See the note on the day boundary above. */
export function today(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

interface LogFile {
  date: string;
  /** Step ids ticked on `date`. */
  done: string[];
}

/**
 * A stable id for a step within a routine.
 *
 * `ruleId` alone is not unique: the same rule can place a step in both the
 * morning and evening routine, and ticking the morning one would silently tick
 * the evening one too. Including the time of day and the position fixes that,
 * and keeps the id stable as long as the routine itself is unchanged.
 */
export function stepId(when: 'am' | 'pm', index: number, ruleId: string): string {
  return `${when}:${index}:${ruleId}`;
}

/** Steps ticked today. Anything stored for an earlier day is ignored. */
export async function loadTicks(userId: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    if (!raw) return new Set();
    const file = JSON.parse(raw) as LogFile;
    if (file?.date !== today() || !Array.isArray(file.done)) return new Set();
    return new Set(file.done);
  } catch {
    return new Set();
  }
}

/** Replace today's ticks. Writing a different day's file discards it. */
export async function saveTicks(userId: string, done: Set<string>): Promise<void> {
  try {
    const file: LogFile = { date: today(), done: [...done] };
    await AsyncStorage.setItem(key(userId), JSON.stringify(file));
  } catch {
    // The in-memory state still stands for this session.
  }
}

/** Part of signing out: nothing of this account stays on the phone (DR-002). */
export async function clearRoutineLog(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key(userId));
  } catch {
    // Nothing useful to do.
  }
}
