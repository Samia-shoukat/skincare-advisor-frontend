/**
 * App chrome: a screen shell, a header, and a floating glass tab bar.
 *
 * Replaces the earlier pattern of one long scrolling page per state. Screens
 * now say what they are (`title`), how to leave (`onBack`), and whether they
 * belong to a tab — which is what makes the app navigable rather than readable.
 *
 * ## Why not a navigation library
 *
 * React Navigation would mean new native modules and a rebuilt dev client, for
 * a signed-in area with four tabs and four sub-screens. The state that decides
 * the screen already lives in one place, and Android back is already handled by
 * `useBackHandler`. This is the smaller change; a library earns its place when
 * the screen graph outgrows one file.
 *
 * `onBack` is the on-screen arrow only. The hardware back button is wired
 * separately by each screen, so the two can differ where they should — mid-scan,
 * hardware back cancels the step rather than leaving the camera.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton } from './glass';
import { color, radius, shadow, space, type } from '../lib/theme';

export type TabKey = 'home' | 'routine' | 'today' | 'account';

export interface TabDefinition {
  key: TabKey;
  icon: string;
  label: string;
}

/**
 * Back arrow (or a custom left slot), title, and an optional action.
 *
 * A screen with no title and no actions renders nothing, so the body starts at
 * the top of the safe area instead of below an empty bar.
 */
export function Header({
  title,
  onBack,
  left,
  right,
}: {
  title?: string;
  onBack?: () => void;
  left?: React.ReactNode;
  right?: React.ReactNode;
}) {
  if (!title && !onBack && !right && !left) return null;

  const leading = onBack ? (
    <IconButton glyph="←" label="Go back" onPress={onBack} />
  ) : (
    left ?? <View style={styles.slot} />
  );

  return (
    <View style={styles.header}>
      {leading}
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title ?? ''}
      </Text>
      <View style={styles.headerRight}>{right ?? <View style={styles.slot} />}</View>
    </View>
  );
}

/**
 * One screen: gradient ground, optional header, scrolling body, and either a
 * pinned footer or the tab bar.
 *
 * `footer` sits outside the ScrollView, which is what FR-REC-007 needs on the
 * routine screen — the disclaimer stays on screen at any scroll position.
 */
export function Screen({
  children,
  title,
  onBack,
  headerLeft,
  headerRight,
  footer,
  tabs,
  activeTab,
  onTabPress,
  scroll = true,
}: {
  children: React.ReactNode;
  title?: string;
  onBack?: () => void;
  headerLeft?: React.ReactNode;
  headerRight?: React.ReactNode;
  footer?: React.ReactNode;
  tabs?: TabDefinition[];
  activeTab?: TabKey;
  onTabPress?: (key: TabKey) => void;
  scroll?: boolean;
}) {
  const showTabs = !!(tabs && activeTab && onTabPress);

  const body = scroll ? (
    <ScrollView
      // Only when the tab bar is the bottom-most thing. With a footer present
      // the footer already reserves that space, and adding it twice leaves a
      // dead band at the end of the scroll.
      contentContainerStyle={[styles.scrollBody, showTabs && !footer && styles.scrollBodyWithTabs]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.plainBody}>{children}</View>
  );

  return (
    <LinearGradient colors={color.gradient} style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
        <Header title={title} onBack={onBack} left={headerLeft} right={headerRight} />
        {body}
        {/* The tab bar is absolutely positioned, so a footer needs to be lifted
            clear of it or it renders underneath. On the routine screen that
            footer carries the FR-REC-007 disclaimer, which has to stay visible
            at any scroll position -- covered by the tab bar is not visible. */}
        {footer ? (
          <View style={[styles.footer, showTabs && styles.footerWithTabs]}>{footer}</View>
        ) : null}
        {showTabs ? <TabBar tabs={tabs!} active={activeTab!} onPress={onTabPress!} /> : null}
      </SafeAreaView>
    </LinearGradient>
  );
}

/**
 * The tab bar floats: inset from the edges with the wash visible around it,
 * rather than a bar welded to the bottom of the screen.
 *
 * The selected tab gets a filled bubble behind its icon as well as a colour
 * and weight change on the label. Colour alone would be the only signal for
 * someone who cannot distinguish it, and the bubble is a shape change that
 * does not depend on hue (IF-UI-003).
 */
function TabBar({
  tabs,
  active,
  onPress,
}: {
  tabs: TabDefinition[];
  active: TabKey;
  onPress: (key: TabKey) => void;
}) {
  return (
    <View style={[styles.tabBar, shadow.lifted]}>
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onPress(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={tab.label}
            style={styles.tab}
          >
            <View style={[styles.tabIconWrap, selected && styles.tabIconWrapActive]}>
              <Text style={styles.tabIcon}>{tab.icon}</Text>
            </View>
            <Text style={[styles.tabLabel, selected && styles.tabLabelActive]} numberOfLines={1}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Two- or three-option switch, e.g. Morning / Evening, or Today / Upcoming. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <View style={styles.segment}>
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[styles.segmentOption, selected && styles.segmentOptionActive]}
          >
            <Text
              style={[styles.segmentLabel, selected && styles.segmentLabelActive]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // 20, not the 24 of the spacing scale: measured from the approved design.
  scrollBody: { paddingHorizontal: 20, paddingBottom: space.xl },
  // Clears the floating bar, which is not in the scroll flow.
  scrollBodyWithTabs: { paddingBottom: 104 },
  plainBody: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 8,
    gap: space.sm,
  },
  slot: { width: 38 },
  headerTitle: {
    ...type.title,
    fontSize: 19,
    lineHeight: 25,
    color: color.text,
    flex: 1,
    textAlign: 'center',
  },
  headerRight: { minWidth: 38, alignItems: 'flex-end' },

  footer: {
    paddingHorizontal: 20,
    paddingTop: space.md,
    paddingBottom: space.sm,
    gap: space.sm,
  },
  // Clears the floating tab bar: its height plus the inset it sits on.
  footerWithTabs: { paddingBottom: 88 },

  tabBar: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 14,
    flexDirection: 'row',
    backgroundColor: color.glassStrong,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.glassBorder,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  tab: { flex: 1, alignItems: 'center' },
  tabIconWrap: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  tabIconWrapActive: { backgroundColor: color.primarySoft },
  tabIcon: { fontSize: 16 },
  tabLabel: { ...type.small, fontSize: 10.5, lineHeight: 14, color: color.textMuted, marginTop: 2 },
  tabLabelActive: { color: color.primary, fontWeight: '600' },

  segment: {
    flexDirection: 'row',
    backgroundColor: color.glass,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.glassBorder,
    padding: 4,
    gap: 4,
  },
  segmentOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
  },
  segmentOptionActive: { backgroundColor: color.surface, ...shadow.card },
  segmentLabel: { ...type.small, fontSize: 13, lineHeight: 18, fontWeight: '600', color: color.textMuted },
  segmentLabelActive: { color: color.primary },
});
