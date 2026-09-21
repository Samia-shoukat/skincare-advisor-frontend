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
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Body, Button, FormScreen, Heading } from '../components/ui';
import {
  api,
  ApiError,
  Eligibility,
  Referral,
  Routine,
  StringsBundle,
} from '../lib/api';
import { clearRoutine, loadRoutine, saveRoutine } from '../lib/routineCache';
import { color } from '../lib/theme';
import { CaptureScreen } from './CaptureScreen';
import { ReferralScreen } from './ReferralScreen';
import { RoutineScreen } from './RoutineScreen';

type Screen =
  | { name: 'home' }
  | { name: 'capture' }
  | { name: 'referral'; referral: Referral }
  | { name: 'routine'; routine: Routine; offline?: boolean };

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
      const [bundle, status] = await Promise.all([
        api.getStrings(),
        api.getScanEligibility(token),
      ]);
      setCopy(bundle);
      setEligibility(status);

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

  if (screen.name === 'routine' && copy) {
    return (
      <RoutineScreen
        routine={screen.routine}
        copy={copy}
        offline={screen.offline}
        onDone={screen.offline ? load : undefined}
        onSignOut={signOut}
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
    return <ReferralScreen referral={screen.referral} onDone={load} />;
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

  if (!eligibility.canScan) {
    return (
      <FormScreen footer={<Button label="Sign out" tone="outline" onPress={signOut} />}>
        <Heading>{copy.scan.readyHeading}</Heading>
        <Body muted>
          {eligibility.reason === 'QUOTA_EXHAUSTED' ? copy.quotaExhausted : copy.scanBlockedSupport}
        </Body>
      </FormScreen>
    );
  }

  return (
    <FormScreen
      footer={
        <>
          <Button label={copy.scan.start} onPress={() => setScreen({ name: 'capture' })} />
          <Button label="Sign out" tone="outline" onPress={signOut} />
        </>
      }
    >
      <Heading>{copy.scan.readyHeading}</Heading>
      <Body muted>{copy.scan.readyBody}</Body>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.ground,
  },
});
