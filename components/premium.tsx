/**
 * The premium surface kit: soft cards, severity meters, tiles, pills.
 *
 * Built on the existing tokens in lib/theme.ts rather than a second palette,
 * so a colour change still lands everywhere at once.
 *
 * ## On the severity meter
 *
 * It renders three segments, not a percentage. The analysis returns MILD,
 * MODERATE or PRONOUNCED (Appendix G) and measures nothing else -- no
 * hydration level, no barrier score, no oil percentage. A bar reading "62%"
 * would be invented, and an invented number on a skin app is a claim the
 * system cannot support. Three segments say exactly what was observed.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { color, radius, shadow, space, type } from '../lib/theme';

/** A soft raised panel. The base surface for everything below. */
export function SoftCard({
  children,
  tone = 'plain',
}: {
  children: React.ReactNode;
  tone?: 'plain' | 'accent';
}) {
  return (
    <View style={[styles.card, tone === 'accent' && styles.cardAccent, shadow.card]}>
      {children}
    </View>
  );
}

/** Small uppercase label above a group. */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

/** Rounded chip. `tone="solid"` for the one that matters most in a row. */
export function Pill({
  label,
  tone = 'soft',
}: {
  label: string;
  tone?: 'soft' | 'solid' | 'outline';
}) {
  return (
    <Text
      style={[
        styles.pill,
        tone === 'solid' && styles.pillSolid,
        tone === 'outline' && styles.pillOutline,
      ]}
    >
      {label}
    </Text>
  );
}

const LEVELS: Record<string, number> = { MILD: 1, MODERATE: 2, PRONOUNCED: 3 };

/**
 * Three-segment meter for one observed concern.
 *
 * `severity` is the Appendix G value. An unknown value fills nothing rather
 * than guessing a level.
 */
export function SeverityMeter({
  label,
  severity,
  caption,
}: {
  label: string;
  severity: string;
  caption?: string;
}) {
  const filled = LEVELS[severity] ?? 0;

  return (
    <View style={styles.meterRow}>
      <Text style={styles.meterLabel}>{label}</Text>
      <View style={styles.meterTrack} accessibilityLabel={`${label}: ${caption ?? severity}`}>
        {[1, 2, 3].map((segment) => (
          <View
            key={segment}
            style={[styles.meterSegment, segment <= filled && styles.meterSegmentFilled]}
          />
        ))}
      </View>
      {caption ? <Text style={styles.meterCaption}>{caption}</Text> : null}
    </View>
  );
}

/** Large primary action, e.g. Scan my face. */
export function ActionTile({
  icon,
  title,
  subtitle,
  onPress,
  disabled,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.actionTile,
        shadow.card,
        pressed && !disabled && styles.actionTilePressed,
        disabled && styles.actionTileDisabled,
      ]}
    >
      <Text style={styles.actionIcon}>{icon}</Text>
      <View style={styles.actionText}>
        <Text style={styles.actionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.actionSubtitle}>{subtitle}</Text> : null}
      </View>
    </Pressable>
  );
}

/** Smaller secondary tile, used in a row of two. */
export function MiniTile({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.miniTile, pressed && styles.miniTilePressed]}
    >
      <Text style={styles.miniIcon}>{icon}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.line,
    padding: space.lg,
  },
  cardAccent: { backgroundColor: color.primarySoft, borderColor: color.primarySoft },

  sectionLabel: {
    ...type.small,
    color: color.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: space.sm,
  },

  pill: {
    ...type.small,
    color: color.textMuted,
    backgroundColor: color.surfaceRaised,
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: space.sm,
    overflow: 'hidden',
  },
  pillSolid: { color: color.primary, backgroundColor: color.primarySoft },
  pillOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: color.line,
  },

  // No top margin: the caller spaces multiple meters, so the first sits flush
  // with the top of the card it is in.
  meterRow: {},
  meterLabel: { ...type.bodyStrong, fontSize: 14, lineHeight: 19, color: color.text },
  meterCaption: { ...type.small, fontSize: 12, lineHeight: 16, color: color.textMuted },
  meterTrack: { flexDirection: 'row', gap: 4, marginTop: 7, marginBottom: 3 },
  meterSegment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: color.line,
  },
  meterSegmentFilled: { backgroundColor: color.primary },

  actionTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: color.primary,
    borderRadius: radius.card,
    padding: 18,
  },
  actionTilePressed: { backgroundColor: color.primaryPressed },
  actionTileDisabled: { backgroundColor: color.lineStrong },
  actionIcon: { fontSize: 26 },
  actionText: { flex: 1 },
  actionTitle: { ...type.title, fontSize: 16, lineHeight: 21, color: color.onPrimary },
  actionSubtitle: { ...type.small, fontSize: 13, lineHeight: 18, color: color.onPrimary, opacity: 0.85 },

  miniTile: {
    flex: 1,
    alignItems: 'center',
    gap: space.xs,
    backgroundColor: color.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.line,
    paddingVertical: space.lg,
  },
  miniTilePressed: { backgroundColor: color.surfaceRaised },
  miniIcon: { fontSize: 22 },
  miniLabel: { ...type.small, color: color.text },
});
