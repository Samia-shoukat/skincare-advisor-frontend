/**
 * Skin type. FR-ONB-006.
 *
 * The questions come from `/v1/content/questionnaire` and the raw answers go
 * back to the server, which scores them. This screen never computes a skin
 * type, and the payload it receives contains no scoring weights — a client that
 * could see them could work backwards from a desired type to the answers that
 * produce it, and the entire routine is built on that value.
 *
 * One question per page rather than a long scroll. Six questions about your own
 * skin are easy to answer and easy to answer carelessly; showing one at a time
 * costs nothing and measurably improves the answers.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Body, Button, FormScreen, Heading } from '../../components/ui';
import { StepDots } from '../../components/StepDots';
import { ApiError, Questionnaire, api } from '../../lib/api';
import { color, radius, space, type } from '../../lib/theme';

export function SkinTypeScreen({
  token,
  onDone,
}: {
  token: string;
  onDone: () => Promise<void>;
}) {
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getQuestionnaire()
      .then(setQuestionnaire)
      .catch(() => setError('Could not load the questions. Check your connection.'));
  }, []);

  const question = questionnaire?.questions[index] ?? null;
  const isLast = questionnaire ? index === questionnaire.questions.length - 1 : false;
  const answered = question ? answers[question.id] !== undefined : false;

  const allAnswered = useMemo(
    () => questionnaire?.questions.every((q) => answers[q.id] !== undefined) ?? false,
    [questionnaire, answers],
  );

  async function submit() {
    if (!allAnswered) return;
    setBusy(true);
    setError(null);
    try {
      await api.setSkinType(token, answers);
      await onDone();
    } catch (e) {
      // A 422 here almost always means this client is running against a newer
      // questionnaire version, so retrying the same answers would fail again.
      setError(e instanceof ApiError ? e.message : 'Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!questionnaire || !question) {
    return (
      <FormScreen>
        <StepDots current={3} />
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
          <Button
            label={isLast ? 'See my skin type' : 'Next'}
            onPress={() => (isLast ? submit() : setIndex((i) => i + 1))}
            loading={busy}
            disabled={!answered}
          />
          {index > 0 ? (
            <Button
              label="Back"
              tone="ghost"
              onPress={() => setIndex((i) => i - 1)}
              disabled={busy}
            />
          ) : null}
        </>
      }
    >
      <StepDots current={3} />

      <Text style={styles.counter}>
        Question {index + 1} of {questionnaire.questions.length}
      </Text>
      <Heading>{question.prompt}</Heading>
      {index === 0 ? (
        <Body muted>
          Answer for how your skin usually behaves, not how it looks today.
        </Body>
      ) : null}

      <View style={styles.options}>
        {question.options.map((option) => {
          const selected = answers[question.id] === option.id;
          return (
            <Pressable
              key={option.id}
              onPress={() => {
                setAnswers((prev) => ({ ...prev, [question.id]: option.id }));
                setError(null);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.option,
                selected && styles.optionSelected,
                pressed && styles.optionPressed,
              ]}
            >
              <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  counter: { ...type.small, color: color.textFaint, marginBottom: space.sm },
  options: { marginTop: space.xl, gap: space.sm },
  option: {
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.surface,
  },
  optionSelected: { borderColor: color.brand, backgroundColor: color.surfaceRaised },
  optionPressed: { opacity: 0.75 },
  optionLabel: { ...type.body, color: color.textMuted },
  optionLabelSelected: { color: color.textOnDark },
  error: { ...type.small, color: color.danger, marginTop: space.md },
});