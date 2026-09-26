/**
 * Change the backend address. TEST BUILDS ONLY.
 *
 * Reachable only when the build sets EXPO_PUBLIC_ALLOW_SERVER_OVERRIDE=1 (see
 * lib/apiBase.ts). It exists because test builds point at a temporary tunnel
 * whose address changes on every restart, and rebuilding the app for a new
 * address takes twenty minutes.
 *
 * Only https:// addresses are accepted. A face photograph goes over this
 * connection (FR-CAM-003), so an unencrypted one is refused here exactly as it
 * is at upload time.
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Body, Button, FormScreen, Heading, TextField } from '../components/ui';
import { currentApiBase, getApiBase, isAcceptableBase, resetApiBase, setApiBase } from '../lib/apiBase';
import { color, space, type } from '../lib/theme';
import { useBackHandler } from '../lib/useBackHandler';

interface Props {
  onDone: () => void;
}

export function ServerAddressScreen({ onDone }: Props) {
  const [value, setValue] = useState(currentApiBase());
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useBackHandler(() => {
    onDone();
    return true;
  });

  useEffect(() => {
    getApiBase().then(setValue);
  }, []);

  const save = async () => {
    setError(null);
    setSaved(null);
    if (!isAcceptableBase(value)) {
      setError('Enter the full address, starting with https://');
      return;
    }
    const ok = await setApiBase(value);
    if (!ok) {
      setError('Could not save that address.');
      return;
    }
    setSaved(value.trim());
  };

  const reset = async () => {
    await resetApiBase();
    setValue(currentApiBase());
    setSaved('Reset to the built-in address.');
    setError(null);
  };

  return (
    <FormScreen
      footer={
        <>
          <Button label="Save" onPress={save} />
          <Button label="Use built-in address" tone="outline" onPress={reset} />
          <Button label="Back" tone="ghost" onPress={onDone} />
        </>
      }
    >
      <Heading>Server address</Heading>
      <Body muted>
        For testing. Paste the https:// address of the backend, then go back and sign in.
      </Body>

      <View style={styles.field}>
        <TextField
          label="Backend address"
          value={value}
          onChangeText={setValue}
          placeholder="https://example.lhr.life"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {saved ? <Text style={styles.ok}>{saved}</Text> : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  field: { marginTop: space.lg },
  error: { ...type.small, color: color.danger, marginTop: space.md },
  ok: { ...type.small, color: color.primary, marginTop: space.md },
});
