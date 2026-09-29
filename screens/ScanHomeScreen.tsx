/**
 * The signed-in area: four tabs and two full-screen sub-screens.
 *
 *   Home     -- greeting, the scan action, a shelf of today's routine
 *   Routine  -- the saved routine, or a prompt to scan
 *   Today    -- the routine as a checklist
 *   Profile  -- privacy, terms, support, sign out, delete
 *
 * Capture and referral take over the whole screen and carry a back arrow, so
 * there is always one obvious way out.
 *
 * ## What decides what
 *
 * The server decides whether a scan is allowed (FR-SUB-002) and whether a
 * referral applies (FR-TRI-001); this file only draws the answer. A flagged
 * user never reaches the capture screen, so the camera permission prompt never
 * appears for them.
 *
 * Offline, the routine tab shows the copy saved on the phone (SRS 2.4).
 *
 * ## Tick state lives here
 *
 * The Today tab is a view over it, and Home shows the next outstanding step, so
 * the set belongs above both rather than inside either. It is device-local and
 * never uploaded -- see lib/routineLog.ts.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import {
  GlassCard,
  IconButton,
  SectionHeader,
  Shelf,
  ShelfCard,
  StatusPill,
} from '../components/glass';
import { ActionTile } from '../components/premium';
import { Screen, TabDefinition, TabKey } from '../components/navigation';
import { Body, Button, Heading } from '../components/ui';
import {
  api,
  ApiError,
  Eligibility,
  Profile,
  Referral,
  Routine,
  RoutineStep,
  StringsBundle,
} from '../lib/api';
import { clearRoutine, loadRoutine, saveRoutine } from '../lib/routineCache';
import { clearRoutineLog, loadTicks, saveTicks, stepId } from '../lib/routineLog';
import { color, space, type } from '../lib/theme';
import { useBackHandler } from '../lib/useBackHandler';
import { AccountScreen } from './AccountScreen';
import { CaptureScreen } from './CaptureScreen';
import { ReferralScreen } from './ReferralScreen';
import { RoutineScreen } from './RoutineScreen';
import { TodayScreen } from './TodayScreen';

/** A sub-screen covers the tabs; null means a tab is showing. */
type Overlay = { name: 'capture' } | { name: 'referral'; referral: Referral } | null;

/** Decorative. Every card carries the server's label beside it. */
const STEP_GLYPH: Record<RoutineStep['step'], string> = {
  CLEANSE: '🧼',
  TREAT: '✨',
  MOISTURISE: '🌿',
  PROTECT: '☀️',
};

interface Props {
  token: string;
  userId: string;
  onSignOut: () => void;
}

export function ScanHomeScreen({ token, userId, onSignOut }: Props) {
  const [copy, setCopy] = useState<StringsBundle | null>(null);
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [offline, setOffline] = useState(false);
  const [tab, setTab] = useState<TabKey>('home');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [error, setError] = useState<string | null>(null);
  const [ticks, setTicks] = useState<Set<string>>(new Set());

  // Android back: leave a sub-screen, or return to Home from another tab. On
  // Home it returns false, so back leaves the app as users expect.
  useBackHandler(
    overlay
      ? () => {
          setOverlay(null);
          return true;
        }
      : tab !== 'home'
        ? () => {
            setTab('home');
            return true;
          }
        : null,
  );

  const signOut = useCallback(async () => {
    // DR-002: nothing of this account stays on the phone.
    await clearRoutine(userId);
    await clearRoutineLog(userId);
    onSignOut();
  }, [userId, onSignOut]);

  const toggleTick = useCallback(
    (id: string) => {
      setTicks((previous) => {
        const next = new Set(previous);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        void saveTicks(userId, next);
        return next;
      });
    },
    [userId],
  );

  /** Tick every step for one time of day at once. */
  const logRoutine = useCallback(
    (when: 'am' | 'pm') => {
      if (!routine) return;
      const list = when === 'am' ? routine.am : routine.pm;
      setTicks((previous) => {
        const next = new Set(previous);
        list.forEach((step, index) => next.add(stepId(when, index, step.ruleId)));
        void saveTicks(userId, next);
        return next;
      });
      setTab('today');
    },
    [routine, userId],
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const [bundle, status, me] = await Promise.all([
        api.getStrings(),
        api.getScanEligibility(token),
        api.getProfile(token).catch(() => null),
      ]);
      setCopy(bundle);
      setEligibility(status);
      setProfile(me);
      setOffline(false);

      if (status.reason === 'REFERRAL_REQUIRED') {
        setOverlay({ name: 'referral', referral: await api.getDeclaredReferral(token) });
        return;
      }

      // FR-SUB-005: the allowance restricts new analysis, not access to a
      // routine already received.
      try {
        const saved = await api.getLatestRoutine(token);
        setRoutine(saved);
        await saveRoutine(userId, saved, bundle);
      } catch (e) {
        if (!(e instanceof ApiError && e.errorCode === 'NO_ROUTINE')) throw e;
        setRoutine(null);
      }
      setOverlay(null);
    } catch (e) {
      // SRS 2.4: a saved routine is viewable offline.
      if (e instanceof ApiError && e.errorCode === 'NETWORK_ERROR') {
        const saved = await loadRoutine(userId);
        if (saved) {
          setCopy(saved.copy);
          setRoutine(saved.routine);
          setOffline(true);
          setTab('routine');
          return;
        }
      }
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
    }
  }, [token, userId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadTicks(userId).then(setTicks);
  }, [userId]);

  // ---- error and loading -------------------------------------------------

  if (error) {
    return (
      <Screen
        title="Skinsight"
        footer={
          <>
            <Button label="Try again" onPress={load} />
            <Button label="Sign out" tone="outline" onPress={signOut} />
          </>
        }
      >
        <Heading>Can't load your account</Heading>
        <Body muted>{error}</Body>
      </Screen>
    );
  }

  if (!copy || (!eligibility && !offline)) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator color={color.primary} />
      </View>
    );
  }

  // ---- sub-screens -------------------------------------------------------

  if (overlay?.name === 'capture') {
    return (
      <CaptureScreen
        copy={{ retake: copy.scan.retake, retakeGuidance: copy.scan.retakeGuidance }}
        onScanComplete={(result) => {
          if (result.outcome === 'REFERRAL' && result.referral) {
            setOverlay({ name: 'referral', referral: result.referral });
          } else {
            setOverlay(null);
            setTab('routine');
            load();
          }
        }}
        onReferralRequired={async () => {
          try {
            setOverlay({ name: 'referral', referral: await api.getDeclaredReferral(token) });
          } catch {
            setOverlay(null);
          }
        }}
        onExit={() => setOverlay(null)}
      />
    );
  }

  if (overlay?.name === 'referral') {
    return (
      <ReferralScreen
        referral={overlay.referral}
        copy={copy}
        // A declared referral has nowhere to go back to: the account cannot
        // scan until its safety answers change, so it gets no back arrow.
        onBack={overlay.referral.kind === 'OBSERVED' ? () => setOverlay(null) : undefined}
        onDone={() => {
          setOverlay(null);
          load();
        }}
      />
    );
  }

  // ---- tabs --------------------------------------------------------------

  const nav = copy.nav;
  const tabs: TabDefinition[] = [
    { key: 'home', icon: '🏠', label: nav.home },
    { key: 'routine', icon: '🧴', label: nav.routine },
    { key: 'today', icon: '🗓', label: nav.today },
    { key: 'account', icon: '🤍', label: nav.profile },
  ];
  const shell = { tabs, activeTab: tab, onTabPress: setTab };

  if (tab === 'account') {
    return (
      <AccountScreen
        token={token}
        userId={userId}
        copy={copy}
        onBack={() => setTab('home')}
        onSignOut={onSignOut}
        shell={shell}
      />
    );
  }

  if (tab === 'today') {
    return (
      <TodayScreen
        routine={routine}
        copy={copy}
        ticks={ticks}
        onToggle={toggleTick}
        shell={shell}
      />
    );
  }

  if (tab === 'routine') {
    if (!routine) {
      return (
        <Screen title={nav.routine} {...shell}>
          <GlassCard tone="strong">
            <Text style={styles.emptyTitle}>{copy.home.noRoutine}</Text>
            <Text style={styles.emptyBody}>{copy.scan.readyBody}</Text>
          </GlassCard>
          {eligibility?.canScan ? (
            <View style={styles.block}>
              <ActionTile
                icon="🫧"
                title={copy.home.scanTitle}
                subtitle={copy.home.scanSubtitle}
                onPress={() => setOverlay({ name: 'capture' })}
              />
            </View>
          ) : null}
        </Screen>
      );
    }
    return (
      <RoutineScreen
        routine={routine}
        copy={copy}
        skinType={profile?.skinType ?? null}
        offline={offline}
        onLogRoutine={logRoutine}
        shell={shell}
      />
    );
  }

  // ---- home --------------------------------------------------------------

  const blocked = !eligibility?.canScan;
  const blockedReason =
    eligibility?.reason === 'QUOTA_EXHAUSTED' ? copy.quotaExhausted : copy.scanBlockedSupport;

  // The whole routine as a flat list, so Home can show what is still
  // outstanding without duplicating the Today tab's filtering.
  const allSteps = routine
    ? [
        ...routine.am.map((step, i) => ({ id: stepId('am', i, step.ruleId), step })),
        ...routine.pm.map((step, i) => ({ id: stepId('pm', i, step.ruleId), step })),
      ]
    : [];
  const outstanding = allSteps.filter((entry) => !ticks.has(entry.id));

  return (
    <Screen
      // The reference has a notification bell here. There are no
      // notifications in this app -- nothing schedules one, nothing would fire
      // -- and a bell that opens something unrelated teaches the wrong thing
      // about what the icon means. The slot goes to the account instead, which
      // is what a circular control in that corner usually is.
      headerRight={<IconButton glyph="👤" label={nav.profile} onPress={() => setTab('account')} />}
      {...shell}
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>{copy.home.greeting}</Text>
        {copy.home.status ? <Text style={styles.status}>{copy.home.status}</Text> : null}
      </View>

      <View style={styles.strip}>
        {profile?.skinType && copy.routineScreen.skinTypeLabels[profile.skinType] ? (
          <StatusPill label={copy.routineScreen.skinTypeLabels[profile.skinType]} />
        ) : null}
        {eligibility ? (
          <StatusPill
            tone="neutral"
            label={`${eligibility.scansRemaining} ${
              eligibility.scansRemaining === 1 ? 'scan left' : 'scans left'
            }`}
          />
        ) : null}
      </View>

      {/* ---- the scan action ---------------------------------------------- */}
      <View style={styles.block}>
        {blocked ? (
          <GlassCard tone="strong">
            <Text style={styles.emptyTitle}>{copy.scan.readyHeading}</Text>
            <Text style={styles.emptyBody}>{blockedReason}</Text>
          </GlassCard>
        ) : (
          <ActionTile
            icon="🫧"
            title={copy.home.scanTitle}
            subtitle={copy.home.scanSubtitle}
            onPress={() => setOverlay({ name: 'capture' })}
          />
        )}
      </View>

      {/* ---- the routine, as a shelf -------------------------------------- */}
      {allSteps.length > 0 ? (
        <View style={styles.block}>
          <SectionHeader
            title={nav.myRoutine}
            actionLabel={nav.seeAll}
            onAction={() => setTab('routine')}
          />
          <Shelf>
            {allSteps.map((entry) => (
              <ShelfCard
                key={entry.id}
                glyph={STEP_GLYPH[entry.step.step]}
                title={entry.step.label}
                status={copy.routineScreen.frequencyLabels[entry.step.frequency]}
                tone={ticks.has(entry.id) ? 'neutral' : 'calm'}
                onPress={() => setTab('routine')}
              />
            ))}
          </Shelf>
        </View>
      ) : null}

      {/* ---- what is left today ------------------------------------------- */}
      {allSteps.length > 0 ? (
        <View style={styles.block}>
          <SectionHeader
            title={nav.todayHeading}
            actionLabel={nav.seeAll}
            onAction={() => setTab('today')}
          />
          <GlassCard tone="strong">
            <Text style={styles.emptyBody}>
              {outstanding.length === 0 ? nav.allDone : outstanding[0].step.label}
            </Text>
          </GlassCard>
        </View>
      ) : null}

      <Text style={styles.claim}>{copy.reviewClaim}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color.ground },
  header: { marginTop: space.xs },
  greeting: { ...type.display, color: color.text },
  status: { ...type.small, color: color.textMuted, marginTop: space.xs },
  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.md },
  block: { marginTop: space.xl },
  emptyTitle: { ...type.bodyStrong, color: color.text, marginBottom: space.xs },
  emptyBody: { ...type.body, color: color.textMuted },
  claim: { ...type.small, color: color.textFaint, marginTop: space.xl, textAlign: 'center' },
});
