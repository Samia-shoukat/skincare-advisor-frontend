/**
 * Routine screen. FR-REC-001, FR-REC-005, FR-REC-007, FR-ONB-008, FR-SUB-005.
 *
 * Reads top to bottom as: what this routine is, the four care stages it covers,
 * what the scan noticed, then the steps themselves for one time of day at a
 * time.
 *
 * ## The disclaimer never scrolls away (FR-REC-007)
 *
 * "The statement remains visible or reachable at any scroll position." It sits
 * in the Screen footer, outside the ScrollView, so it is on screen whatever the
 * user has scrolled to. The Log routine button shares that footer; the
 * disclaimer sits below it, so the action can never push it off.
 *
 * ## No identifiers on screen
 *
 * Concerns and skin types are shown through the server's label maps
 * ("Breakouts", "Combination"), never as the raw enum value. "ACNE" on a
 * routine screen reads as a diagnosis, and it is on the DR-008 condition-name
 * list. Same for the "why this step" lines: they are server copy (IF-UI-001),
 * not strings baked into this component.
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  CareOverview,
  GlassCard,
  PillButton,
  SectionHeader,
  StatusPill,
} from '../components/glass';
import { Screen, SegmentedControl } from '../components/navigation';
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
  /** Ticks off every step for the selected time of day. Absent when unsupported. */
  onLogRoutine?: (when: 'am' | 'pm') => void;
  /** Tab bar wiring, so the routine reads as a tab rather than a dead end. */
  shell?: {
    tabs: React.ComponentProps<typeof Screen>['tabs'];
    activeTab: React.ComponentProps<typeof Screen>['activeTab'];
    onTabPress: React.ComponentProps<typeof Screen>['onTabPress'];
  };
}

export function RoutineScreen({
  routine,
  copy,
  skinType,
  offline,
  onLogRoutine,
  shell,
}: Props) {
  const c = copy.routineScreen;
  const nav = copy.nav;
  // One time of day at a time. The whole routine in a single scroll was the
  // thing that read as a wall of text.
  const [when, setWhen] = useState<'am' | 'pm'>('am');

  const steps = when === 'am' ? routine.am : routine.pm;
  const stepCount = routine.am.length + routine.pm.length;

  // Which of the four stages this routine actually covers. A stage that is
  // absent is dimmed rather than dropped -- see the note in CareOverview.
  const present = new Set([...routine.am, ...routine.pm].map((s) => s.step));
  const careItems = [
    { glyph: '🧼', label: nav.cleanse, key: 'CLEANSE' as const },
    { glyph: '✨', label: nav.treat, key: 'TREAT' as const },
    { glyph: '🌿', label: nav.moisturise, key: 'MOISTURISE' as const },
    { glyph: '☀️', label: nav.protect, key: 'PROTECT' as const },
  ].map((item) => ({
    glyph: item.glyph,
    label: item.label,
    // The caption is the first matching step's server label, so this row says
    // what the routine actually does rather than describing the stage in the
    // app's own words.
    caption:
      [...routine.am, ...routine.pm].find((s) => s.step === item.key)?.label ?? '',
    present: present.has(item.key),
  }));

  return (
    <Screen
      title={c.heading}
      // FR-REC-007: the disclaimer lives outside the scroll view, so it stays
      // on screen at any scroll position.
      footer={
        <>
          {onLogRoutine ? (
            <PillButton label={nav.logRoutine} onPress={() => onLogRoutine(when)} />
          ) : null}
          <Text style={styles.disclaimer}>{copy.routineDisclaimer}</Text>
        </>
      }
      {...(shell ?? {})}
    >
      {offline ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{c.offline}</Text>
        </View>
      ) : null}

      {/* ---- Hero --------------------------------------------------------- */}
      <GlassCard tone="strong" style={styles.hero}>
        <View style={styles.heroRow}>
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>{c.heading}</Text>
            <View style={styles.heroMeta}>
              {skinType && c.skinTypeLabels[skinType] ? (
                <StatusPill label={c.skinTypeLabels[skinType]} />
              ) : null}
              <StatusPill label={`${stepCount} · ${c.stepsLabel}`} tone="neutral" />
            </View>
          </View>
          <Text style={styles.heroGlyph}>🧴</Text>
        </View>
      </GlassCard>

      {/* ---- Care overview ------------------------------------------------ */}
      <View style={styles.block}>
        <SectionHeader title={nav.careOverview} />
        <GlassCard>
          <CareOverview items={careItems} />
        </GlassCard>
      </View>

      {/* ---- Skin vitals --------------------------------------------------
          Levels the analysis reported, not measurements. There is no hydration
          or barrier number anywhere in this system, so none is shown. */}
      {routine.concerns.length ? (
        <View style={styles.block}>
          <SectionHeader title={c.vitalsHeading} />
          <GlassCard>
            {c.vitalsCaption ? (
              <Text style={styles.vitalsCaption}>{c.vitalsCaption}</Text>
            ) : null}
            {routine.concerns.map((entry) => (
              <SeverityMeter
                key={entry.concernId}
                label={c.concernLabels[entry.concernId] ?? entry.concernId}
                severity={entry.severity}
                caption={c.severityLabels[entry.severity]}
              />
            ))}
          </GlassCard>
        </View>
      ) : null}

      {/* ---- Steps -------------------------------------------------------- */}
      <View style={styles.toggle}>
        <SegmentedControl
          options={[
            { key: 'am' as const, label: `☀️  ${c.morning}` },
            { key: 'pm' as const, label: `🌙  ${c.evening}` },
          ]}
          value={when}
          onChange={setWhen}
        />
      </View>

      {steps.length > 0 ? (
        <View style={styles.section}>
          {steps.map((step, index) => (
            <StepCard
              key={`${step.ruleId}-${index}`}
              step={step}
              number={index + 1}
              copy={copy}
            />
          ))}
        </View>
      ) : null}

      {routine.omitted.length > 0 ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{c.omitted}</Text>
        </View>
      ) : null}

      {/* FR-ONB-008. Unsubstantiated wording unless a signed review exists. */}
      <Text style={styles.claim}>{copy.reviewClaim}</Text>
    </Screen>
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
    <GlassCard>
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
        {frequency ? <StatusPill label={frequency} tone="neutral" /> : null}
        {concerns.map((label) => (
          <StatusPill key={label} label={label} />
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
    </GlassCard>
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
  // --- hero ---
  hero: { marginTop: 4 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroText: { flex: 1 },
  heroTitle: { ...type.display, fontSize: 22, lineHeight: 29, color: color.text, marginBottom: 9 },
  heroMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  heroGlyph: { fontSize: 42 },

  block: { marginTop: 26 },
  vitalsCaption: { ...type.small, fontSize: 12.5, lineHeight: 17, color: color.textMuted, marginBottom: 8 },

  // --- sections and step cards ---
  toggle: { marginTop: 22 },
  section: { marginTop: 12, gap: 12 },
  cardHead: { flexDirection: 'row', gap: 13 },
  cardHeadText: { flex: 1 },
  stepNumber: {
    ...type.bodyStrong,
    fontSize: 14,
    color: color.onPrimary,
    backgroundColor: color.primary,
    width: 26,
    height: 26,
    borderRadius: 13,
    textAlign: 'center',
    lineHeight: 26,
    overflow: 'hidden',
  },
  stepTitle: { ...type.bodyStrong, fontSize: 15, lineHeight: 20, color: color.text },
  purpose: { ...type.small, fontSize: 12.5, lineHeight: 17, color: color.textMuted, marginTop: 2 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },

  // --- product options ---
  options: { marginTop: 8, gap: 8 },
  option: {
    backgroundColor: color.surface,
    borderRadius: 15,
    padding: 12,
  },
  optionHighlight: { backgroundColor: color.primarySoft },
  tier: { ...type.small, fontSize: 11, lineHeight: 15, color: color.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  tierHighlight: { color: color.primary },
  productName: { ...type.body, fontSize: 14, lineHeight: 19, color: color.text, marginTop: 2 },
  brand: { ...type.bodyStrong, fontSize: 14, color: color.text },
  genericRow: { paddingHorizontal: 12, paddingTop: 4 },
  genericLabel: {
    ...type.small,
    fontSize: 11,
    lineHeight: 15,
    color: color.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  generic: { ...type.small, fontSize: 12.5, lineHeight: 17, color: color.textMuted, marginTop: 2 },

  // --- notices ---
  notice: {
    backgroundColor: color.attentionSoft,
    borderLeftWidth: 3,
    borderLeftColor: color.attention,
    borderRadius: radius.field,
    padding: space.md,
    marginTop: 20,
  },
  noticeText: { ...type.body, fontSize: 15, lineHeight: 22, color: color.text },
  claim: { ...type.small, fontSize: 11.5, lineHeight: 16, color: color.textFaint, marginTop: 26, textAlign: 'center' },
  disclaimer: { ...type.small, fontSize: 11.5, lineHeight: 17, color: color.textMuted, textAlign: 'center' },
});
