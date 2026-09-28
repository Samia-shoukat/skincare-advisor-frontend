/**
 * Routine screen. FR-REC-001, FR-REC-005, FR-REC-007, FR-ONB-008, FR-SUB-005.
 *
 * Three parts, in the order someone actually reads them:
 *
 *   1. Skin profile   -- skin type and what the scan noticed
 *   2. Morning/Evening -- numbered steps, each with why it is there
 *   3. Per step        -- an affordable product, a premium one, and the
 *                         pharmacy wording for when neither is stocked
 *
 * ## The disclaimer never scrolls away (FR-REC-007)
 *
 * "The statement remains visible or reachable at any scroll position." It sits
 * in the FormScreen footer, outside the ScrollView, so it is on screen
 * whatever the user has scrolled to.
 *
 * ## No identifiers on screen
 *
 * Concerns and skin types are shown through the server's label maps
 * ("Breakouts", "Combination"), never as the raw enum value. "ACNE" on a
 * routine screen reads as a diagnosis, and it is on the DR-008 condition-name
 * list. Same for the "why this step" lines: they are server copy (IF-UI-001),
 * not strings baked into this component.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Body, Button, FormScreen, Heading } from '../components/ui';
import { SeverityMeter } from '../components/premium';
import type { ProductOption, Routine, RoutineStep, StringsBundle } from '../lib/api';
import { color, radius, space, type } from '../lib/theme';

/** Purely decorative. The meaning of each step comes from the server copy. */
const STEP_ICON: Record<RoutineStep['step'], string> = {
  CLEANSE: '🧼',
  TREAT: '✨',
  MOISTURISE: '🌿',
  PROTECT: '☀️',
};

interface Props {
  routine: Routine;
  copy: StringsBundle;
  /** Skin type from the profile, shown on the dashboard card. */
  skinType?: string | null;
  /** Shown when the routine came from the offline cache. */
  offline?: boolean;
  onDone?: () => void;
  onAccount?: () => void;
  onSignOut?: () => void;
}

export function RoutineScreen({
  routine,
  copy,
  skinType,
  offline,
  onDone,
  onAccount,
  onSignOut,
}: Props) {
  const c = copy.routineScreen;

  // Every concern the routine addresses, in the order the steps address them,
  // without repeats — one concern can be served by two steps.
  const concerns = Array.from(
    new Set([...routine.am, ...routine.pm].flatMap((s) => s.concerns)),
  )
    .map((id) => c.concernLabels[id])
    .filter(Boolean);

  const stepCount = routine.am.length + routine.pm.length;

  return (
    <FormScreen
      footer={
        <>
          {/* FR-REC-007: outside the scroll view, so always visible. */}
          <Text style={styles.disclaimer}>{copy.routineDisclaimer}</Text>
          {onDone ? <Button label="Try again" tone="outline" onPress={onDone} /> : null}
          {onAccount ? (
            <Button label={copy.account.heading} tone="outline" onPress={onAccount} />
          ) : null}
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

      {/* ---- Skin profile ------------------------------------------------ */}
      <View style={styles.profile}>
        <Text style={styles.profileHeading}>{c.profileHeading}</Text>

        <View style={styles.profileRow}>
          <Text style={styles.profileLabel}>{c.skinTypeLabel}</Text>
          <Text style={styles.profileValue}>
            {(skinType && c.skinTypeLabels[skinType]) || '—'}
          </Text>
        </View>

        <View style={styles.profileRow}>
          <Text style={styles.profileLabel}>{c.stepsLabel}</Text>
          <Text style={styles.profileValue}>{stepCount}</Text>
        </View>
      </View>

      {/* ---- Skin vitals -------------------------------------------------
          Levels the analysis reported, not measurements. There is no hydration
          or barrier number anywhere in this system, so none is shown. */}
      {routine.concerns.length ? (
        <View style={styles.vitals}>
          <Text style={styles.profileHeading}>{c.vitalsHeading}</Text>
          <Text style={styles.vitalsCaption}>{c.vitalsCaption}</Text>
          {routine.concerns.map((entry) => (
            <SeverityMeter
              key={entry.concernId}
              label={c.concernLabels[entry.concernId] ?? entry.concernId}
              severity={entry.severity}
              caption={c.severityLabels[entry.severity]}
            />
          ))}
        </View>
      ) : concerns.length ? (
        <View style={styles.profileBlock}>
          <Text style={styles.profileLabel}>{c.concernsLabel}</Text>
          <View style={styles.chips}>
            {concerns.map((label) => (
              <Text key={label} style={styles.chip}>
                {label}
              </Text>
            ))}
          </View>
        </View>
      ) : null}

      <Body muted>{c.startSlowly}</Body>

      <Section icon="☀️" title={c.morning} steps={routine.am} copy={copy} />
      <Section icon="🌙" title={c.evening} steps={routine.pm} copy={copy} />

      {routine.omitted.length > 0 ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{c.omitted}</Text>
        </View>
      ) : null}

      {/* FR-ONB-008. Unsubstantiated wording unless a signed review exists. */}
      <Text style={styles.claim}>{copy.reviewClaim}</Text>
    </FormScreen>
  );
}

function Section({
  icon,
  title,
  steps,
  copy,
}: {
  icon: string;
  title: string;
  steps: RoutineStep[];
  copy: StringsBundle;
}) {
  if (steps.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {icon}  {title}
      </Text>
      {steps.map((step, index) => (
        <StepCard key={`${step.ruleId}-${index}`} step={step} number={index + 1} copy={copy} />
      ))}
    </View>
  );
}

function StepCard({
  step,
  number,
  copy,
}: {
  step: RoutineStep;
  number: number;
  copy: StringsBundle;
}) {
  const c = copy.routineScreen;
  const purpose = c.ingredientPurpose[step.ingredient];
  const frequency = c.frequencyLabels[step.frequency];
  const concerns = step.concerns.map((id) => c.concernLabels[id]).filter(Boolean);

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.stepNumber}>{number}</Text>
        <View style={styles.cardHeadText}>
          <Text style={styles.stepTitle}>
            {STEP_ICON[step.step]}  {step.label}
            {step.maxPercent != null ? ` · up to ${step.maxPercent}%` : ''}
          </Text>
          {purpose ? <Text style={styles.purpose}>{purpose}</Text> : null}
        </View>
      </View>

      <View style={styles.metaRow}>
        {frequency ? <Text style={styles.metaPill}>{frequency}</Text> : null}
        {concerns.map((label) => (
          <Text key={label} style={styles.metaPillSoft}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.options}>
        {step.products.budget ? (
          <Option tier={c.affordable} product={step.products.budget} />
        ) : null}
        {step.products.premium ? (
          <Option tier={c.premiumTier} product={step.products.premium} highlight />
        ) : null}
        <View style={styles.genericRow}>
          <Text style={styles.genericLabel}>{c.pharmacy}</Text>
          <Text style={styles.generic}>{step.products.generic}</Text>
        </View>
      </View>
    </View>
  );
}

function Option({
  tier,
  product,
  highlight,
}: {
  tier: string;
  product: ProductOption;
  highlight?: boolean;
}) {
  return (
    <View style={[styles.option, highlight && styles.optionHighlight]}>
      <Text style={[styles.tier, highlight && styles.tierHighlight]}>{tier}</Text>
      <Text style={styles.productName}>
        <Text style={styles.brand}>{product.brand}</Text> {product.name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // --- profile card ---
  profile: {
    backgroundColor: color.surface,
    borderRadius: radius.card,
    padding: space.lg,
    marginTop: space.lg,
    marginBottom: space.md,
    gap: space.sm,
    borderWidth: 1,
    borderColor: color.line,
  },
  profileHeading: { ...type.title, color: color.text, marginBottom: space.xs },
  vitals: {
    backgroundColor: color.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.line,
    padding: space.lg,
    marginBottom: space.md,
  },
  vitalsCaption: { ...type.small, color: color.textMuted },
  profileRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  profileBlock: { gap: space.xs },
  profileLabel: { ...type.small, color: color.textMuted },
  profileValue: { ...type.bodyStrong, color: color.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs },
  chip: {
    ...type.small,
    color: color.primary,
    backgroundColor: color.primarySoft,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: space.sm,
    overflow: 'hidden',
  },

  // --- sections and step cards ---
  section: { marginTop: space.xl, gap: space.md },
  sectionTitle: { ...type.title, color: color.text },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.card,
    padding: space.lg,
    borderWidth: 1,
    borderColor: color.line,
  },
  cardHead: { flexDirection: 'row', gap: space.md },
  cardHeadText: { flex: 1, gap: 2 },
  stepNumber: {
    ...type.bodyStrong,
    color: color.onPrimary,
    backgroundColor: color.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    textAlign: 'center',
    lineHeight: 28,
    overflow: 'hidden',
  },
  stepTitle: { ...type.bodyStrong, color: color.text },
  purpose: { ...type.small, color: color.textMuted },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.md },
  metaPill: {
    ...type.small,
    color: color.text,
    backgroundColor: color.surfaceRaised,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: space.sm,
    overflow: 'hidden',
  },
  metaPillSoft: {
    ...type.small,
    color: color.textMuted,
    borderColor: color.line,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: space.sm,
    overflow: 'hidden',
  },

  // --- product options ---
  options: { marginTop: space.md, gap: space.sm },
  option: {
    backgroundColor: color.surfaceRaised,
    borderRadius: radius.field,
    padding: space.md,
    gap: 2,
  },
  optionHighlight: { backgroundColor: color.primarySoft },
  tier: { ...type.small, color: color.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  tierHighlight: { color: color.primary },
  productName: { ...type.body, color: color.text },
  brand: { ...type.bodyStrong, color: color.text },
  genericRow: { paddingHorizontal: space.md, paddingTop: space.xs, gap: 2 },
  genericLabel: {
    ...type.small,
    color: color.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  generic: { ...type.small, color: color.textMuted },

  // --- notices ---
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
