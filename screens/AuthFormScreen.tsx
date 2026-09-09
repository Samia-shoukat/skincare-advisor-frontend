/**
 * Register and login. FR-ONB-001.
 *
 * One component, two modes. They share the email field, the password field,
 * the error handling and the layout; register adds a confirmation field and
 * login adds a reset link. Two files would mean fixing every keyboard and
 * validation bug twice.
 *
 * No password value survives this screen. It goes to Supabase, which hashes it
 * with bcrypt, and is never sent to our backend, written to storage, or logged.
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  Body,
  Button,
  FormScreen,
  Heading,
  LinkButton,
  PasswordField,
  TextField,
} from '../components/ui';
import {
  MIN_PASSWORD_LENGTH,
  authErrorMessage,
  loginWithPassword,
  registerWithPassword,
} from '../lib/supabase';
import { color, space, type } from '../lib/theme';

export type AuthMode = 'register' | 'login';

// Deliberately permissive. Strict client-side email validation rejects valid
// addresses more often than it catches typos, and the confirmation email is
// the real check.
const looksLikeEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value.trim());

export function AuthFormScreen({
  mode,
  onBack,
  onForgotPassword,
  onSwitchMode,
}: {
  mode: AuthMode;
  onBack: () => void;
  onForgotPassword: () => void;
  onSwitchMode: (next: AuthMode) => void;
}) {
  const isRegister = mode === 'register';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  function validate(): string | null {
    if (!looksLikeEmail(email)) return 'Enter a valid email address.';
    if (password.length < MIN_PASSWORD_LENGTH) {
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (isRegister && password !== confirm) return 'The two passwords do not match.';
    return null;
  }

  async function submit() {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (isRegister) {
        const { needsEmailConfirmation } = await registerWithPassword(email, password);
        if (needsEmailConfirmation) {
          // Supabase created the account but issued no session. Without this
          // branch the app would sit on a spinner waiting for a session that
          // is not coming until the user clicks the link in their email.
          setAwaitingConfirmation(true);
        }
        // Otherwise onAuthStateChange picks up the session and the app moves on.
      } else {
        await loginWithPassword(email, password);
      }
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (awaitingConfirmation) {
    return (
      <FormScreen
        footer={<Button label="Back to login" onPress={() => onSwitchMode('login')} />}
      >
        <Heading>Confirm your email</Heading>
        <Body muted>
          We sent a link to {email}. Open it to activate your account, then come
          back and log in.
        </Body>
        <Text style={styles.hint}>
          If it hasn't arrived in a few minutes, check your spam folder.
        </Text>
      </FormScreen>
    );
  }

  return (
    <FormScreen
      footer={
        <>
          <Button
            label={isRegister ? 'Create account' : 'Log in'}
            tone={isRegister ? 'affirm' : 'action'}
            onPress={submit}
            loading={busy}
          />
          <Button label="Back" tone="ghost" onPress={onBack} />
        </>
      }
    >
      <Heading>{isRegister ? 'Create your account' : 'Welcome back'}</Heading>
      <Body muted>
        {isRegister
          ? 'You will set up your skin profile next.'
          : 'Log in to pick up where you left off.'}
      </Body>

      <View style={styles.form}>
        <TextField
          label="Email address"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setError(null);
          }}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          editable={!busy}
        />

        <PasswordField
          label="Password"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setError(null);
          }}
          placeholder={isRegister ? `At least ${MIN_PASSWORD_LENGTH} characters` : ''}
          hint={isRegister ? `Minimum ${MIN_PASSWORD_LENGTH} characters.` : undefined}
          // Tells the keychain to offer a generated password on register and a
          // saved one on login, rather than the wrong thing on both.
          textContentType={isRegister ? 'newPassword' : 'password'}
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          editable={!busy}
        />

        {isRegister ? (
          <PasswordField
            label="Confirm password"
            value={confirm}
            onChangeText={(value) => {
              setConfirm(value);
              setError(null);
            }}
            textContentType="newPassword"
            autoComplete="new-password"
            editable={!busy}
          />
        ) : null}

        {/* One error line for the whole form. Per-field errors on a login form
            tell an attacker which half was wrong. */}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {isRegister ? (
          <LinkButton
            label="Already have an account? Log in"
            onPress={() => onSwitchMode('login')}
          />
        ) : (
          <>
            <LinkButton label="Forgot your password?" onPress={onForgotPassword} />
            <LinkButton
              label="New here? Create an account"
              onPress={() => onSwitchMode('register')}
            />
          </>
        )}
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  form: { marginTop: space.xl },
  error: {
    ...type.small,
    color: color.danger,
    marginBottom: space.md,
  },
  hint: { ...type.small, color: color.textFaint, marginTop: space.lg },
});