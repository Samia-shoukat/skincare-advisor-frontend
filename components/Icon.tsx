/**
 * Line icons.
 *
 * Feather, through @expo/vector-icons: a single 2px-stroke set that reads as
 * one family at every size, which is most of what makes an icon set look
 * considered rather than collected. It is JavaScript and a font file -- no
 * native module, no rebuild -- and the font loads through expo-font, which
 * ships inside `expo` already.
 *
 * This replaces emoji on the redesigned screens. Emoji were chosen to avoid a
 * dependency, and they did; but they are full-colour, drawn differently by
 * every vendor, and cannot take the accent colour, so a "minimal" screen built
 * from them never quite is.
 *
 * Every icon is decorative. Each one sits beside a text label that carries the
 * meaning, so the glyph is hidden from screen readers (IF-UI-002).
 */

import React from 'react';
import Feather from '@expo/vector-icons/Feather';
import type { StyleProp, TextStyle } from 'react-native';

import type { RoutineStep } from '../lib/api';
import { color } from '../lib/theme';

export type IconName = React.ComponentProps<typeof Feather>['name'];

export function Icon({
  name,
  size = 20,
  tint = color.text,
  style,
}: {
  name: IconName;
  size?: number;
  tint?: string;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Feather
      name={name}
      size={size}
      color={tint}
      style={style}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

/** The four care stages the engine produces. Decorative; the label carries meaning. */
export const STEP_ICON: Record<RoutineStep['step'], IconName> = {
  CLEANSE: 'droplet',
  TREAT: 'star',
  MOISTURISE: 'cloud',
  PROTECT: 'shield',
};

/**
 * One glyph per concern id. Decorative: the chip beside it always carries the
 * server's label, so an unknown id falls back to a plain dot and loses nothing.
 */
export const CONCERN_ICON: Record<string, IconName> = {
  ACNE: 'circle',
  EXCESS_OIL: 'droplet',
  DRYNESS: 'feather',
  DEHYDRATION: 'cloud-drizzle',
  POST_ACNE_MARKS: 'disc',
  UNEVEN_TONE: 'sliders',
  ENLARGED_PORES: 'grid',
  MILD_REDNESS: 'thermometer',
  FINE_LINES: 'activity',
};
