/**
 * The signed-in area: four tabs and two full-screen sub-screens.
 *
 *   Home     -- greeting, skin type, the day's note, the "My Routine" CTA
 *   Routine  -- the saved routine, or a prompt to scan
 *   Today    -- the routine as a checklist
 *   Profile  -- skin profile, favourites, settings, support, sign out
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
 * ## Tick and favourite state live here
 *
 * The Routine tab writes ticks ("Mark done") and the Today tab reads them, so
 * the set belongs above both rather than inside either. Favourites are the same
 * shape: hearted on Routine, listed on Profile. Both are device-local and never
 * uploaded -- see lib/routineLog.ts and lib/favorites.ts.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '../components/glass';
import { ActionTile } from '../components/premium';
import { Screen, TabDefinition, TabKey } from '../components/navigation';
import { Body, Button, Heading } from '../components/ui';
import {
  api,
  ApiError,
  Eligibility,
  Profile,
  ProductOption,
  Referral,
  Routine,
  StringsBundle,
} from '../lib/api';
import { clearFavorites, Favorite, loadFavorites, saveFavorites } from '../lib/favorites';
import { clearRoutine, loadRoutine, saveRoutine } from '../lib/routineCache';
import { clearRoutineLog, loadTicks, saveTicks, stepId } from '../lib/routineLog';
import { color, space, type } from '../lib/theme';
import { useBackHandler } from '../lib/useBackHandler';
import { AccountScreen } from './AccountScreen';
import { CaptureScreen } from './CaptureScreen';
import { HomeScreen } from './HomeScreen';
import { ReferralScreen } from './ReferralScreen';
import { RoutineScreen } from './RoutineScreen';
import { TodayScreen } from './TodayScreen';

/** A sub-screen covers the tabs; null means a tab is showing. */
type Overlay = { name: 'capture' } | { name: 'referral'; referral: Referral } | null;

interface Props {
  token: string;
  userId: string;
  /** For the greeting and the profile header. From Supabase, not our backend. */
  name: string | null;
  email: string | null;
  onSignOut: () => void;
}

export function ScanHomeScreen({ token, userId, name, email, onSignOut }: Props) {
  const [copy, setCopy] = useState<StringsBundle | null>(null);
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [offline, setOffline] = useState(false);
  const [tab, setTab] = useState<TabKey>('home');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [error, setError] = useState<string | null>(null);
  const [ticks, setTicks] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Favorite[]>([]);

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
    await clearFavorites(userId);
    onSignOut();
  }, [userId, onSignOut]);

  const toggleFavorite = useCallback(
    (product: ProductOption, stepLabel: string) => {
      setFavorites((previous) => {
        const next = previous.some((item) => item.id === product.id)
          ? previous.filter((item) => item.id !== product.id)
          : [...previous, { ...product, stepLabel }];
        void saveFavorites(userId, next);
        return next;
      });
    },
    [userId],
  );

  const removeFavorite = useCallback(
    (productId: string) => {
      setFavorites((previous) => {
        const next = previous.filter((item) => item.id !== productId);
        void saveFavorites(userId, next);
        return next;
      });
    },
    [userId],
  );

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
    loadFavorites(userId).then(setFavorites);
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
    { key: 'home', icon: 'home', label: nav.home },
    { key: 'routine', icon: 'layers', label: nav.routine },
    { key: 'today', icon: 'calendar', label: nav.today },
    { key: 'account', icon: 'user', label: nav.profile },
  ];
  const shell = { tabs, activeTab: tab, onTabPress: setTab };

  if (tab === 'account') {
    return (
      <AccountScreen
        token={token}
        userId={userId}
        copy={copy}
        name={name}
        email={email}
        skinType={profile?.skinType ?? null}
        scansRemaining={eligibility?.scansRemaining ?? null}
        routine={routine}
        favorites={favorites}
        onRemoveFavorite={removeFavorite}
        onBack={() => setTab('home')}
        // The full sign-out, so favourites and today's ticks go too (DR-002).
        onSignOut={signOut}
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
        favoriteIds={new Set(favorites.map((item) => item.id))}
        onToggleFavorite={toggleFavorite}
        shell={shell}
      />
    );
  }

  // ---- home --------------------------------------------------------------

  return (
    <HomeScreen
      copy={copy}
      name={name}
      skinType={profile?.skinType ?? null}
      eligibility={eligibility}
      hasRoutine={!!routine}
      onOpenRoutine={() => setTab('routine')}
      onOpenProfile={() => setTab('account')}
      onScan={() => setOverlay({ name: 'capture' })}
      shell={shell}
    />
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color.ground },
  block: { marginTop: 26 },
  emptyTitle: { ...type.bodyStrong, fontSize: 15, lineHeight: 20, color: color.text, marginBottom: 4 },
  emptyBody: { ...type.body, fontSize: 15, lineHeight: 22, color: color.textMuted },
});
