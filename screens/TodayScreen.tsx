/**
 * Today: the routine as a checklist.
 *
 * The routine screen answers "what is my routine and why"; this one answers
 * "what have I not done yet today". Same steps, different question, so it is a
 * separate tab rather than a mode of the routine screen.
 *
 * ## The ticks are a personal checklist, nothing more
 *
 * They live on the phone (lib/routineLog.ts), are never uploaded, and feed
 * nothing. No streak, no score, no "you are 80% consistent" — none of which the
 * system could support, and all of which would read as the app judging the
 * user's skin from their tapping.
 *
 * ## Step names come from the server
 *
 * `step.label` and the purpose line are the server's words (IF-UI-001). The
 * only text this file contributes is navigation chrome: the filter names and
 * the two empty states.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CheckRow, GlassCard, GuideCard, SectionHeader } from '../components/glass';
import { Screen, SegmentedControl, TabDefinition, TabKey } from '../components/navigation';
import type { Routine, RoutineStep, StringsBundle } from '../lib/api';
import { stepId } from '../lib/routineLog';
import { color, space, type } from '../lib/theme';

/** Decorative. Every row carries the server's label beside it. */
const STEP_GLYPH: Record<RoutineStep['step'], string> = {
  CLEANSE: '🧼',
  TREAT: '✨',
  MOISTURISE: '🌿',
  PROTECT: '☀️',
};

type Filter = 'today' | 'upcoming' | 'done';

interface Row {
  id: string;
  when: 'am' | 'pm';
  step: RoutineStep;
}

interface Props {
  routine: Routine | null;
  copy: StringsBundle;
  ticks: Set<string>;
  onToggle: (id: string) => void;
  shell: {
    tabs: TabDefinition[];
    activeTab: TabKey;
    onTabPress: (key: TabKey) => void;
  };
}

export function TodayScreen({ routine, copy, ticks, onToggle, shell }: Props) {
  const nav = copy.nav;
  const c = copy.routineScreen;
  const [filter, setFilter] = React.useState<Filter>('today');

  const rows: Row[] = useMemo(() => {
    if (!routine) return [];
    return [
      ...routine.am.map((step, i) => ({ id: stepId('am', i, step.ruleId), when: 'am' as const, step })),
      ...routine.pm.map((step, i) => ({ id: stepId('pm', i, step.ruleId), when: 'pm' as const, step })),
    ];
  }, [routine]);

  // "Today" is everything still outstanding; "Upcoming" is this evening's
  // steps, which is the only forward-looking slice the data supports -- there
  // is no schedule beyond morning and evening. "Completed" is what is ticked.
  const shown = rows.filter((row) => {
    if (filter === 'done') return ticks.has(row.id);
    if (filter === 'upcoming') return row.when === 'pm' && !ticks.has(row.id);
    return !ticks.has(row.id);
  });

  const emptyMessage = rows.length === 0 ? nav.nothingToday : nav.allDone;

  return (
    <Screen title={nav.todayHeading} {...shell}>
      <View style={styles.filters}>
        <SegmentedControl
          options={[
            { key: 'today' as const, label: nav.filterToday },
            { key: 'upcoming' as const, label: nav.filterUpcoming },
            { key: 'done' as const, label: nav.filterDone },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </View>

      {shown.length === 0 ? (
        <GlassCard tone="strong">
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        </GlassCard>
      ) : (
        <View style={styles.list}>
          {shown.map((row) => (
            <CheckRow
              key={row.id}
              glyph={STEP_GLYPH[row.step.step]}
              title={row.step.label}
              caption={
                c.ingredientPurpose[row.step.ingredient] ??
                (row.when === 'am' ? c.morning : c.evening)
              }
              done={ticks.has(row.id)}
              onToggle={() => onToggle(row.id)}
            />
          ))}
        </View>
      )}

      {/* The server's own "start slowly" guidance, not a guide this screen
          invented. If the server sends nothing, nothing is shown. */}
      {c.startSlowly ? (
        <View style={styles.guide}>
          <SectionHeader title={nav.careOverview} />
          <GuideCard title={c.heading} body={c.startSlowly} glyph="📖" />
        </View>
      ) : null}

      <Text style={styles.claim}>{copy.reviewClaim}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { marginTop: 8, marginBottom: 20 },
  list: { gap: 9 },
  emptyText: { ...type.body, fontSize: 15, lineHeight: 22, color: color.textMuted, textAlign: 'center' },
  guide: { marginTop: 28 },
  claim: { ...type.small, fontSize: 11.5, lineHeight: 16, color: color.textFaint, marginTop: 26, textAlign: 'center' },
});
