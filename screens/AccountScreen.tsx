/**
 * Account & privacy. DR-002, and Google Play's account-deletion requirement.
 *
 * Privacy policy, terms, support contact, sign out, and account deletion.
 *
 * ## Deletion is two steps, and all or nothing
 *
 * Step one explains exactly what goes; step two is an explicit confirm. The
 * server deletes every row and the Supabase sign-in, or -- if the sign-in
 * cannot be removed -- nothing at all (ACCOUNT_DELETION_FAILED), so the user is
 * never left with a half-deleted account. Only after the server confirms is the
 * saved routine cleared from the phone and the user signed out.
 *
 * All copy is from the server string bundle (IF-UI-001).
 */

import React, { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { Body, Button, Card, FormScreen, Heading, LinkButton } from '../components/ui';
import { api, ApiError, StringsBundle } from '../lib/api';
import { openLegalPage } from '../lib/legal';
import { clearRoutine } from '../lib/routineCache';
import { color, radius, space, type } from '../lib/theme';
import { useBackHandler } from '../lib/useBackHandler';

interface Props {
  token: string;
  userId: string;
  copy: StringsBundle;
  onBack: () => void;
  onSignOut: () => void;
}

type Stage = 'menu' | 'confirm' | 'deleting' | 'deleted';

export function AccountScreen({ token, userId, copy, onBack, onSignOut }: Props) {
  const [stage, setStage] = useState<Stage>('menu');
  const [error, setError] = useState<string | null>(null);
  const a = copy.account;

  useBackHandler(() => {
    if (stage === 'deleting') return true; // don't abandon a request in flight
    if (stage === 'confirm') {
      setStage('menu');
      return true;
    }
    if (stage === 'deleted') {
      onSignOut();
      return true;
    }
    onBack();
    return true;
  });

  const signOut = async () => {
    await clearRoutine(userId);
    onSignOut();
  };

  const deleteAccount = async () => {
    setStage('deleting');
    setError(null);
    try {
      await api.deleteAccount(token);
      await clearRoutine(userId);
      setStage('deleted');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Nothing was deleted.');
      setStage('confirm');
    }
  };

  if (stage === 'deleted') {
    return (
      <FormScreen footer={<Button label="Done" onPress={onSignOut} />}>
        <Heading>{a.deleted}</Heading>
      </FormScreen>
    );
  }

  if (stage === 'confirm' || stage === 'deleting') {
    return (
      <FormScreen
        footer={
          <>
            <Button
              label={a.deleteConfirm}
              tone="primary"
              onPress={deleteAccount}
              loading={stage === 'deleting'}
            />
            <Button
              label="Keep my account"
              tone="outline"
              onPress={() => setStage('menu')}
              disabled={stage === 'deleting'}
            />
          </>
        }
      >
        <Heading>{a.deleteHeading}</Heading>
        <View style={styles.warning}>
          <Text style={styles.warningText}>{a.deleteBody}</Text>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </FormScreen>
    );
  }

  return (
    <FormScreen
      footer={
        <>
          <Button label="Sign out" tone="outline" onPress={signOut} />
          <Button label="Back" tone="ghost" onPress={onBack} />
        </>
      }
    >
      <Heading>{a.heading}</Heading>

      <Card>
        <View style={styles.links}>
          <LinkButton label="Privacy policy" onPress={() => openLegalPage(copy.legal.privacyPath)} />
          <LinkButton label="Terms of use" onPress={() => openLegalPage(copy.legal.termsPath)} />
        </View>
      </Card>

      <Card>
        <Body>{a.contact}</Body>
        <View style={styles.spaced}>
          <LinkButton
            label={copy.supportEmail}
            onPress={() => Linking.openURL(`mailto:${copy.supportEmail}`)}
          />
        </View>
      </Card>

      <View style={styles.dangerZone}>
        <Button label={a.deleteHeading} tone="outline" onPress={() => setStage('confirm')} />
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  links: { gap: space.md, alignItems: 'flex-start' },
  spaced: { marginTop: space.sm, alignItems: 'flex-start' },
  dangerZone: { marginTop: space.xl },
  warning: {
    backgroundColor: color.attentionSoft,
    borderLeftWidth: 3,
    borderLeftColor: color.danger,
    borderRadius: radius.field,
    padding: space.md,
    marginTop: space.md,
  },
  warningText: { ...type.body, color: color.text },
  error: { ...type.small, color: color.danger, marginTop: space.md },
});
