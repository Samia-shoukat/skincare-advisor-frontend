/**
 * Routine screen. FR-REC-001, FR-REC-005, FR-REC-007, FR-ONB-008, FR-SUB-005.
 *
 * Morning and evening steps, each with a budget product, a premium product,
 * and the generic pharmacy option. A tier the catalogue could not safely fill
 * is simply not shown; the generic option always is.
 *
 * ## The disclaimer never scrolls away (FR-REC-007)
 *
 * "The statement remains visible or reachable at any scroll position." It sits
 * in the FormScreen footer, which is outside the ScrollView, so it is on screen
 * whatever the user has scrolled to.
 *
 * ## No concern identifiers
 *
 * Steps list the concerns they address by their display labels from the
 * server ("Breakouts"), never by identifier ("ACNE"). An identifier on this
 * screen reads as a diagnosis.
 *
 * All copy comes from the server string bundle (IF-UI-001).
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Body, Button, Card, FormScreen, Heading } from '../components/ui';
import type { Routine, RoutineStep, StringsBundle } from '../lib/api';
import { color, radius, space, type } from '../lib/theme';

interface Props {
  routine: Routine;
  copy: StringsBundle;
  /** Shown when the routine came from the offline cache. */
  offline?: boolean;
  onDone?: () => void;
  onSignOut?: () => void;
}

export function RoutineScreen({ routine, copy, offline, onDone, onSignOut }: Props) {
  const c = copy.routineScreen;

  return (
    <FormScreen
      footer={
        <>
          {/* FR-REC-007: outside the scroll view, so always visible. */}
          <Text style={styles.disclaimer}>{copy.routineDisclaimer}</Text>
          {onDone ? <Button label="Done" tone="outline" onPress={onDone} /> : null}
          {onSignOut ? <Button label="Sign out" tone="outline" onPress={onSignOut} /> : null}
        </>
      }
    >
      <Heading>{c.heading}</Heading>
      {offline ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{c.offline}</Text>
        </View>
      ) : null}

      <Body muted>{c.startSlowly}</Body>

      <Section title={c.morning} steps={routine.am} copy={copy} />
      <Section title={c.evening} steps={routine.pm} copy={copy} />

      {routine.omitted.length > 0 ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{c.omitted}</Text>
        </View>
      ) : null}

      {/* FR-ONB-008. The server returns the unsubstantiated wording unless a
          signed review record exists for this matrix version. */}
      <Text style={styles.claim}>{copy.reviewClaim}</Text>
    </FormScreen>
  );
}

function Section({ title, steps, copy }: { title: string; steps: RoutineStep[]; copy: StringsBundle }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {steps.map((step, index) => (
        <StepCard key={`${step.ruleId}-${index}`} step={step} number={index + 1} copy={copy} />
      ))}
    </View>
  );
}

function StepCard({ step, number, copy }: { step: RoutineStep; number: number; copy: StringsBundle }) {
  const c = copy.routineScreen;
  const concerns = step.concerns.map((id) => c.concernLabels[id] ?? '').filter(Boolean);
  const frequency = c.frequencyLabels[step.frequency] ?? '';

  return (
    <Card>
      <Text style={styles.stepTitle}>
        {number}. {step.label}
        {step.maxPercent != null ? ` (${step.maxPercent}% or lower)` : ''}
      </Text>
      <Text style={styles.meta}>
        {frequency}
        {concerns.length ? ` · ${c.for}: ${concerns.join(', ')}` : ''}
      </Text>

      <View style={styles.options}>
        {step.products.budget ? (
          <Option tier={c.budget} brand={step.products.budget.brand} name={step.products.budget.name} />
        ) : null}
        {step.products.premium ? (
          <Option tier={c.premium} brand={step.products.premium.brand} name={step.products.premium.name} />
        ) : null}
        <Text style={styles.generic}>{step.products.generic}</Text>
      </View>
    </Card>
  );
}

function Option({ tier, brand, name }: { tier: string; brand: string; name: string }) {
  return (
    <View style={styles.option}>
      <Text style={styles.tier}>{tier}</Text>
      <Text style={styles.product}>
        {brand} {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.lg, gap: space.sm },
  sectionTitle: { ...type.title, color: color.text },
  stepTitle: { ...type.bodyStrong, color: color.text },
  meta: { ...type.small, color: color.textMuted, marginTop: space.xs },
  options: { marginTop: space.md, gap: space.sm },
  option: { flexDirection: 'row', gap: space.sm, alignItems: 'baseline' },
  tier: {
    ...type.small,
    color: color.primary,
    backgroundColor: color.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    overflow: 'hidden',
  },
  product: { ...type.body, color: color.text, flexShrink: 1 },
  generic: { ...type.small, color: color.textMuted },
  notice: {
    backgroundColor: color.attentionSoft,
    borderLeftWidth: 3,
    borderLeftColor: color.attention,
    borderRadius: radius.field,
    padding: space.md,
    marginTop: space.lg,
  },
  noticeText: { ...type.body, color: color.text },
  claim: { ...type.small, color: color.textFaint, marginTop: space.xl },
  disclaimer: { ...type.small, color: color.textMuted, textAlign: 'center' },
});
