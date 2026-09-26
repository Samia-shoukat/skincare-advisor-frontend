/**
 * Welcome. FR-ONB-001.
 *
 * Two layers:
 *   1. Choose a route in — Google or email.
 *   2. Choosing email raises a sheet: create an account, or log in.
 *
 * The sheet exists because passwords make the two paths genuinely different. A
 * new user chooses a password, a returning one recalls it, and a single form
 * trying to be both ends up with a confirmation field half the users must
 * ignore. Google has no such split, so it stays one button.
 *
 * The mark is the original opal disc, rebuilt with a gradient rather than
 * shipped as an image so it stays sharp at any size and costs nothing to load.
 * Its stops are pulled toward the palette — pale matcha, cream, soft blush —
 * so it still reads as the same iridescent disc without fighting the ground.
 */

import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Button, GradientScreen, LinkButton } from '../components/ui';
import { openLegalPage } from '../lib/legal';
import { authErrorMessage, signInWithGoogle } from '../lib/supabase';
import { color, radius, shadow, space, type } from '../lib/theme';

export function WelcomeScreen({
  onRegister,
  onLogin,
  onServerAddress,
}: {
  onRegister: () => void;
  onLogin: () => void;
  /** Test builds only; absent in a real release (see lib/apiBase.ts). */
  onServerAddress?: () => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogle() {
    setGoogleBusy(true);
    setError(null);
    try {
      // On success the auth listener takes over and this screen unmounts.
      // A cancelled sheet resolves without a session and simply returns here.
      await signInWithGoogle();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setGoogleBusy(false);
    }
  }

  const choose = (go: () => void) => {
    setSheetOpen(false);
    go();
  };

  return (
    <GradientScreen>
      <View style={styles.body}>
        <LinearGradient
          colors={['#CFE3C6', '#F2ECE0', '#EFD9CE']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.mark}
        >
          <Text style={styles.markLetter}>S</Text>
        </LinearGradient>

        <Text style={styles.wordmark}>skinsight</Text>
        <Text style={styles.tagline}>
          A closer look at your skin — and an honest one.
        </Text>
      </View>

      <View style={styles.actions}>
        <Button
          label="Continue with Google"
          icon="G"
          tone="outline"
          onPress={handleGoogle}
          loading={googleBusy}
        />
        <Button label="Continue with email" onPress={() => setSheetOpen(true)} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <Text style={styles.legal}>
        Cosmetic guidance only. Skinsight can't diagnose skin conditions.
      </Text>
      {/* Readable before an account exists, whichever sign-in is chosen. */}
      <View style={styles.legalLinks}>
        <LinkButton label="Privacy policy" onPress={() => openLegalPage('/legal/privacy')} />
        <LinkButton label="Terms of use" onPress={() => openLegalPage('/legal/terms')} />
        {onServerAddress ? <LinkButton label="Server address" onPress={onServerAddress} /> : null}
      </View>

      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetOpen(false)}
      >
        {/* Tapping outside dismisses. Without it the sheet is a trap on
            Android devices using gesture navigation. */}
        <Pressable style={styles.backdrop} onPress={() => setSheetOpen(false)} />

        <View style={styles.sheet}>
          <View style={styles.grabber} />

          <Text style={styles.sheetLabel}>New here?</Text>
          <Button label="Create an account" onPress={() => choose(onRegister)} />

          <Text style={[styles.sheetLabel, styles.sheetLabelSecond]}>
            Been here before?
          </Text>
          <Button label="Log in" tone="outline" onPress={() => choose(onLogin)} />
        </View>
      </Modal>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  legalLinks: { flexDirection: 'row', justifyContent: 'center', gap: space.lg, paddingBottom: space.md },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  mark: {
    width: 128,
    height: 128,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xl,
    ...shadow.lifted,
  },
  markLetter: {
    fontSize: 74,
    fontWeight: '700',
    color: '#FFFDF7',
    // Nudges the glyph off the optical centre — a capital S sits low in its
    // own box, so centring it geometrically makes it look like it is sinking.
    marginTop: -6,
  },

  wordmark: { ...type.wordmark, color: color.primary },
  tagline: {
    ...type.body,
    color: color.textMuted,
    textAlign: 'center',
    marginTop: space.md,
    paddingHorizontal: space.lg,
  },

  actions: { paddingHorizontal: space.lg, gap: space.md },
  error: { ...type.small, color: color.danger, textAlign: 'center' },

  legal: {
    ...type.small,
    color: color.textFaint,
    textAlign: 'center',
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.md,
  },

  backdrop: { flex: 1, backgroundColor: 'rgba(62,50,38,0.35)' },
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.xl,
    ...shadow.lifted,
  },
  grabber: {
    width: 44,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: color.line,
    alignSelf: 'center',
    marginBottom: space.lg,
  },
  sheetLabel: {
    ...type.small,
    color: color.textMuted,
    textAlign: 'center',
    marginBottom: space.md,
  },
  sheetLabelSecond: { marginTop: space.lg },
});