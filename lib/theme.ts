/**
 * Design tokens — Skinsight.
 *
 * Matcha and cream: a green-cast cream ground, deep matcha for action, cocoa
 * for text.
 *
 * The cream is pulled toward green rather than toward beige, and that is the
 * whole difference between this and the cream-and-terracotta palette every
 * wellness app already uses. A beige cream needs a warm accent to feel alive,
 * which is how everyone ends up at terracotta. A green-cast cream is already
 * carrying the accent, so the greens can stay quiet and the one warm colour
 * left over can be saved for something that matters.
 *
 * Cocoa rather than grey or black for text. Grey on a warm ground reads dirty;
 * true black reads like a form, not like something you'd open at midnight to
 * look at your own face.
 *
 * One discipline holds the system together: `attention` is the only saturated
 * warm colour in ordinary use, and it appears on exactly two screens — the
 * referral result and a restricted account. Everything else earns emphasis
 * through weight, size and space.
 */

export const color = {
  /**
   * Page wash, top to bottom. Three stops within a couple of percent of each
   * other, drifting cream → matcha. It should read as light, not as a gradient.
   */
  gradient: ['#F7F5EC', '#F3F3E8', '#ECF1E4'] as const,

  ground: '#F5F4EA',
  /** Cards. Warm white — pure white on cream reads cold and slightly blue. */
  surface: '#FFFDF7',
  surfaceRaised: '#FAF9F0',

  /** Cocoa. */
  text: '#3E3226',
  textMuted: '#7A6E5F',
  textFaint: '#A79C8B',

  /** Deep matcha. Buttons, selected states, the wordmark. */
  primary: '#4E6B4A',
  primaryPressed: '#3E563A',
  /** Matcha at roughly 10%. Selected options, pressed outlines. */
  primarySoft: '#E7EDE1',
  onPrimary: '#FBFAF3',

  /** Lighter sage, for quiet confirmations and the progress indicator. */
  sage: '#8FA882',

  line: '#E4E1D3',
  lineStrong: '#CFCBB8',

  /**
   * Honey. Referral and restricted states ONLY — never a heading, never a
   * button, never decoration.
   */
  attention: '#C4882F',
  attentionSoft: '#F8EFDB',

  /** Form validation. Distinct from attention so the two never blur. */
  danger: '#AF5340',

  // -------------------------------------------------------------------------
  // Compatibility aliases
  //
  // The onboarding screens were written against the earlier dark palette and
  // still refer to these names. Mapping them here means those screens pick up
  // the new colours without being touched — worth doing now, worth removing
  // the next time each screen is edited, because a token called `textOnDark`
  // pointing at cocoa on a cream ground is a lie waiting to mislead someone.
  // -------------------------------------------------------------------------
  textOnDark: '#3E3226',
  brand: '#4E6B4A',
  action: '#4E6B4A',
  actionPressed: '#3E563A',
  affirm: '#4E6B4A',
  affirmPressed: '#3E563A',
  control: '#FFFDF7',
  controlPressed: '#E7EDE1',
  base: '#F5F4EA',
} as const;

/**
 * Editorial through scale and air rather than through a display serif. A serif
 * headline is the obvious move for this look and also the most copied one; the
 * same warmth comes from a large, lightly-tracked sans with room around it.
 */
export const type = {
  wordmark: { fontSize: 42, lineHeight: 48, fontWeight: '600' as const, letterSpacing: -1.4 },
  display: { fontSize: 30, lineHeight: 38, fontWeight: '600' as const, letterSpacing: -0.6 },
  title: { fontSize: 21, lineHeight: 28, fontWeight: '600' as const, letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 25, fontWeight: '400' as const },
  bodyStrong: { fontSize: 16, lineHeight: 25, fontWeight: '600' as const },
  small: { fontSize: 14, lineHeight: 21, fontWeight: '400' as const },
  code: { fontSize: 26, lineHeight: 32, fontWeight: '600' as const, letterSpacing: 8 },
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  pill: 999,
  /** Generous. Soft corners are most of what makes this vernacular read warm. */
  card: 22,
  field: 16,
} as const;

/**
 * Shadows do the separating, not borders. A hairline on a warm ground reads as
 * a seam; a wide soft shadow reads as depth. The shadow is cocoa-tinted, not
 * black — a black shadow on cream turns grey and flattens the warmth.
 */
export const shadow = {
  card: {
    shadowColor: '#3E3226',
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  lifted: {
    shadowColor: '#3E3226',
    shadowOpacity: 0.12,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
} as const;