/**
 * Date of birth. FR-ONB-002, FR-ONB-003, FR-ONB-004.
 *
 * Two things about this screen are requirements, not preferences, and both are
 * easy to undo by accident:
 *
 * **It never states a minimum age.** No "you must be 13 or over", no hint text,
 * no error message naming a number. FR-ONB-003's acceptance criteria say so
 * directly, and the reason is that a user told the threshold simply enters a
 * date that clears it. The temptation to add a helpful line here is strong;
 * resist it.
 *
 * **Confirmation is a separate step.** The value becomes permanent, so the user
 * sees the age it implies and confirms before it is sent. FR-ONB-002 requires
 * this, and it is the only chance to catch a mistyped year.
 *
 * Three numeric fields rather than a picker. A date of birth is a fact the user
 * already knows; typing it takes seconds, while scrolling a picker back thirty
 * years does not.
 */

import React, { useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Body, Button, FormScreen, Heading } from '../../components/ui';
import { StepDots } from '../../components/StepDots';
import { ApiError, api } from '../../lib/api';
import { color, radius, space, type } from '../../lib/theme';
import { useBackHandler } from '../../lib/useBackHandler';

function computeAge(dob: Date, today: Date): number {
  let age = today.getFullYear() - dob.getFullYear();
  const beforeBirthday =
    today.getMonth() < dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate());
  return beforeBirthday ? age - 1 : age;
}

/** Rejects 31 February and similar, which a range check alone would let through. */
function toDate(day: string, month: string, year: string): Date | null {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (!d || !m || !y || year.length !== 4) return null;

  const date = new Date(y, m - 1, d);
  const roundTrips =
    date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  return roundTrips ? date : null;
}

export function DateOfBirthScreen({
  token,
  onDone,
}: {
  token: string;
  onDone: () => Promise<void>;
}) {
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Android back on the confirmation step returns to editing, like "Go back
  // and edit" (FR-ONB-002). On the entry step it leaves the app as normal.
  useBackHandler(
    confirming
      ? () => {
          setConfirming(false);
          return true;
        }
      : null,
  );

  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);

  const parsed = useMemo(() => toDate(day, month, year), [day, month, year]);

  function review() {
    if (!parsed) {
      setError('Enter a real date.');
      return;
    }
    if (parsed > new Date()) {
      setError("That date hasn't happened yet.");
      return;
    }
    setError(null);
    setConfirming(true);
  }

  async function submit() {
    if (!parsed) return;
    setBusy(true);
    setError(null);
    try {
      const iso = [
        parsed.getFullYear(),
        String(parsed.getMonth() + 1).padStart(2, '0'),
        String(parsed.getDate()).padStart(2, '0'),
      ].join('-');

      // The server decides the age band and whether scan access is withdrawn.
      // An under-age date returns 200 here, not an error — the restriction is
      // applied silently and surfaces on the next screen.
      await api.setDateOfBirth(token, iso);
      await onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save. Try again.');
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  if (confirming && parsed) {
    const age = computeAge(parsed, new Date());
    return (
      <FormScreen
        footer={
          <>
            <Button label="Yes, that's right" onPress={submit} loading={busy} />
            <Button
              label="Change it"
              tone="ghost"
              onPress={() => setConfirming(false)}
              disabled={busy}
            />
          </>
        }
      >
        <StepDots current={1} />
        <Heading>You're {age}</Heading>
        <Body muted>
          Based on {parsed.toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
          . You won't be able to change this later, so please check it.
        </Body>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </FormScreen>
    );
  }

  return (
    <FormScreen
      footer={<Button label="Continue" onPress={review} disabled={!parsed} />}
    >
      <StepDots current={1} />
      <Heading>When were you born?</Heading>
      <Body muted>
        Some ingredients aren't suitable for every age, so your routine depends
        on this.
      </Body>

      <View style={styles.row}>
        <View style={styles.cell}>
          <Text style={styles.label}>Day</Text>
          <TextInput
            style={styles.input}
            value={day}
            onChangeText={(v) => {
              const digits = v.replace(/\D/g, '').slice(0, 2);
              setDay(digits);
              setError(null);
              if (digits.length === 2) monthRef.current?.focus();
            }}
            placeholder="DD"
            placeholderTextColor={color.textFaint}
            keyboardType="number-pad"
            maxLength={2}
            accessibilityLabel="Day of birth"
          />
        </View>

        <View style={styles.cell}>
          <Text style={styles.label}>Month</Text>
          <TextInput
            ref={monthRef}
            style={styles.input}
            value={month}
            onChangeText={(v) => {
              const digits = v.replace(/\D/g, '').slice(0, 2);
              setMonth(digits);
              setError(null);
              if (digits.length === 2) yearRef.current?.focus();
            }}
            placeholder="MM"
            placeholderTextColor={color.textFaint}
            keyboardType="number-pad"
            maxLength={2}
            accessibilityLabel="Month of birth"
          />
        </View>

        <View style={[styles.cell, styles.cellWide]}>
          <Text style={styles.label}>Year</Text>
          <TextInput
            ref={yearRef}
            style={styles.input}
            value={year}
            onChangeText={(v) => {
              setYear(v.replace(/\D/g, '').slice(0, 4));
              setError(null);
            }}
            placeholder="YYYY"
            placeholderTextColor={color.textFaint}
            keyboardType="number-pad"
            maxLength={4}
            accessibilityLabel="Year of birth"
          />
        </View>
      </View>

      {/* No hint about an acceptable range. FR-ONB-003. */}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md, marginTop: space.xl },
  cell: { flex: 1 },
  cellWide: { flex: 1.6 },
  label: { ...type.small, color: color.textMuted, marginBottom: space.sm },
  input: {
    ...type.body,
    color: color.textOnDark,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.field,
    paddingHorizontal: space.md,
    minHeight: 54,
    textAlign: 'center',
  },
  error: { ...type.small, color: color.danger, marginTop: space.md },
});