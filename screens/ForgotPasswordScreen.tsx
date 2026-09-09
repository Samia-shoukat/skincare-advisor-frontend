/**
 * Password reset request.
 *
 * Required, not optional. An app that can lock someone out over a forgotten
 * password and offers no way back has a broken account lifecycle.
 *
 * The confirmation is deliberately identical whether or not an account exists
 * for that address. Saying "no account found" turns this screen into a way to
 * discover who has signed up.
 */

import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Body, Button, FormScreen, Heading, TextField } from '../components/ui';
import { authErrorMessage, sendPasswordReset } from '../lib/supabase';
import { color, space, type } from '../lib/theme';

const looksLikeEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value.trim());

export function ForgotPasswordScreen({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit() {
    if (!looksLikeEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (e) {
      // Only genuine failures surface — rate limiting, no network. A missing
      // account is not an error here by design.
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <FormScreen footer={<Button label="Back to login" onPress={onBack} />}>
        <Heading>Check your email</Heading>
        <Body muted>
          If an account exists for {email}, a reset link is on its way.
        </Body>
        <Text style={styles.hint}>
          The link expires after an hour. If it doesn't arrive, check your spam
          folder.
        </Text>
      </FormScreen>
    );
  }

  return (
    <FormScreen
      footer={
        <>
          <Button label="Send reset link" tone="action" onPress={submit} loading={busy} />
          <Button label="Back" tone="ghost" onPress={onBack} />
        </>
      }
    >
      <Heading>Reset your password</Heading>
      <Body muted>Enter the email you signed up with.</Body>

      <TextField
        label="Email address"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          setError(null);
        }}
        error={error}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        editable={!busy}
        style={styles.field}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  field: { marginTop: space.xl },
  hint: { ...type.small, color: color.textFaint, marginTop: space.lg },
});