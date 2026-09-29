/**
 * Design tokens — Skinsight.
 *
 * Soft lilac and blush: a pale violet ground, plum for text, muted violet for
 * action.
 *
 * Pastel is the easy part; contrast is the part that usually breaks. Plum text
 * on pale lilac clears WCAG AA comfortably, and the violet used for buttons is
 * dark enough to carry white label text -- a prettier, lighter violet would
 * fail both and is the reason most pastel apps end up unreadable in sunlight
 * (IF-UI-003).
 *
 * Shadows, not borders, do the separating. The shadow is plum-tinted rather
 * than black, because a black shadow over lilac turns grey and kills the wash.
 *
 * One discipline holds: `attention` is the only warm colour in ordinary use,
 * and it appears on exactly two screens -- the referral result and a restricted
 * account. Everything else earns emphasis through weight, size and space.
 */

export const color = {
  /**
   * Page wash, top to bottom: blush → lilac → blush. Warmer and a touch more
   * saturated than a near-white wash, because the glass surfaces below are
   * translucent — they have nothing to show through them unless the ground
   * carries actual colour.
   */
  gradient: ['#FBE7F0', '#EFE4F8', '#F7E7F0'] as const,

  ground: '#F5EAF5',
  /** Cards. Warm white — pure white on cream reads cold and slightly blue. */
  surface: '#FFFFFF',
  surfaceRaised: '#F8F3FC',

  // ---------------------------------------------------------------------
  // Glass
  //
  // Translucent white over the gradient, not a blur. `expo-blur` is a native
  // module, and adding one here would mean another prebuild and native
  // rebuild — the part of this project that has been most fragile. Over a
  // soft two-stop wash, a white fill at ~60% with a brighter hairline on top
  // produces the same read: the colour beneath shifts across the card, and
  // the edge catches light. A real blur would only differ where there is
  // high-frequency detail behind the card, and here there never is.
  //
  // Opacity is deliberately high. Glass at 25% looks better in a mockup and
  // fails in sunlight, which is where this app gets used (IF-UI-003).
  // ---------------------------------------------------------------------
  /** Standard glass panel. */
  glass: 'rgba(255, 255, 255, 0.62)',
  /** For panels carrying body text, where legibility outranks the effect. */
  glassStrong: 'rgba(255, 255, 255, 0.82)',
  /** The lit edge. This, not the fill, is what reads as "glass". */
  glassBorder: 'rgba(255, 255, 255, 0.9)',
  /** Quiet violet edge for the lower half of a panel. */
  glassEdge: 'rgba(124, 92, 158, 0.10)',

  /** Cocoa. */
  text: '#3B2E47',
  textMuted: '#675B79',
  textFaint: '#867C96',

  /** Deep matcha. Buttons, selected states, the wordmark. */
  primary: '#7C5C9E',
  primaryPressed: '#674C85',
  /** Matcha at roughly 10%. Selected options, pressed outlines. */
  primarySoft: '#F0E7F8',
  onPrimary: '#FFFFFF',

  /** Lighter sage, for quiet confirmations and the progress indicator. */
  sage: '#B79AD0',

  line: '#EDE4F3',
  lineStrong: '#D8CCE3',

  /**
   * Honey. Referral and restricted states ONLY — never a heading, never a
   * button, never decoration.
   */
  attention: '#A4683A',
  attentionSoft: '#FAEFE4',

  /** Form validation. Distinct from attention so the two never blur. */
  danger: '#B5495F',

  // -------------------------------------------------------------------------
  // Compatibility aliases
  //
  // The onboarding screens were written against the earlier dark palette and
  // still refer to these names. Mapping them here means those screens pick up
  // the new colours without being touched — worth doing now, worth removing
  // the next time each screen is edited, because a token called `textOnDark`
  // pointing at cocoa on a cream ground is a lie waiting to mislead someone.
  // -------------------------------------------------------------------------
  textOnDark: '#3B2E47',
  brand: '#7C5C9E',
  action: '#7C5C9E',
  actionPressed: '#674C85',
  affirm: '#7C5C9E',
  affirmPressed: '#674C85',
  control: '#FFFFFF',
  controlPressed: '#F0E7F8',
  base: '#F7F2FA',
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
    shadowColor: '#3B2E47',
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  lifted: {
    shadowColor: '#3B2E47',
    shadowOpacity: 0.12,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
} as const;