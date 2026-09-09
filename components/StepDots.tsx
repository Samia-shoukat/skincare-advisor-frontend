/**
 * Onboarding progress.
 *
 * Four dashes, one per step, matching the welcome screen. It answers the only
 * question a form flow reliably provokes — "how much more of this is there" —
 * and answering it up front measurably reduces abandonment.
 *
 * `current` is one-based and comes from the server's view of what remains, not
 * from a local counter. A user resuming on a second device sees the correct
 * position rather than starting from one.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';

import { color, radius, space } from '../lib/theme';

export function StepDots({ current, total = 4 }: { current: number; total?: number }) {
  return (
    <View style={styles.row} accessibilityLabel={`Step ${current} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dash,
            i < current - 1 && styles.done,
            i === current - 1 && styles.active,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: space.sm,
    justifyContent: 'center',
    paddingBottom: space.xl,
  },
  dash: {
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: color.line,
  },
  done: { backgroundColor: color.textFaint },
  active: { backgroundColor: color.brand },
});