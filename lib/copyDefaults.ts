/**
 * Makes the server's copy bundle safe to read.
 *
 * The app renders `copy.home.greeting`, `copy.routineScreen.severityLabels[x]`
 * and so on. When a server predates a client — or a client predates a server —
 * one of those blocks is missing, the property access throws, and the app dies
 * on launch with no message. That happened: a backend serving an older bundle
 * made the home screen crash before it drew anything.
 *
 * So every bundle passes through here first. Missing structure is filled in,
 * and the app degrades to plainer wording instead of failing.
 *
 * ## What is filled in, and what deliberately is not
 *
 * **Chrome** — button labels, section headings, the severity and skin-type
 * word maps — gets a local fallback. It describes the app, not the user's skin,
 * so a local copy of "Morning" carries no risk.
 *
 * **Claims** — the limitations statement, the referral framing, the routine
 * disclaimer, the clinical review claim — get NOTHING. IF-UI-001 exists so
 * that those sentences live in one reviewed place on the server; inventing a
 * disclaimer here would defeat the requirement it is meant to satisfy. If the
 * server does not send them, the screens render nothing in their place, which
 * is visibly wrong and gets noticed — unlike a plausible sentence nobody
 * approved.
 */

import type { StringsBundle } from './api';

const CHROME = {
  /**
   * Navigation labels. These name parts of the app, never anything about the
   * user's skin, so there is no claim here for the server to own. The stage
   * names (Cleanse, Treat, Moisturise, Protect) are the engine's four step
   * kinds rendered as words -- the same mapping `routineScreen.ingredientPurpose`
   * relies on -- not a description of what any product does.
   */
  nav: {
    home: 'Home',
    routine: 'Routine',
    today: 'Today',
    profile: 'Profile',
    todayHeading: 'Today',
    filterToday: 'Today',
    filterUpcoming: 'Upcoming',
    filterDone: 'Completed',
    careOverview: 'Care overview',
    myRoutine: 'My routine',
    seeAll: 'See all',
    logRoutine: 'Log routine',
    nothingToday: 'Nothing scheduled yet',
    allDone: 'All done for today',
    cleanse: 'Cleanse',
    treat: 'Treat',
    moisturise: 'Moisturise',
    protect: 'Protect',
  },
  home: {
    greeting: 'Hello',
    status: '',
    scanTitle: 'Scan my face',
    scanSubtitle: '',
    routineTile: 'My routine',
    accountTile: 'Account',
    noRoutine: 'No routine yet',
  },
  routineScreen: {
    heading: 'Your routine',
    morning: 'Morning',
    evening: 'Evening',
    budget: 'Budget',
    premium: 'Premium',
    for: 'For',
    omitted: '',
    startSlowly: '',
    offline: '',
    concernLabels: {} as Record<string, string>,
    frequencyLabels: {} as Record<string, string>,
    ingredientPurpose: {} as Record<string, string>,
    profileHeading: 'Your skin profile',
    skinTypeLabel: 'Skin type',
    concernsLabel: 'What we noticed',
    stepsLabel: 'Steps',
    affordable: 'Affordable',
    premiumTier: 'Premium',
    pharmacy: 'At the pharmacy',
    skinTypeLabels: {} as Record<string, string>,
    vitalsHeading: 'Skin vitals',
    vitalsCaption: '',
    severityLabels: {} as Record<string, string>,
  },
  referralScreen: {
    heading: 'Please see a healthcare professional',
    observedIntro: '',
    summaryHeading: 'Summary for your appointment',
    share: 'Copy or share summary',
  },
  account: {
    heading: 'Account & privacy',
    deleteHeading: 'Delete your account',
    deleteBody: '',
    deleteConfirm: 'Delete',
    deleted: 'Your account has been deleted.',
    contact: '',
  },
  scan: {
    readyHeading: 'Ready for your scan',
    readyBody: '',
    start: 'Start scan',
    retake: '',
    retakeGuidance: '',
  },
  legal: {
    privacyPath: '/legal/privacy',
    termsPath: '/legal/terms',
    accountDeletionPath: '/legal/account-deletion',
  },
};

/** Shallow-merge one block: server values win, missing keys fall back. */
function block<T extends object>(fallback: T, received: unknown): T {
  if (!received || typeof received !== 'object') return { ...fallback };
  return { ...fallback, ...(received as object) } as T;
}

/**
 * Fill in anything the server did not send.
 *
 * Applied to every bundle the app reads — fetched or restored from the offline
 * cache, which may hold a bundle saved by an older build.
 */
export function normaliseBundle(raw: unknown): StringsBundle {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  return {
    ...(b as unknown as StringsBundle),
    // Claim text is passed through untouched: absent stays absent.
    nav: block(CHROME.nav, b.nav),
    home: block(CHROME.home, b.home),
    routineScreen: block(CHROME.routineScreen, b.routineScreen),
    referralScreen: block(CHROME.referralScreen, b.referralScreen),
    account: block(CHROME.account, b.account),
    scan: block(CHROME.scan, b.scan),
    legal: block(CHROME.legal, b.legal),
    referral: block({} as Record<string, string>, b.referral) as StringsBundle['referral'],
    capture: block({} as Record<string, string>, b.capture) as StringsBundle['capture'],
    safetyQuestions: Array.isArray(b.safetyQuestions)
      ? (b.safetyQuestions as StringsBundle['safetyQuestions'])
      : [],
  };
}
