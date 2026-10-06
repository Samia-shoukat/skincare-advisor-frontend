/**
 * The name to greet someone by.
 *
 * Our backend holds no name and should not start: nothing in the analysis or
 * the routine needs one (DR-002). Supabase already has it, though -- Google
 * sign-in fills `full_name`, and the register form now asks for one -- so the
 * greeting reads it from the session rather than from our profile.
 *
 * An email-only account made before the register form asked has no name at
 * all. For those the address itself is the best guess there is:
 * `samia.shoukat@…` becomes "Samia Shoukat". A guess that is wrong is still a
 * person's own address read back to them, which beats "Hello, user".
 */

import type { User } from '@supabase/supabase-js';

const titleCase = (word: string) =>
  word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word;

function fromEmail(email: string | undefined): string | null {
  if (!email) return null;
  const local = email.split('@')[0] ?? '';
  const words = local
    .split(/[._\-+]+/)
    .map((part) => part.replace(/\d+/g, ''))
    .filter(Boolean);
  return words.length ? words.map(titleCase).join(' ') : null;
}

export function displayName(user: User | null | undefined): string | null {
  if (!user) return null;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  for (const key of ['full_name', 'name']) {
    const value = meta[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return fromEmail(user.email);
}

/** Up to two initials for the avatar: "Samia Shoukat" → "SS". */
export function initials(name: string | null): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}
