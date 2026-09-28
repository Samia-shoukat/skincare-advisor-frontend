/**
 * Scan home. What an onboarded user sees.
 *
 * Asks the server whether a scan is permitted before offering the camera
 * (FR-SUB-002 calls this a display convenience; the server re-checks on
 * submit). The answer decides the screen:
 *
 *   canScan           -> the start button, then the camera
 *   REFERRAL_REQUIRED -> the declared referral, with no camera at all. FR-TRI-001
 *                        requires that no image is captured for a flagged user,
 *                        so the capture screen is never mounted -- the camera
 *                        permission prompt does not even appear.
 *   QUOTA_EXHAUSTED   -> the saved routine, in full (FR-SUB-005, UC-007)
 *
 * Offline, the last routine saved on this phone is shown instead (SRS 2.4).
 *
 * The camera permission is requested inside CaptureScreen, i.e. at the point of
 * first use rather than at launch (IF-HW-001).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Body, Button, FormScreen, Heading } from '../components/ui';
import { ActionTile, MiniTile, Pill, SectionLabel, SoftCard } from '../components/premium';
import {
  api,
  ApiError,
  Eligibility,
  Profile,
  Referral,
  Routine,
  StringsBundle,
} from '../lib/api';
import { clearRoutine, loadRoutine, saveRoutine } from '../lib/routineCache';
import { color, radius, space, type } from '../lib/theme';
import { useBackHandler } from '../lib/useBackHandler';
import { AccountScreen } from './AccountScreen';
import { CaptureScreen } from './CaptureScreen';
import { ReferralScreen } from './ReferralScreen';
import { RoutineScreen } from './RoutineScreen';

type Screen =
  | { name: 'home' }
  | { name: 'capture' }
  | { name: 'referral'; referral: Referral }
  | { name: 'routine'; routine: Routine; offline?: boolean }
  | { name: 'account'; returnTo: Screen };

interface Props {
  token: string;
  userId: string;
  onSignOut: () => void;
}

export function ScanHomeScreen({ token, userId, onSignOut }: Props) {
  const [copy, setCopy] = useState<StringsBundle | null>(null);
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [error, setError] = useState<string | null>(null);
  // Skin type for the routine dashboard. From the profile (FR-ONB-006), never
  // from the image.
  const [profile, setProfile] = useState<Profile | null>(null);

  // Android back. Top-level screens (home, routine, a declared referral)
  // return false so back leaves the app as users expect; everything else steps
  // back one screen. Capture and Account handle their own.
  useBackHandler(
    screen.name === 'referral' && screen.referral.kind === 'OBSERVED'
      ? () => {
          load();
          return true;
        }
      : null,
  );
  const openAccount = () => setScreen({ name: 'account', returnTo: screen });

  const signOut = useCallback(async () => {
    // DR-002: nothing of this account stays on the phone after it leaves.
    await clearRoutine(userId);
    onSignOut();
  }, [userId, onSignOut]);

  const showRoutine = useCallback(
    async (routine: Routine, bundle: StringsBundle) => {
      await saveRoutine(userId, routine, bundle);
      setScreen({ name: 'routine', routine });
    },
    [userId],
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const [bundle, status, me] = await Promise.all([
        api.getStrings(),
        api.getScanEligibility(token),
        // Never fatal: the routine renders without it, just without a skin type.
        api.getProfile(token).catch(() => null),
      ]);
      setCopy(bundle);
      setEligibility(status);
      setProfile(me);

      if (status.reason === 'REFERRAL_REQUIRED') {
        setScreen({ name: 'referral', referral: await api.getDeclaredReferral(token) });
        return;
      }

      if (status.reason === 'QUOTA_EXHAUSTED') {
        // FR-SUB-005: the allowance restricts new analysis, not access to the
        // routine already received.
        try {
          await showRoutine(await api.getLatestRoutine(token), bundle);
          return;
        } catch (e) {
          if (!(e instanceof ApiError && e.errorCode === 'NO_ROUTINE')) throw e;
        }
      }

      setScreen({ name: 'home' });
    } catch (e) {
      // SRS 2.4: stored routines are viewable offline.
      if (e instanceof ApiError && e.errorCode === 'NETWORK_ERROR') {
        const saved = await loadRoutine(userId);
        if (saved) {
          setCopy(saved.copy);
          setScreen({ name: 'routine', routine: saved.routine, offline: true });
          return;
        }
      }
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
    }
  }, [token, userId, showRoutine]);

  useEffect(() => {
    load();
  }, [load]);

  const showDeclaredReferral = async () => {
    try {
      setScreen({ name: 'referral', referral: await api.getDeclaredReferral(token) });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
      setScreen({ name: 'home' });
    }
  };

  if (error) {
    return (
      <FormScreen
        footer={
          <>
            <Button label="Try again" onPress={load} />
            <Button label="Sign out" tone="outline" onPress={signOut} />
          </>
        }
      >
        <Heading>Can't load your scan</Heading>
        <Body muted>{error}</Body>
      </FormScreen>
    );
  }

  if (screen.name === 'account' && copy) {
    return (
      <AccountScreen
        token={token}
        userId={userId}
        copy={copy}
        onBack={() => setScreen(screen.returnTo)}
        onSignOut={onSignOut}
      />
    );
  }

  if (screen.name === 'routine' && copy) {
    return (
      <RoutineScreen
        routine={screen.routine}
        copy={copy}
        skinType={profile?.skinType ?? null}
        offline={screen.offline}
        onDone={screen.offline ? load : undefined}
        onAccount={screen.offline ? undefined : openAccount}
        onSignOut={screen.offline ? signOut : undefined}
      />
    );
  }

  if (!copy || !eligibility) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator color={color.primary} />
      </View>
    );
  }

  if (screen.name === 'referral') {
    // For a declared referral, "Done" re-checks eligibility, which leads back
    // here while the flag is set. That is intended: there is nothing else this
    // account can do until its safety answers change.
    return <ReferralScreen referral={screen.referral} onDone={load} onAccount={openAccount} />;
  }

  if (screen.name === 'capture') {
    return (
      <CaptureScreen
        copy={{ retake: copy.scan.retake, retakeGuidance: copy.scan.retakeGuidance }}
        onScanComplete={(result) => {
          if (result.outcome === 'REFERRAL' && result.referral) {
            setScreen({ name: 'referral', referral: result.referral });
          } else if (result.routine) {
            showRoutine(result.routine, copy);
          } else {
            load();
          }
        }}
        onReferralRequired={showDeclaredReferral}
        onExit={load}
      />
    );
  }

  // ---- Home dashboard -------------------------------------------------
  // One screen with everything the MVP offers: who you are, the scan, your
  // routine, and your account. Whether the scan tile is live is the server's
  // decision (FR-SUB-002); this only draws the answer.
  const blocked = !eligibility.canScan;
  const blockedReason =
    eligibility.reason === 'QUOTA_EXHAUSTED' ? copy.quotaExhausted : copy.scanBlockedSupport;
  const hasRoutine = eligibility.reason === 'QUOTA_EXHAUSTED';

  return (
    <FormScreen>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{copy.home.greeting} 🤍</Text>
          <Text style={styles.status}>{copy.home.status}</Text>
        </View>
        <Text style={styles.avatar}>🫧</Text>
      </View>

      {profile?.skinType ? (
        <View style={styles.profileStrip}>
          <Pill label={copy.routineScreen.skinTypeLabels[profile.skinType] ?? ''} tone="solid" />
          <Pill
            label={`${eligibility.scansRemaining} ${
              eligibility.scansRemaining === 1 ? 'scan left' : 'scans left'
            }`}
          />
        </View>
      ) : null}

      <View style={styles.block}>
        <SectionLabel>Today</SectionLabel>
        {blocked ? (
          <SoftCard>
            <Text style={styles.blockedTitle}>{copy.scan.readyHeading}</Text>
            <Text style={styles.blockedBody}>{blockedReason}</Text>
          </SoftCard>
        ) : (
          <ActionTile
            icon="🫧"
            title={copy.home.scanTitle}
            subtitle={copy.home.scanSubtitle}
            onPress={() => setScreen({ name: 'capture' })}
          />
        )}
      </View>

      <View style={styles.tiles}>
        <MiniTile
          icon="🧴"
          label={hasRoutine ? copy.home.routineTile : copy.home.noRoutine}
          onPress={load}
        />
        <MiniTile icon="🤍" label={copy.home.accountTile} onPress={openAccount} />
      </View>

      <View style={styles.block}>
        <SectionLabel>Good to know</SectionLabel>
        <SoftCard tone="accent">
          <Text style={styles.noteText}>{copy.scan.readyBody}</Text>
        </SoftCard>
      </View>

      <Text style={styles.claim}>{copy.reviewClaim}</Text>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.md,
  },
  greeting: { ...type.display, color: color.text },
  status: { ...type.small, color: color.textMuted, marginTop: 2 },
  avatar: {
    fontSize: 30,
    backgroundColor: color.surface,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    overflow: 'hidden',
  },
  profileStrip: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  block: { marginTop: space.xl },
  tiles: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  blockedTitle: { ...type.bodyStrong, color: color.text, marginBottom: space.xs },
  blockedBody: { ...type.body, color: color.textMuted },
  noteText: { ...type.body, color: color.text },
  claim: { ...type.small, color: color.textFaint, marginTop: space.xl, textAlign: 'center' },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.ground,
  },
});
