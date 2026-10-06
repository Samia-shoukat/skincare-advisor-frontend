/**
 * Date words for Home and Today.
 *
 * Spelled out here rather than through `Intl`, whose coverage on Hermes varies
 * by Android build and which has rendered "Tuesday" as "Tue" or as nothing on
 * older devices. The app ships in English only, so a table is the honest size
 * for this.
 *
 * Local time throughout, for the same reason as lib/routineLog.ts: "today" is
 * the user's day, not UTC's.
 */

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const weekdayName = (date: Date) => WEEKDAYS[date.getDay()];

/** "6 October". */
export const dayMonth = (date: Date) => `${date.getDate()} ${MONTHS[date.getMonth()]}`;

/** "Tuesday, 6 October". */
export const longDate = (date: Date) => `${weekdayName(date)}, ${dayMonth(date)}`;

/** Day of the year, 0-based. Picks the daily note, so it only needs to be stable for a day. */
export function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000);
}

/** The seven days of the week containing `date`, Monday first. */
export function weekOf(date: Date): { date: Date; letter: string; isToday: boolean }[] {
  const mondayOffset = (date.getDay() + 6) % 7;
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    return {
      date: day,
      letter: WEEKDAYS[day.getDay()][0],
      isToday: day.toDateString() === date.toDateString(),
    };
  });
}
