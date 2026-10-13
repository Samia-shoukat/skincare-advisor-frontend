/**
 * Sensitive skin and fragrance allergy.
 *
 * Asked once, after onboarding. Optional: the server never gates a scan on
 * these (onboardingComplete does not depend on them), so "Not now" is a real
 * choice, remembered per account on this phone. The answers change which
 * PRODUCT the server suggests for a step -- a fragrance allergy rules out
 * fragranced and unknown-fragrance products -- never the step itself.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Body, Button, FormScreen, Heading } from '../../components/ui';
import { ApiError, api } from '../../lib/api';
import { color, radius, space, type } from '../../lib/theme';

const skipKey = (userId: string) => `sensitivities:skipped:v1:${userId}`;

/** Whether this account chose "Not now" on this phone. Storage failing reads as "not skipped". */
export async function sensitivitiesSkipped(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(skipKey(userId))) === '1';
  } catch {
    return false;
  }
}

const QUESTIONS = [
  {
    field: 'sensitiveSkin' as const,
    text: 'Does your skin react easily — stinging, redness or itching from new products?',
  },
  {
    field: 'fragranceAllergy' as const,
    text: 'Are you allergic to fragrance or perfume in skincare?',
  },
];

type Answers = { sensitiveSkin?: boolean; fragranceAllergy?: boolean };

export function SensitivitiesScreen({
  token,
  userId,
  onDone,
  onSkip,
}: {
  token: string;
  userId: string;
  onDone: () => Promise<void>;
  onSkip: () => void;
}) {
  const [answers, setAnswers] = useState<Answers>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const complete = answers.sensitiveSkin !== undefined && answers.fragranceAllergy !== undefined;

  async function submit() {
    if (!complete) return;
    setBusy(true);
    setError(null);
    try {
      await api.setSensitivities(token, {
        sensitiveSkin: answers.sensitiveSkin!,
        fragranceAllergy: answers.fragranceAllergy!,
      });
      await onDone(); // re-fetches the session: needsSensitivities is now false
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function skip() {
    try {
      await AsyncStorage.setItem(skipKey(userId), '1');
    } catch {
      // Not remembered; they may be asked again next launch. Harmless.
    }
    onSkip();
  }

  return (
    <FormScreen
      footer={
        <>
          <Button label="Save" onPress={submit} loading={busy} disabled={!complete} />
          <Button label="Not now" tone="ghost" onPress={skip} disabled={busy} />
        </>
      }
    >
      <Heading>Two quick questions</Heading>
      <Body muted>
        These help us suggest products that suit your skin. You can change them
        any time in your profile.
      </Body>

      <View style={styles.list}>
        {QUESTIONS.map((question) => (
          <View key={question.field} style={styles.item}>
            <Text style={styles.prompt}>{question.text}</Text>
            <View style={styles.choices}>
              {[
                { label: 'No', value: false },
                { label: 'Yes', value: true },
              ].map((choice) => {
                const selected = answers[question.field] === choice.value;
                return (
                  <Pressable
                    key={choice.label}
                    onPress={() => {
                      setAnswers((prev) => ({ ...prev, [question.field]: choice.value }));
                      setError(null);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${question.text} ${choice.label}`}
                    style={({ pressed }) => [
                      styles.choice,
                      selected && styles.choiceSelected,
                      pressed && styles.choicePressed,
                    ]}
                  >
                    <Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>
                      {choice.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: space.xl, gap: space.lg },
  item: { backgroundColor: color.surface, borderRadius: radius.field, padding: space.md },
  prompt: { ...type.body, color: color.text, marginBottom: space.md },
  choices: { flexDirection: 'row', gap: space.sm },
  choice: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.line,
  },
  choiceSelected: { backgroundColor: color.primary, borderColor: color.primary },
  choicePressed: { opacity: 0.7 },
  choiceLabel: { ...type.body, color: color.textMuted },
  // White on the violet button: the safety screen's dark label is hard to read.
  choiceLabelSelected: { color: color.onPrimary, fontWeight: '600' },
  error: { ...type.small, color: color.danger, marginTop: space.md },
});
