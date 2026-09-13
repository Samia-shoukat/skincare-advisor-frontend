/**
 * Onboarding router.
 *
 * Renders whichever step the SERVER says is outstanding. There is no local
 * progress counter and no navigation history: `POST /v1/auth/session` returns
 * `needsDateOfBirth`, `needsSafetyAnswers`, `needsSkinType` and `needsConsent`,
 * and this component picks the first one that is still true.
 *
 * That has a practical consequence worth keeping. A user who reinstalls, or
 * signs in on a second device, resumes exactly where they left off — there is
 * nothing local to reconcile, because there is nothing local. It also means a
 * step cannot be skipped by manipulating the client: skipping it would require
 * the server to say it was done.
 *
 * After each step, `refresh()` re-asks the server and this component re-renders
 * onto the next screen.
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Body, Button, FormScreen, Heading } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { color, radius, space, type } from '../lib/theme';
import { ConsentScreen } from './onboarding/ConsentScreen';
import { DateOfBirthScreen } from './onboarding/DateOfBirthScreen';
import { SafetyQuestionsScreen } from './onboarding/SafetyQuestionsScreen';
import { SkinTypeScreen } from './onboarding/SkinTypeScreen';

export function OnboardingHomeScreen() {
  // `token` rather than `session`: the auth context now also accepts a locally
  // minted development token, and every screen below only needs something to
  // put in an Authorization header. Reaching into `session.access_token` here
  // would tie these screens to one of the two ways of getting one.
  const { session, onboarding, refresh, signOut } = useAuth();
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

  // IF-UI-001: the restriction message comes from the server. No claim or
  // restriction copy is written into a screen component.
  useEffect(() => {
    if (!onboarding?.scanAccessBlocked) return;
    api
      .getStrings()
      .then((bundle) => setBlockedMessage(bundle.scanBlockedSupport))
      .catch(() => setBlockedMessage(null));
  }, [onboarding?.scanAccessBlocked]);

   if (!onboarding || !session) return null;
  const token = session.access_token;

  // FR-ONB-003. Checked before the remaining steps: a restricted account has no
  // reason to complete a skin type questionnaire it cannot use.
  //
  // No age, no threshold, and no route back to the date of birth.
  if (onboarding.scanAccessBlocked) {
    return (
      <FormScreen footer={<Button label="Sign out" tone="outline" onPress={signOut} />}>
        <Heading>Scan isn't available on this account</Heading>
        {blockedMessage ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{blockedMessage}</Text>
          </View>
        ) : null}
      </FormScreen>
    );
  }

  if (onboarding.needsDateOfBirth) {
    return <DateOfBirthScreen token={token} onDone={refresh} />;
  }

  if (onboarding.needsSafetyAnswers) {
    return <SafetyQuestionsScreen token={token} onDone={refresh} />;
  }

  if (onboarding.needsSkinType) {
    return <SkinTypeScreen token={token} onDone={refresh} />;
  }

  if (onboarding.needsConsent) {
    return <ConsentScreen token={token} onDone={refresh} />;
  }

  return (
    <FormScreen footer={<Button label="Sign out" tone="outline" onPress={signOut} />}>
      <Heading>You're all set</Heading>
      <Body muted>
        Your profile is saved. Scanning arrives in the next build — you'll get one
        scan to start with.
      </Body>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  notice: {
    backgroundColor: color.attentionSoft,
    borderLeftWidth: 3,
    borderLeftColor: color.attention,
    borderRadius: radius.field,
    padding: space.md,
    marginTop: space.lg,
  },
  noticeText: { ...type.body, color: color.text },
});