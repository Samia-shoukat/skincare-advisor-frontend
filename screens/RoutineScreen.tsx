/**
 * My Routine. FR-REC-001, FR-REC-005, FR-REC-007, FR-ONB-008, FR-SUB-005.
 *
 * Reads top to bottom as: what the scan noticed, then the morning routine,
 * then the evening routine. Reached from Home's "My Routine" CTA and from the
 * Routine tab.
 *
 * ## Morning and evening are both on the page
 *
 * They used to sit behind a Morning / Evening toggle. A toggle hides half the
 * routine and makes "what do I do tonight?" a two-tap question, so the two now
 * stack as separate sections -- and look it: morning is a light banner with a
 * sun, evening a plum one with a moon. The difference is brightness, not hue,
 * so it holds for someone who cannot tell the colours apart (IF-UI-003).
 *
 * "Mark done" lives on each banner. It used to be a footer button acting on
 * whichever half the toggle showed; with no toggle it needs to say which half.
 *
 * ## The disclaimer never scrolls away (FR-REC-007)
 *
 * "The statement remains visible or reachable at any scroll position." It sits
 * in the Screen footer, outside the ScrollView, so it is on screen whatever the
 * user has scrolled to.
 *
 * ## No identifiers on screen
 *
 * Concerns and skin types are shown through the server's label maps
 * ("Breakouts", "Combination"), never as the raw enum value. "ACNE" on a
 * routine screen reads as a diagnosis, and it is on the DR-008 condition-name
 * list. Same for the "why this step" lines: they are server copy (IF-UI-001),
 * not strings baked into this component.
 *
 * Severity is three marks, not a percentage -- see the note in
 * components/premium.tsx. The analysis reports a level; it measures nothing.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { GlassCard, SectionHeader, StatusPill } from '../components/glass';
import { CONCERN_ICON, Icon, IconName, STEP_ICON } from '../components/Icon';
import { Screen } from '../components/navigation';
import type { ProductOption, Routine, RoutineStep, StringsBundle } from '../lib/api';
import { color, radius, shadow, space, type } from '../lib/theme';

const LEVELS: Record<string, number> = { MILD: 1, MODERATE: 2, PRONOUNCED: 3 };

interface Props {
  routine: Routine;
  copy: StringsBundle;
  /** Skin type from the profile, shown in the summary row. */
  skinType?: string | null;
  /** Shown when the routine came from the offline cache. */
  offline?: boolean;
  /** Ticks off every step for one time of day. Absent when unsupported. */
  onLogRoutine?: (when: 'am' | 'pm') => void;
  /** Product ids the user has hearted. Absent hides the hearts. */
  favoriteIds?: Set<string>;
  onToggleFavorite?: (product: ProductOption, stepLabel: string) => void;
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
  favoriteIds,
  onToggleFavorite,
  shell,
}: Props) {
  const c = copy.routineScreen;
  const nav = copy.nav;
  const stepCount = routine.am.length + routine.pm.length;
  const favorites = favoriteIds && onToggleFavorite ? { ids: favoriteIds, toggle: onToggleFavorite } : null;

  return (
    <Screen
      title={nav.myRoutine}
      // FR-REC-007: the disclaimer lives outside the scroll view, so it stays
      // on screen at any scroll position.
      footer={<Text style={styles.disclaimer}>{copy.routineDisclaimer}</Text>}
      {...(shell ?? {})}
    >
      {offline ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{c.offline}</Text>
        </View>
      ) : null}

      <View style={styles.summary}>
        {skinType && c.skinTypeLabels[skinType] ? (
          <StatusPill label={`${c.skinTypeLabel}: ${c.skinTypeLabels[skinType]}`} />
        ) : null}
        <StatusPill label={`${stepCount} ${c.stepsLabel.toLowerCase()}`} tone="neutral" />
      </View>

      {/* ---- Detected skin issues -----------------------------------------
          Levels the analysis reported, not measurements. Routines made before
          concerns were recorded have none, and the section is left out. */}
      {routine.concerns.length ? (
        <View style={styles.block}>
          <SectionHeader title={nav.detectedIssues} />
          {c.vitalsCaption ? <Text style={styles.caption}>{c.vitalsCaption}</Text> : null}
          <View style={styles.chips}>
            {routine.concerns.map((entry) => (
              <IssueChip
                key={entry.concernId}
                icon={CONCERN_ICON[entry.concernId] ?? 'circle'}
                label={c.concernLabels[entry.concernId] ?? entry.concernId}
                level={LEVELS[entry.severity] ?? 0}
                severity={c.severityLabels[entry.severity] ?? ''}
              />
            ))}
          </View>
        </View>
      ) : null}

      {/* ---- Morning, then evening ---------------------------------------- */}
      {routine.am.length ? (
        <RoutineSection
          when="am"
          title={nav.morningRoutine}
          steps={routine.am}
          copy={copy}
          onMarkDone={onLogRoutine ? () => onLogRoutine('am') : undefined}
          favorites={favorites}
        />
      ) : null}
      {routine.pm.length ? (
        <RoutineSection
          when="pm"
          title={nav.eveningRoutine}
          steps={routine.pm}
          copy={copy}
          onMarkDone={onLogRoutine ? () => onLogRoutine('pm') : undefined}
          favorites={favorites}
        />
      ) : null}

      {routine.omitted.length > 0 && c.omitted ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{c.omitted}</Text>
        </View>
      ) : null}

      {/* FR-ONB-008. Unsubstantiated wording unless a signed review exists. */}
      <Text style={styles.claim}>{copy.reviewClaim}</Text>
    </Screen>
  );
}

// ---------------------------------------------------------------------------

function IssueChip({
  icon,
  label,
  level,
  severity,
}: {
  icon: IconName;
  label: string;
  level: number;
  severity: string;
}) {
  return (
    <View
      style={[styles.chip, shadow.card]}
      accessible
      accessibilityLabel={severity ? `${label}: ${severity}` : label}
    >
      <View style={styles.chipIcon}>
        <Icon name={icon} size={14} tint={color.primary} />
      </View>
      <View>
        <Text style={styles.chipLabel} numberOfLines={1}>
          {label}
        </Text>
        <View style={styles.chipLevelRow}>
          {[1, 2, 3].map((mark) => (
            <View key={mark} style={[styles.levelMark, mark <= level && styles.levelMarkOn]} />
          ))}
          {severity ? <Text style={styles.chipSeverity}>{severity}</Text> : null}
        </View>
      </View>
    </View>
  );
}

type Favorites = {
  ids: Set<string>;
  toggle: (product: ProductOption, stepLabel: string) => void;
} | null;

function RoutineSection({
  when,
  title,
  steps,
  copy,
  onMarkDone,
  favorites,
}: {
  when: 'am' | 'pm';
  title: string;
  steps: RoutineStep[];
  copy: StringsBundle;
  onMarkDone?: () => void;
  favorites: Favorites;
}) {
  const evening = when === 'pm';
  const ink = evening ? color.onPrimary : color.text;

  return (
    <View style={styles.block}>
      <LinearGradient
        colors={evening ? color.eveningGradient : color.morningGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.banner, !evening && styles.bannerMorning, shadow.card]}
      >
        <View style={[styles.bannerIcon, evening && styles.bannerIconEvening]}>
          <Icon name={evening ? 'moon' : 'sun'} size={20} tint={evening ? color.onPrimary : color.primary} />
        </View>
        {/* Title alone on the first line, so "Morning routine" never wraps
            on a 360dp phone; the action shares the shorter caption line. */}
        <View style={styles.bannerText}>
          <Text style={[styles.bannerTitle, { color: ink }]} accessibilityRole="header" numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.bannerMeta}>
            <Text style={[styles.bannerCaption, evening && styles.bannerCaptionEvening]}>
              {evening ? 'PM' : 'AM'} · {steps.length} {copy.routineScreen.stepsLabel.toLowerCase()}
            </Text>
            {onMarkDone ? (
              <Pressable
                onPress={onMarkDone}
                accessibilityRole="button"
                accessibilityLabel={`${copy.nav.markDone}: ${title}`}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.markDone,
                  evening && styles.markDoneEvening,
                  pressed && styles.pressed,
                ]}
              >
                <Icon name="check" size={13} tint={evening ? color.onPrimary : color.primary} />
                <Text style={[styles.markDoneLabel, evening && styles.markDoneLabelEvening]}>
                  {copy.nav.markDone}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </LinearGradient>

      <View style={styles.steps}>
        {steps.map((step, index) => (
          <StepCard
            key={`${step.ruleId}-${index}`}
            step={step}
            number={index + 1}
            evening={evening}
            copy={copy}
            favorites={favorites}
          />
        ))}
      </View>
    </View>
  );
}

const STAGE_LABEL = (copy: StringsBundle, step: RoutineStep['step']) =>
  ({
    CLEANSE: copy.nav.cleanse,
    TREAT: copy.nav.treat,
    MOISTURISE: copy.nav.moisturise,
    PROTECT: copy.nav.protect,
  })[step];

function StepCard({
  step,
  number,
  evening,
  copy,
  favorites,
}: {
  step: RoutineStep;
  number: number;
  evening: boolean;
  copy: StringsBundle;
  favorites: Favorites;
}) {
  const c = copy.routineScreen;
  const purpose = c.ingredientPurpose[step.ingredient];
  const frequency = c.frequencyLabels[step.frequency];
  const concerns = step.concerns.map((id) => c.concernLabels[id]).filter(Boolean);

  return (
    <GlassCard tone="strong">
      <View style={styles.cardHead}>
        <View style={[styles.stepBadge, evening && styles.stepBadgeEvening]}>
          <Icon name={STEP_ICON[step.step]} size={18} tint={evening ? color.onPrimary : color.primary} />
        </View>
        <View style={styles.cardHeadText}>
          <Text style={styles.stepEyebrow}>
            {`Step ${number} · ${STAGE_LABEL(copy, step.step)}`.toUpperCase()}
          </Text>
          <Text style={styles.stepTitle}>
            {step.label}
            {step.maxPercent != null ? (
              <Text style={styles.stepStrength}>{`  up to ${step.maxPercent}%`}</Text>
            ) : null}
          </Text>
          {purpose ? <Text style={styles.purpose}>{purpose}</Text> : null}
        </View>
      </View>

      {frequency || concerns.length ? (
        <View style={styles.metaRow}>
          {frequency ? <StatusPill label={frequency} tone="neutral" /> : null}
          {concerns.map((label) => (
            <StatusPill key={label} label={label} />
          ))}
        </View>
      ) : null}

      <View style={styles.products}>
        {step.products.budget ? (
          <ProductRow
            tier={c.affordable}
            product={step.products.budget}
            stepLabel={step.label}
            favorites={favorites}
          />
        ) : null}
        {step.products.premium ? (
          <ProductRow
            tier={c.premiumTier}
            product={step.products.premium}
            stepLabel={step.label}
            favorites={favorites}
            highlight
          />
        ) : null}
        <View style={styles.generic}>
          <Text style={styles.tier}>{c.pharmacy.toUpperCase()}</Text>
          <Text style={styles.genericText}>{step.products.generic}</Text>
        </View>
      </View>
    </GlassCard>
  );
}

function ProductRow({
  tier,
  product,
  stepLabel,
  favorites,
  highlight,
}: {
  tier: string;
  product: ProductOption;
  stepLabel: string;
  favorites: Favorites;
  highlight?: boolean;
}) {
  const saved = favorites?.ids.has(product.id) ?? false;
  return (
    <View style={[styles.product, highlight && styles.productHighlight]}>
      <View style={styles.productText}>
        <Text style={[styles.tier, highlight && styles.tierHighlight]}>{tier.toUpperCase()}</Text>
        <Text style={styles.productName}>
          <Text style={styles.brand}>{product.brand}</Text> {product.name}
        </Text>
      </View>
      {favorites ? (
        <Pressable
          onPress={() => favorites.toggle(product, stepLabel)}
          accessibilityRole="button"
          accessibilityState={{ selected: saved }}
          accessibilityLabel={`${saved ? 'Remove from' : 'Save to'} favorites: ${product.brand} ${product.name}`}
          hitSlop={10}
          style={[styles.heart, saved && styles.heartOn]}
        >
          <Icon name="heart" size={16} tint={saved ? color.onPrimary : color.textFaint} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  block: { marginTop: 26 },
  caption: { ...type.small, fontSize: 12.5, lineHeight: 17, color: color.textMuted, marginTop: -6, marginBottom: 12 },

  // --- detected issues ---
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: color.glassStrong,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: color.glassBorder,
    paddingVertical: 9,
    paddingLeft: 9,
    paddingRight: 14,
  },
  chipIcon: {
    width: 30,
    height: 30,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.primarySoft,
  },
  chipLabel: { ...type.bodyStrong, fontSize: 13.5, lineHeight: 18, color: color.text },
  chipLevelRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  levelMark: { width: 10, height: 4, borderRadius: 2, backgroundColor: color.line },
  levelMarkOn: { backgroundColor: color.primary },
  chipSeverity: { ...type.small, fontSize: 11, lineHeight: 14, color: color.textMuted, marginLeft: 4 },

  // --- section banners ---
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderRadius: 24,
    padding: 16,
  },
  bannerMorning: { borderWidth: 1, borderColor: color.glassBorder },
  bannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.primarySoft,
  },
  bannerIconEvening: { backgroundColor: 'rgba(255, 255, 255, 0.14)' },
  bannerText: { flex: 1 },
  bannerTitle: { ...type.title, fontSize: 18, lineHeight: 24 },
  bannerMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 },
  bannerCaption: { ...type.small, fontSize: 12, lineHeight: 16, letterSpacing: 0.4, color: color.textMuted },
  bannerCaptionEvening: { color: 'rgba(255, 255, 255, 0.72)' },
  markDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 11,
    backgroundColor: color.primarySoft,
  },
  markDoneEvening: { backgroundColor: 'rgba(255, 255, 255, 0.16)' },
  markDoneLabel: { ...type.small, fontSize: 12.5, lineHeight: 16, fontWeight: '600', color: color.primary },
  markDoneLabelEvening: { color: color.onPrimary },
  pressed: { opacity: 0.8 },

  // --- step cards ---
  steps: { marginTop: 12, gap: 12 },
  cardHead: { flexDirection: 'row', gap: 13 },
  cardHeadText: { flex: 1 },
  stepBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.primarySoft,
  },
  stepBadgeEvening: { backgroundColor: color.primaryDeep },
  stepEyebrow: { ...type.small, fontSize: 10.5, lineHeight: 14, letterSpacing: 1, fontWeight: '600', color: color.textFaint },
  stepTitle: { ...type.bodyStrong, fontSize: 16, lineHeight: 21, color: color.text, marginTop: 2 },
  stepStrength: { ...type.small, fontSize: 12.5, fontWeight: '400', color: color.textMuted },
  purpose: { ...type.small, fontSize: 12.5, lineHeight: 17, color: color.textMuted, marginTop: 3 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },

  // --- products ---
  products: { marginTop: 12, gap: 8 },
  product: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: color.surfaceRaised,
    borderRadius: 15,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  productHighlight: { backgroundColor: color.primarySoft },
  productText: { flex: 1 },
  tier: { ...type.small, fontSize: 10.5, lineHeight: 14, letterSpacing: 0.8, fontWeight: '600', color: color.textFaint },
  tierHighlight: { color: color.primary },
  productName: { ...type.body, fontSize: 14, lineHeight: 19, color: color.text, marginTop: 2 },
  brand: { ...type.bodyStrong, fontSize: 14, color: color.text },
  heart: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface,
  },
  heartOn: { backgroundColor: color.primary },
  generic: { paddingHorizontal: 12, paddingTop: 2 },
  genericText: { ...type.small, fontSize: 12.5, lineHeight: 17, color: color.textMuted, marginTop: 2 },

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
