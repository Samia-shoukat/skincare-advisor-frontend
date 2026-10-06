/**
 * Today: the routine as a checklist.
 *
 * The routine screen answers "what is my routine and why"; this one answers
 * "what have I not done yet today". Same steps, different question, so it is a
 * separate tab rather than a mode of the routine screen.
 *
 * Top to bottom: the date and the week it sits in, how many of today's steps
 * are ticked, a filter, then the steps grouped into morning and evening.
 *
 * ## The week strip is orientation, not history
 *
 * Ticks are kept for the current day only (lib/routineLog.ts) -- yesterday's
 * are discarded on purpose. So the strip marks today and nothing else. Dots
 * under past days would have to be invented, and an invented record of what
 * someone did is worse than none.
 *
 * ## The ticks are a personal checklist, nothing more
 *
 * They live on the phone, are never uploaded, and feed nothing. The count is
 * "3 of 7 today" -- a plain tally of a checklist -- and never a streak, a score
 * or "you are 80% consistent", none of which the system could support and all
 * of which would read as the app judging the user's skin from their tapping.
 *
 * ## Step names come from the server
 *
 * `step.label` and the purpose line are the server's words (IF-UI-001). The
 * only text this file contributes is navigation chrome.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CheckRow, GlassCard, GuideCard, SectionHeader } from '../components/glass';
import { Icon, STEP_ICON } from '../components/Icon';
import { Screen, SegmentedControl, TabDefinition, TabKey } from '../components/navigation';
import type { Routine, RoutineStep, StringsBundle } from '../lib/api';
import { dayMonth, weekdayName, weekOf } from '../lib/dates';
import { stepId } from '../lib/routineLog';
import { color, radius, shadow, type } from '../lib/theme';

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
  const now = new Date();
  const week = weekOf(now);

  const rows: Row[] = useMemo(() => {
    if (!routine) return [];
    return [
      ...routine.am.map((step, i) => ({ id: stepId('am', i, step.ruleId), when: 'am' as const, step })),
      ...routine.pm.map((step, i) => ({ id: stepId('pm', i, step.ruleId), when: 'pm' as const, step })),
    ];
  }, [routine]);

  const doneCount = rows.filter((row) => ticks.has(row.id)).length;

  // "Today" is everything still outstanding; "Upcoming" is this evening's
  // steps, which is the only forward-looking slice the data supports -- there
  // is no schedule beyond morning and evening. "Completed" is what is ticked.
  const shown = rows.filter((row) => {
    if (filter === 'done') return ticks.has(row.id);
    if (filter === 'upcoming') return row.when === 'pm' && !ticks.has(row.id);
    return !ticks.has(row.id);
  });
  const groups = (['am', 'pm'] as const)
    .map((when) => ({ when, rows: shown.filter((row) => row.when === when) }))
    .filter((group) => group.rows.length > 0);

  const emptyMessage = rows.length === 0 ? nav.nothingToday : nav.allDone;

  return (
    <Screen title={nav.todayHeading} {...shell}>
      {/* ---- Date and week ------------------------------------------------ */}
      <View style={styles.dateBlock}>
        <Text style={styles.weekday}>{weekdayName(now)}</Text>
        <Text style={styles.dayMonth}>{dayMonth(now)}</Text>
      </View>

      <View style={[styles.week, shadow.card]}>
        {week.map((day) => (
          <View
            key={day.date.toDateString()}
            style={styles.weekDay}
            accessible={day.isToday}
            accessibilityLabel={day.isToday ? `${weekdayName(day.date)}, ${dayMonth(day.date)}` : undefined}
          >
            <Text style={[styles.weekLetter, day.isToday && styles.weekLetterToday]}>{day.letter}</Text>
            <View style={[styles.weekNumberWrap, day.isToday && styles.weekNumberWrapToday]}>
              <Text style={[styles.weekNumber, day.isToday && styles.weekNumberToday]}>
                {day.date.getDate()}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* ---- Today's tally ------------------------------------------------ */}
      {rows.length > 0 ? (
        <GlassCard tone="strong" style={styles.progressCard}>
          <View style={styles.progressHead}>
            <View>
              <Text style={styles.progressCount}>
                {doneCount}
                <Text style={styles.progressOf}> / {rows.length}</Text>
              </Text>
              <Text style={styles.progressLabel}>
                {doneCount === rows.length ? nav.allDone : nav.stepsDoneToday}
              </Text>
            </View>
            <View style={styles.progressBadge}>
              <Icon
                name={doneCount === rows.length ? 'check-circle' : 'calendar'}
                size={22}
                tint={color.primary}
              />
            </View>
          </View>
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${(doneCount / rows.length) * 100}%` }]} />
          </View>
        </GlassCard>
      ) : null}

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

      {/* ---- Tasks -------------------------------------------------------- */}
      {groups.length === 0 ? (
        <GlassCard tone="strong">
          <View style={styles.empty}>
            <Icon name={rows.length === 0 ? 'calendar' : 'smile'} size={22} tint={color.primary} />
            <Text style={styles.emptyText}>{emptyMessage}</Text>
          </View>
        </GlassCard>
      ) : (
        groups.map((group) => (
          <View key={group.when} style={styles.group}>
            <View style={styles.groupHead}>
              <Icon name={group.when === 'am' ? 'sun' : 'moon'} size={15} tint={color.textMuted} />
              <Text style={styles.groupTitle}>
                {(group.when === 'am' ? nav.morningRoutine : nav.eveningRoutine).toUpperCase()}
              </Text>
            </View>
            <View style={styles.list}>
              {group.rows.map((row) => (
                <CheckRow
                  key={row.id}
                  icon={STEP_ICON[row.step.step]}
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
          </View>
        ))
      )}

      {/* The server's own "start slowly" guidance, not a guide this screen
          invented. If the server sends nothing, nothing is shown. */}
      {c.startSlowly ? (
        <View style={styles.guide}>
          <SectionHeader title={nav.careOverview} />
          <GuideCard title={c.heading} body={c.startSlowly} icon="book-open" />
        </View>
      ) : null}

      <Text style={styles.claim}>{copy.reviewClaim}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dateBlock: { marginTop: 4 },
  weekday: { ...type.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.6, color: color.text },
  dayMonth: { ...type.body, fontSize: 15, lineHeight: 21, color: color.textMuted, marginTop: 1 },

  week: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
    backgroundColor: color.glassStrong,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.glassBorder,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  weekDay: { flex: 1, alignItems: 'center', gap: 6 },
  weekLetter: { ...type.small, fontSize: 11, lineHeight: 14, fontWeight: '600', color: color.textFaint },
  weekLetterToday: { color: color.primary },
  weekNumberWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  weekNumberWrapToday: { backgroundColor: color.primary },
  weekNumber: { ...type.bodyStrong, fontSize: 14, lineHeight: 18, color: color.textMuted },
  weekNumberToday: { color: color.onPrimary },

  progressCard: { marginTop: 14 },
  progressHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressCount: { ...type.display, fontSize: 30, lineHeight: 36, color: color.text },
  progressOf: { fontSize: 18, fontWeight: '400', color: color.textFaint },
  progressLabel: { ...type.small, fontSize: 12.5, lineHeight: 17, color: color.textMuted },
  progressBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.primarySoft,
  },
  bar: { height: 6, borderRadius: 3, backgroundColor: color.line, marginTop: 14, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: color.primary },

  filters: { marginTop: 20, marginBottom: 6 },

  group: { marginTop: 16 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, marginLeft: 2 },
  groupTitle: { ...type.small, fontSize: 11, lineHeight: 15, letterSpacing: 1.1, fontWeight: '600', color: color.textMuted },
  list: { gap: 9 },

  empty: { alignItems: 'center', gap: 8, paddingVertical: 6 },
  emptyText: { ...type.body, fontSize: 15, lineHeight: 22, color: color.textMuted, textAlign: 'center' },
  guide: { marginTop: 28 },
  claim: { ...type.small, fontSize: 11.5, lineHeight: 16, color: color.textFaint, marginTop: 26, textAlign: 'center' },
});
