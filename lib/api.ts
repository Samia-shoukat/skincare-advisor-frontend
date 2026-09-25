/**
 * Backend client.
 *
 * One place that knows the URL, attaches the token, and turns the backend's
 * IF-COMM-003 error body into a typed exception. Screens call these functions
 * and never touch `fetch` directly, so adding a header or changing the base URL
 * is a one-line change rather than a search across screens.
 *
 * Response field names match the API exactly (camelCase). Renaming them here
 * would mean two vocabularies for the same thing.
 */

const baseUrl = process.env.EXPO_PUBLIC_API_URL;

if (!baseUrl) {
  throw new Error('EXPO_PUBLIC_API_URL must be set in .env');
}

/** The error shape every failed request returns (IF-COMM-003). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly errorCode: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> {
  const { method = 'GET', body, token } = options;

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // A network failure is not the same as a rejected request, and the user
    // needs different advice for each.
    throw new ApiError(0, 'NETWORK_ERROR', "Can't reach the server. Check your connection.");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.errorCode ?? 'UNKNOWN',
      payload?.message ?? 'Something went wrong.',
    );
  }

  return payload as T;
}

// ---------------------------------------------------------------------------
// Types — mirror the backend response models
// ---------------------------------------------------------------------------

export type AgeBand = 'MINOR' | 'ADULT';
export type SkinType = 'OILY' | 'DRY' | 'COMBINATION' | 'NORMAL';

export interface SessionResponse {
  isNewUser: boolean;
  onboardingComplete: boolean;
  needsDateOfBirth: boolean;
  needsSafetyAnswers: boolean;
  needsSkinType: boolean;
  needsConsent: boolean;
  /** FR-ONB-003. A flag with no explanation attached — by design. */
  scanAccessBlocked: boolean;
}

export interface Profile {
  ageBand: AgeBand | null;
  skinType: SkinType | null;
  referralFlag: boolean;
  scanAccessBlocked: boolean;
  onboardingComplete: boolean;
  scansRemaining: number;
  consentVersion: string | null;
}

export interface SafetyQuestion {
  id: string;
  text: string;
  field: string;
}

export interface StringsBundle {
  /** Version of the whole bundle. NOT what consent acknowledges -- see consentVersion. */
  version: string;
  /** FR-ONB-007. The limitations statement version to send back on consent. */
  consentVersion: string;
  supportEmail: string;
  /** Public pages on the backend. Open with lib/legal.ts. */
  legal: { privacyPath: string; termsPath: string; accountDeletionPath: string };
  account: {
    heading: string;
    deleteHeading: string;
    deleteBody: string;
    deleteConfirm: string;
    deleted: string;
    contact: string;
  };
  limitationsStatement: string;
  safetyQuestions: SafetyQuestion[];
  referral: Record<string, string>;
  routineDisclaimer: string;
  reviewClaim: string;
  capture: Record<string, string>;
  quotaExhausted: string;
  /** FR-ONB-003. Shown when scanAccessBlocked is true. Names no age. */
  scanBlockedSupport: string;
  scan: {
    readyHeading: string;
    readyBody: string;
    start: string;
    retake: string;
    retakeGuidance: string;
  };
  routineScreen: {
    heading: string;
    morning: string;
    evening: string;
    budget: string;
    premium: string;
    for: string;
    omitted: string;
    startSlowly: string;
    offline: string;
    concernLabels: Record<string, string>;
    frequencyLabels: Record<string, string>;
  };
  referralScreen: {
    heading: string;
    observedIntro: string;
    summaryHeading: string;
    share: string;
  };
}

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

export type ScanIneligibilityReason =
  | 'ONBOARDING_INCOMPLETE'
  | 'SCAN_ACCESS_BLOCKED'
  | 'REFERRAL_REQUIRED'
  | 'QUOTA_EXHAUSTED';

/** A display convenience only. The server re-checks on every scan (FR-SUB-002). */
export interface Eligibility {
  canScan: boolean;
  reason: ScanIneligibilityReason | null;
  scansRemaining: number;
}

/**
 * One finding on the referral screen (FR-TRI-003).
 *
 * No identifier: the server never sends one, so there is nothing here that a
 * screen could render by mistake. `associations` is absent -- not empty -- unless
 * FR-AI-007 permits it, and in release 1.0 it never does.
 */
export interface ReferralSignal {
  observation: string;
  associations?: string[];
}

export interface Referral {
  /** DECLARED: raised by the safety answers, no photo. OBSERVED: raised by the photo. */
  kind: 'DECLARED' | 'OBSERVED';
  signals: ReferralSignal[];
  /** FR-TRI-005. Finished text, built server-side. Copy as-is. */
  summary: string;
}

export type ScanOutcome = 'ROUTINE' | 'REFERRAL' | 'UNUSABLE' | 'ERROR';

// ---------------------------------------------------------------------------
// Routine -- FR-REC-001, FR-REC-005
// ---------------------------------------------------------------------------

export interface ProductOption {
  id: string;
  brand: string;
  name: string;
}

export interface RoutineStep {
  step: 'CLEANSE' | 'TREAT' | 'MOISTURISE' | 'PROTECT';
  ingredient: string;
  label: string;
  maxPercent: number | null;
  frequency: 'DAILY' | 'ALTERNATE_DAYS' | 'TWICE_WEEKLY';
  ruleId: string;
  concerns: string[];
  /** FR-REC-005. A tier is null when no safe product exists; `generic` always does. */
  products: {
    budget: ProductOption | null;
    premium: ProductOption | null;
    generic: string;
  };
}

export interface Routine {
  routineId: string;
  matrixVersion: string;
  createdAt: string | null;
  am: RoutineStep[];
  pm: RoutineStep[];
  omitted: { concern: string; reason: string }[];
}

export interface ScanResponse {
  scanId: string;
  outcome: ScanOutcome;
  referral?: Referral;
  concerns?: { concernId: string; severity: string }[];
  routine?: Routine | null;
  scansRemaining: number;
}

export interface QuestionnaireOption {
  id: string;
  label: string;
}

export interface QuestionnaireQuestion {
  id: string;
  prompt: string;
  options: QuestionnaireOption[];
}

export interface Questionnaire {
  version: string;
  questions: QuestionnaireQuestion[];
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export const api = {
  /** FR-ONB-001. Creates the account on first call, resolves it afterwards. */
  createSession: (token: string) =>
    request<SessionResponse>('/v1/auth/session', { method: 'POST', token }),

  getProfile: (token: string) => request<Profile>('/v1/me', { token }),

  deleteAccount: (token: string) =>
    request<void>('/v1/me', { method: 'DELETE', token }),

  /** FR-ONB-002/003/004. Under-age dates return 200 with scanAccessBlocked. */
  setDateOfBirth: (token: string, dateOfBirth: string) =>
    request<{ ageBand: AgeBand | null; scanAccessBlocked: boolean }>(
      '/v1/me/date-of-birth',
      { method: 'POST', token, body: { dateOfBirth, confirmed: true } },
    ),

  /** FR-ONB-005. All four answers, every time. */
  setSafetyAnswers: (
    token: string,
    answers: {
      pregnantOrBreastfeeding: boolean;
      prescriptionAcneTreatment: boolean;
      openWoundsOrChangingMole: boolean;
      diagnosedEczemaPsoriasisRosacea: boolean;
    },
  ) =>
    request<{ referralFlag: boolean; onboardingComplete: boolean }>(
      '/v1/me/safety-answers',
      { method: 'POST', token, body: answers },
    ),

  /** FR-ONB-006. Raw answers — the server scores them. */
  setSkinType: (token: string, answers: Record<string, string>) =>
    request<{ skinType: SkinType; onboardingComplete: boolean }>('/v1/me/skin-type', {
      method: 'POST',
      token,
      body: { answers },
    }),

  /** FR-ONB-007. Send back the version actually displayed. */
  recordConsent: (token: string, acknowledgedVersion: string) =>
    request<{ consentVersion: string; onboardingComplete: boolean }>('/v1/me/consent', {
      method: 'POST',
      token,
      body: { acknowledgedVersion },
    }),

  /** IF-UI-001. Every claim in the app comes from here. */
  getStrings: () => request<StringsBundle>('/v1/content/strings'),

  getQuestionnaire: () => request<Questionnaire>('/v1/content/questionnaire'),

  /** Whether to offer the capture control at all. */
  getScanEligibility: (token: string) =>
    request<Eligibility>('/v1/scans/eligibility', { token }),

  /** FR-SUB-005, UC-007. Available whatever the scan allowance says. 404 NO_ROUTINE if none yet. */
  getLatestRoutine: (token: string) => request<Routine>('/v1/routines/latest', { token }),

  /** FR-TRI-001, UC-003. The referral for a user flagged by their own answers -- no photo. */
  getDeclaredReferral: (token: string) =>
    request<Referral>('/v1/scans/referral', { token }),
};