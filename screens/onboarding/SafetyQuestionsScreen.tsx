/**
 * Safety screening. FR-ONB-005.
 *
 * The four questions are fetched from `/v1/content/strings`, not written here.
 * IF-UI-001 requires it, and the practical reason is that these are the wording
 * a clinician signs off on — a copy pasted into a screen component would drift
 * from the reviewed text the first time someone tidied it.
 *
 * The server tells us which request field each question populates, so this
 * screen has no mapping of its own to fall out of date.
 *
 * All four must be answered. A partial submission would leave a profile that
 * looks screened but isn't, and two of these answers are the only thing
 * standing between a user with an open wound and a cosmetic routine.
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Body, Button, FormScreen, Heading } from '../../components/ui';
import { StepDots } from '../../components/StepDots';
import { ApiError, SafetyQuestion, api } from '../../lib/api';
import { color, radius, space, type } from '../../lib/theme';

type Answers = Record<string, boolean>;

export function SafetyQuestionsScreen({
  token,
  onDone,
}: {
  token: string;
  onDone: () => Promise<void>;
}) {
  const [questions, setQuestions] = useState<SafetyQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getStrings()
      .then((bundle) => setQuestions(bundle.safetyQuestions))
      .catch(() => setError('Could not load the questions. Check your connection.'));
  }, []);

  const allAnswered =
    questions !== null && questions.every((q) => answers[q.field] !== undefined);

  async function submit() {
    if (!questions || !allAnswered) return;
    setBusy(true);
    setError(null);
    try {
      await api.setSafetyAnswers(token, {
        pregnantOrBreastfeeding: answers.pregnantOrBreastfeeding,
        prescriptionAcneTreatment: answers.prescriptionAcneTreatment,
        openWoundsOrChangingMole: answers.openWoundsOrChangingMole,
        diagnosedEczemaPsoriasisRosacea: answers.diagnosedEczemaPsoriasisRosacea,
      });
      await onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!questions) {
    return (
      <FormScreen>
        <StepDots current={2} />
        <View style={styles.loading}>
          {error ? (
            <Text style={styles.error}>{error}</Text>
          ) : (
            <ActivityIndicator color={color.brand} />
          )}
        </View>
      </FormScreen>
    );
  }

  return (
    <FormScreen
      footer={
        <>
          <Button label="Continue" onPress={submit} loading={busy} disabled={!allAnswered} />
          {!allAnswered ? (
            <Text style={styles.footnote}>Answer all four to continue.</Text>
          ) : null}
        </>
      }
    >
      <StepDots current={2} />
      <Heading>A few safety questions</Heading>
      <Body muted>
        Your answers decide which ingredients are safe to suggest — and whether
        we should send you to a doctor instead.
      </Body>

      <View style={styles.list}>
        {questions.map((question) => (
          <View key={question.id} style={styles.item}>
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
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { marginTop: space.xl, gap: space.lg },
  item: {
    backgroundColor: color.surface,
    borderRadius: radius.field,
    padding: space.md,
  },
  prompt: { ...type.body, color: color.textOnDark, marginBottom: space.md },
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
  choiceSelected: { backgroundColor: color.action, borderColor: color.action },
  choicePressed: { opacity: 0.7 },
  choiceLabel: { ...type.body, color: color.textMuted },
  choiceLabelSelected: { color: color.textOnDark },
  footnote: { ...type.small, color: color.textFaint, textAlign: 'center' },
  error: { ...type.small, color: color.danger, marginTop: space.md },
});