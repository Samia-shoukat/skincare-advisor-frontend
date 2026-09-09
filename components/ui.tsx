/**
 * Shared UI primitives.
 *
 * Two rules hold the look together:
 *
 *   Separation comes from shadow, not from borders. A hairline on a warm
 *   ground reads as a seam; a wide soft shadow reads as depth.
 *
 *   One filled matcha pill per screen, for the thing you came to do.
 *   Everything else is an outline or a link. No colour is needed to establish
 *   which is which, which is what keeps `attention` free to mean "stop and
 *   read".
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { color, radius, shadow, space, type } from '../lib/theme';

// ---------------------------------------------------------------------------

export function GradientScreen({ children }: { children: React.ReactNode }) {
  return (
    <LinearGradient colors={color.gradient} style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
        {children}
      </SafeAreaView>
    </LinearGradient>
  );
}

export function FormScreen({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <LinearGradient colors={color.gradient} style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </SafeAreaView>
    </LinearGradient>
  );
}

export function Heading({ children }: { children: React.ReactNode }) {
  return <Text style={styles.heading}>{children}</Text>;
}

export function Body({
  children,
  muted,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return <Text style={[styles.body, muted && styles.bodyMuted]}>{children}</Text>;
}

/** A warm white rounded panel. Used for questions, statements, notices. */
export function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

// ---------------------------------------------------------------------------

type Tone = 'primary' | 'affirm' | 'action' | 'outline' | 'ghost';

export function Button({
  label,
  onPress,
  tone = 'primary',
  loading,
  disabled,
  icon,
}: {
  label: string;
  onPress: () => void;
  tone?: Tone;
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
}) {
  const isDisabled = disabled || loading;
  const isFilled = tone === 'primary' || tone === 'affirm' || tone === 'action';

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={({ pressed }) => [
        styles.button,
        toneStyles[tone],
        isFilled && !isDisabled && shadow.card,
        pressed && !isDisabled && pressedStyles[tone],
        isDisabled && styles.buttonDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isFilled ? color.onPrimary : color.primary} />
      ) : (
        <Text style={[styles.buttonLabel, isFilled && styles.buttonLabelPrimary]}>
          {icon ? `${icon}   ` : ''}
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={12}>
      <Text style={styles.link}>{label}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------

export function TextField({
  label,
  hint,
  error,
  ...props
}: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        style={[styles.input, error && styles.inputError, props.style]}
        placeholderTextColor={color.textFaint}
        accessibilityLabel={label}
      />
      {/* Error replaces the hint rather than stacking, so the layout does not
          shift when validation fails. */}
      {error ? (
        <Text style={styles.fieldError}>{error}</Text>
      ) : hint ? (
        <Text style={styles.fieldHint}>{hint}</Text>
      ) : null}
    </View>
  );
}

/**
 * Password field with a reveal toggle.
 *
 * Not a nicety. On a phone keyboard a masked password is typed blind, and the
 * usual response to a rejected login is to retype it blind again. Letting
 * people look is the cheapest reduction in failed sign-ins available.
 */
export function PasswordField({
  label,
  hint,
  error,
  ...props
}: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.field}>
      <View style={styles.fieldHeader}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Pressable onPress={() => setVisible((v) => !v)} hitSlop={12}>
          <Text style={styles.reveal}>{visible ? 'hide' : 'show'}</Text>
        </Pressable>
      </View>
      <TextInput
        {...props}
        secureTextEntry={!visible}
        style={[styles.input, error && styles.inputError, props.style]}
        placeholderTextColor={color.textFaint}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={label}
      />
      {error ? (
        <Text style={styles.fieldError}>{error}</Text>
      ) : hint ? (
        <Text style={styles.fieldHint}>{hint}</Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: {
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    paddingBottom: space.lg,
    flexGrow: 1,
  },
  footer: {
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    paddingTop: space.md,
    gap: space.sm,
  },

  heading: { ...type.display, color: color.text, marginBottom: space.sm },
  body: { ...type.body, color: color.text },
  bodyMuted: { color: color.textMuted },

  card: {
    backgroundColor: color.surface,
    borderRadius: radius.card,
    padding: space.lg,
    ...shadow.card,
  },

  button: {
    borderRadius: radius.pill,
    // 56 keeps the target well clear of the 44pt minimum with text inside.
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonLabel: { ...type.body, color: color.primary },
  buttonLabelPrimary: { ...type.bodyStrong, color: color.onPrimary },

  link: {
    ...type.small,
    color: color.textMuted,
    textAlign: 'center',
    paddingVertical: space.sm,
    textDecorationLine: 'underline',
  },

  field: { marginBottom: space.lg },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.sm,
  },
  fieldLabel: { ...type.small, color: color.textMuted },
  reveal: { ...type.small, color: color.primary, textDecorationLine: 'underline' },
  input: {
    ...type.body,
    color: color.text,
    backgroundColor: color.surface,
    borderRadius: radius.field,
    paddingHorizontal: space.md,
    minHeight: 56,
    ...shadow.card,
  },
  inputError: { borderWidth: 1, borderColor: color.danger },
  fieldHint: { ...type.small, color: color.textFaint, marginTop: space.sm },
  fieldError: { ...type.small, color: color.danger, marginTop: space.sm },
});

const toneStyles = StyleSheet.create({
  primary: { backgroundColor: color.primary },
  affirm: { backgroundColor: color.primary },
  action: { backgroundColor: color.primary },
  outline: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
  },
  // A true ghost button is invisible on a cream ground, so it renders as a
  // quiet outline instead. Same weight in the hierarchy, actually findable.
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: color.line,
  },
});

const pressedStyles = StyleSheet.create({
  primary: { backgroundColor: color.primaryPressed },
  affirm: { backgroundColor: color.primaryPressed },
  action: { backgroundColor: color.primaryPressed },
  outline: { backgroundColor: color.primarySoft },
  ghost: { backgroundColor: color.primarySoft },
});