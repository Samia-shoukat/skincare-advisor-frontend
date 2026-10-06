/**
 * Home: who you are, what your skin is, and one way forward.
 *
 * Reads top to bottom as a greeting with the user's own name, the skin type
 * the quiz settled on, a quiet hero panel carrying the day's note, and then the
 * one thing this screen exists for -- "My Routine".
 *
 * ## No routine items here
 *
 * Home used to carry a shelf of routine steps and the next outstanding task.
 * Both were the Routine and Today tabs again in miniature, and a screen that
 * previews three others reads as a dashboard of everything and a home for
 * nothing. The steps now live behind the CTA, once.
 *
 * ## The scan stays, one step down
 *
 * A new analysis is still how a routine is made or remade, so it is offered
 * here -- but as a quiet row beneath the CTA, not as the hero. Whether it is
 * offered at all is the server's call (FR-SUB-002); this screen only draws the
 * answer.
 *
 * ## No "Glow seeker"
 *
 * `copy.home.status` is not rendered. A generic label in the place where the
 * user's name belongs reads as the app not knowing who they are.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Avatar, GlassCard, StatusPill } from '../components/glass';
import { Icon } from '../components/Icon';
import { Screen, TabDefinition, TabKey } from '../components/navigation';
import type { Eligibility, StringsBundle } from '../lib/api';
import { dayOfYear, longDate } from '../lib/dates';
import { initials } from '../lib/displayName';
import { color, radius, shadow, type } from '../lib/theme';

interface Props {
  copy: StringsBundle;
  /** From the Supabase session, never our backend. See lib/displayName.ts. */
  name: string | null;
  /** The profile's skin type enum, e.g. COMBINATION. Shown through the server's label map. */
  skinType: string | null;
  eligibility: Eligibility | null;
  hasRoutine: boolean;
  onOpenRoutine: () => void;
  onOpenProfile: () => void;
  onScan: () => void;
  shell: {
    tabs: TabDefinition[];
    activeTab: TabKey;
    onTabPress: (key: TabKey) => void;
  };
}

export function HomeScreen({
  copy,
  name,
  skinType,
  eligibility,
  hasRoutine,
  onOpenRoutine,
  onOpenProfile,
  onScan,
  shell,
}: Props) {
  const nav = copy.nav;
  const now = new Date();
  const notes = copy.home.dailyNotes;
  const note = notes.length ? notes[dayOfYear(now) % notes.length] : null;
  const skinLabel = skinType ? copy.routineScreen.skinTypeLabels[skinType] : null;

  const blocked = eligibility ? !eligibility.canScan : false;
  const blockedReason =
    eligibility?.reason === 'QUOTA_EXHAUSTED' ? copy.quotaExhausted : copy.scanBlockedSupport;

  return (
    <Screen {...shell}>
      {/* ---- Greeting ----------------------------------------------------- */}
      <View style={styles.topRow}>
        <Text style={styles.date}>{longDate(now).toUpperCase()}</Text>
        <Avatar
          initials={initials(name)}
          size={44}
          onPress={onOpenProfile}
          label={nav.profile}
        />
      </View>

      <Text style={styles.hello} accessibilityRole="header">
        {name ? `${copy.home.greeting},` : copy.home.greeting}
      </Text>
      {name ? (
        <Text style={styles.name} numberOfLines={2}>
          {name}
        </Text>
      ) : null}

      {skinLabel ? (
        <View style={styles.skinRow}>
          <View style={styles.skinDot}>
            <Icon name="droplet" size={12} tint={color.primary} />
          </View>
          <Text style={styles.skinText}>
            {copy.routineScreen.skinTypeLabel}:{' '}
            <Text style={styles.skinValue}>{skinLabel}</Text>
          </Text>
        </View>
      ) : null}

      {/* ---- Hero: the day's note ----------------------------------------- */}
      <LinearGradient
        colors={color.heroGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, shadow.card]}
      >
        {/* Decorative orbs. Gradients rather than an image: sharp at any
            density and nothing to download. */}
        <LinearGradient
          colors={['#DCC9F0', '#F6DCE7']}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={styles.orbLarge}
        />
        <LinearGradient
          colors={['#FFFFFF', '#EBDDF7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.orbSmall}
        />
        <View style={styles.orbRing} />

        <View style={styles.heroBadge}>
          <Icon name="sun" size={16} tint={color.primary} />
        </View>
        <Text style={styles.heroLabel}>{nav.dailyNoteLabel.toUpperCase()}</Text>
        {note ? <Text style={styles.heroNote}>{note}</Text> : null}
      </LinearGradient>

      {/* ---- The CTA ------------------------------------------------------ */}
      <Pressable
        onPress={onOpenRoutine}
        accessibilityRole="button"
        accessibilityLabel={nav.myRoutine}
        style={({ pressed }) => [styles.ctaShell, shadow.lifted, pressed && styles.ctaPressed]}
      >
        <LinearGradient
          colors={color.accentGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cta}
        >
          <View style={styles.ctaIcon}>
            <Icon name="layers" size={22} tint={color.onPrimary} />
          </View>
          <View style={styles.ctaText}>
            <Text style={styles.ctaTitle}>{nav.myRoutine}</Text>
            <Text style={styles.ctaSubtitle} numberOfLines={1}>
              {hasRoutine ? nav.routineCtaSubtitle : copy.home.noRoutine}
            </Text>
          </View>
          <View style={styles.ctaArrow}>
            <Icon name="arrow-right" size={20} tint={color.primaryDeep} />
          </View>
        </LinearGradient>
      </Pressable>

      {/* ---- New analysis, one step down ---------------------------------- */}
      {blocked ? (
        <GlassCard tone="strong" style={styles.scanBlock}>
          <Text style={styles.scanTitle}>{copy.scan.readyHeading}</Text>
          <Text style={styles.scanSubtitle}>{blockedReason}</Text>
        </GlassCard>
      ) : eligibility ? (
        <Pressable
          onPress={onScan}
          accessibilityRole="button"
          style={({ pressed }) => [styles.scanRow, shadow.card, pressed && styles.pressed]}
        >
          <View style={styles.scanIcon}>
            <Icon name="aperture" size={20} tint={color.primary} />
          </View>
          <View style={styles.scanText}>
            <Text style={styles.scanTitle}>{copy.home.scanTitle}</Text>
            {copy.home.scanSubtitle ? (
              <Text style={styles.scanSubtitle} numberOfLines={2}>
                {copy.home.scanSubtitle}
              </Text>
            ) : null}
          </View>
          <StatusPill
            tone="neutral"
            label={`${eligibility.scansRemaining} ${
              eligibility.scansRemaining === 1 ? 'scan left' : 'scans left'
            }`}
          />
        </Pressable>
      ) : null}

      <Text style={styles.claim}>{copy.reviewClaim}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  date: { ...type.small, fontSize: 11.5, lineHeight: 16, letterSpacing: 1.2, color: color.textFaint, fontWeight: '600' },

  hello: { ...type.title, fontSize: 22, lineHeight: 28, fontWeight: '400', color: color.textMuted, marginTop: 18 },
  name: { ...type.display, fontSize: 32, lineHeight: 39, letterSpacing: -0.8, color: color.text },

  skinRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  skinDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.primarySoft,
  },
  skinText: { ...type.small, fontSize: 14.5, lineHeight: 20, color: color.textMuted },
  skinValue: { color: color.primary, fontWeight: '600' },

  hero: {
    marginTop: 26,
    borderRadius: 28,
    padding: 22,
    paddingTop: 20,
    minHeight: 190,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: color.glassBorder,
  },
  orbLarge: { position: 'absolute', width: 170, height: 170, borderRadius: 85, top: -50, right: -36, opacity: 0.85 },
  orbSmall: { position: 'absolute', width: 58, height: 58, borderRadius: 29, top: 22, right: 150, opacity: 0.9 },
  orbRing: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    top: 10,
    right: 40,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  heroBadge: {
    position: 'absolute',
    top: 20,
    left: 22,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.glassStrong,
  },
  heroLabel: { ...type.small, fontSize: 11, lineHeight: 15, letterSpacing: 1.3, fontWeight: '600', color: color.primary },
  heroNote: { ...type.title, fontSize: 20, lineHeight: 28, fontWeight: '500', letterSpacing: -0.3, color: color.text, marginTop: 6, maxWidth: '92%' },

  // The shell carries the shadow and a solid fill; the gradient sits inside
  // it. Android draws elevation from the view's own background, so a shadow
  // on the gradient alone would not render.
  ctaShell: { marginTop: 22, borderRadius: 26, backgroundColor: color.primary },
  ctaPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 26,
    paddingVertical: 20,
    paddingLeft: 20,
    paddingRight: 16,
  },
  ctaIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  ctaText: { flex: 1 },
  ctaTitle: { ...type.title, fontSize: 21, lineHeight: 27, color: color.onPrimary },
  ctaSubtitle: { ...type.small, fontSize: 13, lineHeight: 18, color: color.onPrimary, opacity: 0.82, marginTop: 1 },
  ctaArrow: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface,
  },

  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginTop: 14,
    backgroundColor: color.glassStrong,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.glassBorder,
    padding: 14,
  },
  pressed: { opacity: 0.85 },
  scanBlock: { marginTop: 14 },
  scanIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.primarySoft,
  },
  scanText: { flex: 1 },
  scanTitle: { ...type.bodyStrong, fontSize: 15, lineHeight: 20, color: color.text },
  scanSubtitle: { ...type.small, fontSize: 12.5, lineHeight: 17, color: color.textMuted, marginTop: 1 },

  claim: { ...type.small, fontSize: 11.5, lineHeight: 16, color: color.textFaint, marginTop: 28, textAlign: 'center' },
});
