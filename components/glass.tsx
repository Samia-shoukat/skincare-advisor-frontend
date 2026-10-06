/**
 * The glass kit: translucent panels, section headers, status pills, task rows.
 *
 * These are the shapes the app is assembled from — a card, a header with an
 * action, a horizontal shelf item, a row of care icons, a checkable task, a
 * guide panel. Screens compose these rather than styling views directly, so a
 * change to the surface treatment lands everywhere at once.
 *
 * ## Why these are not blurred
 *
 * See the note on `color.glass` in lib/theme.ts. In short: a real blur needs a
 * native module, and over a soft two-stop wash a translucent white fill with a
 * lit edge is indistinguishable from one.
 *
 * ## Icons are emoji, deliberately
 *
 * The alternative is an icon font or SVG set, which is another dependency and
 * another native asset pipeline. Emoji render on every Android version the app
 * supports, scale with the text size the user has chosen, and carry no
 * licensing question. They are decoration in every case here — every icon sits
 * beside a text label that carries the actual meaning, so a device that
 * substitutes a different glyph loses nothing (IF-UI-002).
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { color, radius, shadow, space, type } from '../lib/theme';
import { Icon, IconName } from './Icon';

/** The base translucent panel. `tone="strong"` for panels carrying body text. */
export function GlassCard({
  children,
  tone = 'plain',
  style,
}: {
  children: React.ReactNode;
  tone?: 'plain' | 'strong' | 'accent';
  style?: object;
}) {
  return (
    <View
      style={[
        styles.glass,
        tone === 'strong' && styles.glassStrong,
        tone === 'accent' && styles.glassAccent,
        shadow.card,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Circular glass button: back, menu, notifications, overflow. */
export function IconButton({
  glyph,
  icon,
  label,
  onPress,
}: {
  /** An emoji or character. Ignored when `icon` is given. */
  glyph?: string;
  /** A line icon. Preferred over `glyph` on redesigned screens. */
  icon?: IconName;
  /** Spoken label. The glyph is decorative, so this is the only description. */
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
    >
      {icon ? (
        <Icon name={icon} size={18} tint={color.text} />
      ) : (
        <Text style={styles.iconGlyph}>{glyph}</Text>
      )}
    </Pressable>
  );
}

/**
 * Initials on the accent gradient, inside a white ring.
 *
 * No photo upload, deliberately: the backend keeps no images (FR-CAM-003's
 * zero-save rule), and a profile picture would be the one face photograph the
 * system held on to.
 */
export function Avatar({
  initials,
  size = 44,
  onPress,
  label,
}: {
  initials: string;
  size?: number;
  onPress?: () => void;
  /** Spoken label when pressable. */
  label?: string;
}) {
  const ring = Math.max(2, Math.round(size / 22));
  const body = (
    <View
      style={[
        styles.avatarRing,
        { width: size, height: size, borderRadius: size / 2, padding: ring },
        shadow.card,
      ]}
    >
      <LinearGradient
        colors={color.accentGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.avatarFill, { borderRadius: size / 2 }]}
      >
        <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{initials}</Text>
      </LinearGradient>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8}>
      {body}
    </Pressable>
  );
}

/** Section title with an optional trailing action, e.g. "My routine — See all". */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Small status chip.
 *
 * `tone` is presentational only. Nothing here decides what counts as calm or
 * as needing attention — the caller passes a label the server supplied and the
 * tone that matches it.
 */
export function StatusPill({
  label,
  tone = 'calm',
}: {
  label: string;
  tone?: 'calm' | 'watch' | 'neutral';
}) {
  return (
    <Text
      style={[
        styles.statusPill,
        tone === 'watch' && styles.statusPillWatch,
        tone === 'neutral' && styles.statusPillNeutral,
      ]}
      numberOfLines={1}
    >
      {label}
    </Text>
  );
}

/** Horizontal shelf. Children are `ShelfCard`s. */
export function Shelf({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.shelf}
    >
      {children}
    </ScrollView>
  );
}

/** One card on a horizontal shelf: glyph, name, and a status chip. */
export function ShelfCard({
  glyph,
  title,
  status,
  tone,
  onPress,
}: {
  glyph: string;
  title: string;
  status?: string;
  tone?: 'calm' | 'watch' | 'neutral';
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.shelfCard, shadow.card, pressed && styles.pressedCard]}
    >
      <Text style={styles.shelfGlyph}>{glyph}</Text>
      <Text style={styles.shelfTitle} numberOfLines={2}>
        {title}
      </Text>
      {status ? <StatusPill label={status} tone={tone} /> : null}
    </Pressable>
  );
}

/**
 * The four care stages in a row, each a bubble with a label beneath.
 *
 * The stages are the four the engine actually produces — CLEANSE, TREAT,
 * MOISTURISE, PROTECT — so this is a view of the routine, not a decorative
 * fixed list. A stage the routine does not include is shown dimmed rather than
 * hidden, because the gap is information: it says the routine has no treatment
 * step, which is different from the screen having forgotten to draw one.
 */
export function CareOverview({
  items,
}: {
  items: { glyph: string; label: string; caption: string; present: boolean }[];
}) {
  return (
    <View style={styles.careRow}>
      {items.map((item) => (
        <View key={item.label} style={styles.careItem}>
          <View style={[styles.careBubble, !item.present && styles.careBubbleOff]}>
            <Text style={[styles.careGlyph, !item.present && styles.careGlyphOff]}>
              {item.glyph}
            </Text>
          </View>
          <Text style={[styles.careLabel, !item.present && styles.careTextOff]} numberOfLines={1}>
            {item.label}
          </Text>
          <Text style={[styles.careCaption, !item.present && styles.careTextOff]} numberOfLines={2}>
            {item.caption}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** A task row with a tappable completion circle. */
export function CheckRow({
  icon,
  title,
  caption,
  done,
  onToggle,
}: {
  icon: IconName;
  title: string;
  caption?: string;
  done: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={caption ? `${title}, ${caption}` : title}
      style={({ pressed }) => [styles.checkRow, shadow.card, pressed && styles.pressedCard]}
    >
      <View style={[styles.checkTile, done && styles.checkTileDone]}>
        <Icon name={icon} size={18} tint={done ? color.textFaint : color.primary} />
      </View>

      <View style={styles.checkText}>
        <Text style={[styles.checkTitle, done && styles.checkTitleDone]} numberOfLines={1}>
          {title}
        </Text>
        {caption ? (
          <Text style={styles.checkCaption} numberOfLines={1}>
            {caption}
          </Text>
        ) : null}
      </View>

      <View style={[styles.checkMark, done && styles.checkMarkDone]}>
        {done ? <Icon name="check" size={14} tint={color.onPrimary} /> : null}
      </View>
    </Pressable>
  );
}

/** Wide panel: words on the left, an icon on the right, an action below. */
export function GuideCard({
  title,
  body,
  icon,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  icon: IconName;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <GlassCard tone="strong">
      <View style={styles.guideRow}>
        <View style={styles.guideText}>
          <Text style={styles.guideTitle}>{title}</Text>
          <Text style={styles.guideBody}>{body}</Text>
          {actionLabel && onAction ? (
            <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.guideAction}>{actionLabel} ›</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.guideBadge}>
          <Icon name={icon} size={22} tint={color.primary} />
        </View>
      </View>
    </GlassCard>
  );
}

/** Full-width pill button. The one strong colour on a screen. */
export function PillButton({
  label,
  onPress,
  tone = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'quiet';
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.pillButton,
        tone === 'quiet' && styles.pillButtonQuiet,
        shadow.card,
        pressed && styles.pillButtonPressed,
        disabled && styles.pillButtonDisabled,
      ]}
    >
      <Text style={[styles.pillLabel, tone === 'quiet' && styles.pillLabelQuiet]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Sizes below are the measured values from the approved design, not the
  // generic spacing scale. The scale is for ordinary screens; these panels were
  // tuned against a reference and drift visibly if rounded to the nearest step.
  glass: {
    backgroundColor: color.glass,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.glassBorder,
    padding: 18,
  },
  glassStrong: { backgroundColor: color.glassStrong },
  glassAccent: { backgroundColor: color.primarySoft, borderColor: color.glassBorder },
  pressedCard: { opacity: 0.85 },

  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.glassStrong,
    borderWidth: 1,
    borderColor: color.glassBorder,
  },
  iconButtonPressed: { backgroundColor: color.primarySoft },
  iconGlyph: { fontSize: 15, color: color.text },

  avatarRing: { backgroundColor: color.surface },
  avatarFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: color.onPrimary, fontWeight: '600', letterSpacing: 0.5 },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: { ...type.title, fontSize: 19, lineHeight: 25, color: color.text, flex: 1 },
  sectionAction: { ...type.small, fontSize: 13, lineHeight: 18, color: color.primary, fontWeight: '600' },

  statusPill: {
    ...type.small,
    fontSize: 11.5,
    lineHeight: 17,
    color: color.primary,
    backgroundColor: color.primarySoft,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 9,
    overflow: 'hidden',
  },
  statusPillWatch: { color: color.attention, backgroundColor: color.attentionSoft },
  statusPillNeutral: { color: color.textMuted, backgroundColor: color.surfaceRaised },

  shelf: { gap: 12, paddingVertical: 4, paddingRight: 20 },
  shelfCard: {
    width: 112,
    backgroundColor: color.glass,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.glassBorder,
    padding: 14,
    alignItems: 'flex-start',
  },
  shelfGlyph: { fontSize: 27, marginBottom: 8 },
  shelfTitle: { ...type.small, fontSize: 13, lineHeight: 17, fontWeight: '600', color: color.text, marginBottom: 7 },

  careRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  careItem: { flex: 1, alignItems: 'center' },
  careBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.glassStrong,
    borderWidth: 1,
    borderColor: color.glassBorder,
    marginBottom: 7,
  },
  careBubbleOff: { backgroundColor: 'transparent', borderColor: color.line, opacity: 0.4 },
  careGlyph: { fontSize: 19 },
  careGlyphOff: { opacity: 0.35 },
  careLabel: { ...type.small, fontSize: 12.5, lineHeight: 17, fontWeight: '600', color: color.text },
  careCaption: { ...type.small, fontSize: 10.5, lineHeight: 14, color: color.textMuted, textAlign: 'center', marginTop: 2 },
  careTextOff: { color: color.textFaint },

  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: color.glass,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.glassBorder,
    padding: 13,
  },
  checkTile: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.primarySoft,
  },
  checkTileDone: { backgroundColor: color.surfaceRaised },
  checkText: { flex: 1 },
  checkTitle: { ...type.bodyStrong, fontSize: 15, lineHeight: 20, color: color.text },
  checkTitleDone: { color: color.textFaint, textDecorationLine: 'line-through' },
  checkCaption: { ...type.small, fontSize: 12.5, lineHeight: 17, color: color.textMuted, marginTop: 1 },
  checkMark: {
    width: 25,
    height: 25,
    borderRadius: 12.5,
    borderWidth: 1.5,
    borderColor: color.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMarkDone: { backgroundColor: color.primary, borderColor: color.primary },

  guideRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  guideText: { flex: 1 },
  guideTitle: { ...type.bodyStrong, fontSize: 15, lineHeight: 20, color: color.text },
  guideBody: { ...type.small, fontSize: 12.5, lineHeight: 18, color: color.textMuted, marginTop: 4 },
  guideAction: { ...type.small, fontSize: 12.5, lineHeight: 17, color: color.primary, fontWeight: '600', marginTop: 7 },
  guideBadge: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.primarySoft,
  },

  pillButton: {
    backgroundColor: color.primary,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillButtonQuiet: {
    backgroundColor: color.glassStrong,
    borderWidth: 1,
    borderColor: color.glassBorder,
  },
  pillButtonPressed: { backgroundColor: color.primaryPressed },
  pillButtonDisabled: { opacity: 0.5 },
  pillLabel: { ...type.bodyStrong, fontSize: 15, lineHeight: 20, color: color.onPrimary },
  pillLabelQuiet: { color: color.primary },
});
