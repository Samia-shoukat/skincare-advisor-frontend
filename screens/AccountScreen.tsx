/**
 * Profile. DR-002, and Google Play's account-deletion requirement.
 *
 * A header with the user's avatar and name, then the menu in two groups --
 * "My skin" (skin profile, progress tracker, favourites) and "General" (app
 * settings, help) -- then sign out. Each menu row opens a sub-screen here, so
 * the Profile tab owns its own small stack rather than adding routes to the
 * signed-in shell.
 *
 * ## What is real and what is marked "Soon"
 *
 * A row that does nothing teaches the user that rows here might not work. So
 * every row either works or says plainly that it does not yet:
 *
 *   My skin profile   -- works. Shows the skin type and what the scan noticed.
 *                        "Retake quiz" is shown but disabled: the server stores
 *                        skin type once and refuses a second answer
 *                        (ImmutableField), so offering it would fail.
 *   Progress tracker  -- Soon. Before/after photos mean keeping face photos,
 *                        which the zero-save rule forbids on the server. It
 *                        needs an on-device design first.
 *   Favorite products -- works. Device-local; see lib/favorites.ts.
 *   App settings      -- works. Privacy policy, terms, and account deletion.
 *   Help & support    -- works. Opens an email to the support address.
 *
 * ## Deletion is two steps, and all or nothing
 *
 * Step one explains exactly what goes; step two is an explicit confirm. The
 * server deletes every row and the Supabase sign-in, or -- if the sign-in
 * cannot be removed -- nothing at all (ACCOUNT_DELETION_FAILED), so the user is
 * never left with a half-deleted account. Only after the server confirms is the
 * saved routine cleared from the phone and the user signed out.
 *
 * Claim copy is from the server string bundle (IF-UI-001). The menu labels are
 * navigation chrome.
 */

import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar, GlassCard, StatusPill } from '../components/glass';
import { Icon, IconName } from '../components/Icon';
import { Screen } from '../components/navigation';
import { Button, Heading } from '../components/ui';
import { api, ApiError, Routine, StringsBundle } from '../lib/api';
import { initials } from '../lib/displayName';
import type { Favorite } from '../lib/favorites';
import { openLegalPage } from '../lib/legal';
import { clearRoutine } from '../lib/routineCache';
import { color, radius, shadow, space, type } from '../lib/theme';
import { useBackHandler } from '../lib/useBackHandler';

interface Props {
  token: string;
  userId: string;
  copy: StringsBundle;
  /** From the Supabase session. See lib/displayName.ts. */
  name: string | null;
  email: string | null;
  skinType: string | null;
  scansRemaining: number | null;
  /** For the skin profile's "what we noticed". Null before a first scan. */
  routine: Routine | null;
  favorites: Favorite[];
  onRemoveFavorite: (productId: string) => void;
  onBack: () => void;
  /** Signs out and clears everything this account left on the phone. */
  onSignOut: () => void;
  /** Tab bar wiring, so Profile reads as a tab rather than a dead end. */
  shell?: {
    tabs: React.ComponentProps<typeof Screen>['tabs'];
    activeTab: React.ComponentProps<typeof Screen>['activeTab'];
    onTabPress: React.ComponentProps<typeof Screen>['onTabPress'];
  };
}

type Stage = 'menu' | 'skin' | 'favorites' | 'settings' | 'confirm' | 'deleting' | 'deleted';

export function AccountScreen({
  token,
  userId,
  copy,
  name,
  email,
  skinType,
  scansRemaining,
  routine,
  favorites,
  onRemoveFavorite,
  onBack,
  onSignOut,
  shell,
}: Props) {
  const [stage, setStage] = useState<Stage>('menu');
  const [error, setError] = useState<string | null>(null);
  const a = copy.account;
  const c = copy.routineScreen;
  const skinLabel = skinType ? c.skinTypeLabels[skinType] : null;

  useBackHandler(() => {
    if (stage === 'deleting') return true; // don't abandon a request in flight
    if (stage === 'confirm') {
      setStage('settings');
      return true;
    }
    if (stage === 'deleted') {
      onSignOut();
      return true;
    }
    if (stage !== 'menu') {
      setStage('menu');
      return true;
    }
    onBack();
    return true;
  });

  const deleteAccount = async () => {
    setStage('deleting');
    setError(null);
    try {
      await api.deleteAccount(token);
      await clearRoutine(userId);
      setStage('deleted');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Nothing was deleted.');
      setStage('confirm');
    }
  };

  const toMenu = () => setStage('menu');

  // ---- deletion ------------------------------------------------------------

  if (stage === 'deleted') {
    return (
      <Screen title={a.deleteHeading} footer={<Button label="Done" onPress={onSignOut} />}>
        <Heading>{a.deleted}</Heading>
      </Screen>
    );
  }

  if (stage === 'confirm' || stage === 'deleting') {
    return (
      <Screen
        title={a.deleteHeading}
        onBack={stage === 'deleting' ? undefined : () => setStage('settings')}
        footer={
          <>
            <Button
              label={a.deleteConfirm}
              tone="primary"
              onPress={deleteAccount}
              loading={stage === 'deleting'}
            />
            <Button
              label="Keep my account"
              tone="outline"
              onPress={() => setStage('settings')}
              disabled={stage === 'deleting'}
            />
          </>
        }
      >
        <Heading>{a.deleteHeading}</Heading>
        <View style={styles.warning}>
          <Text style={styles.warningText}>{a.deleteBody}</Text>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Screen>
    );
  }

  // ---- sub-screens ---------------------------------------------------------

  if (stage === 'skin') {
    return (
      <Screen title="My skin profile" onBack={toMenu}>
        <GlassCard tone="strong" style={styles.skinHero}>
          <View style={styles.skinHeroIcon}>
            <Icon name="droplet" size={24} tint={color.primary} />
          </View>
          <Text style={styles.eyebrow}>{c.skinTypeLabel.toUpperCase()}</Text>
          <Text style={styles.skinHeroValue}>{skinLabel ?? '—'}</Text>
          <Text style={styles.muted}>From your skin quiz answers</Text>
        </GlassCard>

        {routine?.concerns.length ? (
          <View style={styles.block}>
            <Text style={styles.groupLabel}>{c.concernsLabel.toUpperCase()}</Text>
            <View style={styles.pills}>
              {routine.concerns.map((entry) => (
                <StatusPill
                  key={entry.concernId}
                  label={[
                    c.concernLabels[entry.concernId] ?? entry.concernId,
                    c.severityLabels[entry.severity],
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.block}>
          <MenuGroup>
            <MenuRow
              icon="refresh-cw"
              title="Retake quiz"
              caption="Not available yet — your skin type is set once"
              soon
            />
          </MenuGroup>
        </View>
      </Screen>
    );
  }

  if (stage === 'favorites') {
    return (
      <Screen title="Favorite products" onBack={toMenu}>
        {favorites.length === 0 ? (
          <GlassCard tone="strong">
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Icon name="heart" size={22} tint={color.primary} />
              </View>
              <Text style={styles.emptyTitle}>No favorites yet</Text>
              <Text style={styles.emptyBody}>
                Tap the heart on any product in My Routine to keep it here.
              </Text>
            </View>
          </GlassCard>
        ) : (
          <View style={styles.favList}>
            {favorites.map((item) => (
              <View key={item.id} style={[styles.favRow, shadow.card]}>
                <View style={styles.rowIcon}>
                  <Icon name="heart" size={17} tint={color.primary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {item.brand}
                  </Text>
                  <Text style={styles.rowCaption} numberOfLines={2}>
                    {item.name}
                    {item.stepLabel ? ` · ${item.stepLabel}` : ''}
                  </Text>
                </View>
                <Pressable
                  onPress={() => onRemoveFavorite(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.brand} ${item.name} from favorites`}
                  hitSlop={10}
                  style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}
                >
                  <Icon name="x" size={16} tint={color.textMuted} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </Screen>
    );
  }

  if (stage === 'settings') {
    return (
      <Screen title="App settings" onBack={toMenu}>
        <Text style={styles.groupLabel}>PRIVACY & LEGAL</Text>
        <MenuGroup>
          <MenuRow
            icon="lock"
            title="Privacy policy"
            onPress={() => openLegalPage(copy.legal.privacyPath)}
          />
          <MenuRow
            icon="file-text"
            title="Terms of use"
            onPress={() => openLegalPage(copy.legal.termsPath)}
          />
        </MenuGroup>

        <Text style={[styles.groupLabel, styles.groupLabelSpaced]}>ACCOUNT</Text>
        <MenuGroup>
          <MenuRow
            icon="trash-2"
            title={a.deleteHeading}
            caption="Removes your profile, scans and routine"
            danger
            onPress={() => setStage('confirm')}
          />
        </MenuGroup>
      </Screen>
    );
  }

  // ---- menu ----------------------------------------------------------------

  return (
    <Screen title={copy.nav.profile} {...(shell ?? {})}>
      <GlassCard tone="strong" style={styles.header}>
        <Avatar initials={initials(name)} size={88} />
        {name ? <Text style={styles.name}>{name}</Text> : null}
        {email ? <Text style={styles.email}>{email}</Text> : null}
        <View style={styles.headerPills}>
          {skinLabel ? <StatusPill label={`${c.skinTypeLabel}: ${skinLabel}`} /> : null}
          {scansRemaining != null ? (
            <StatusPill
              tone="neutral"
              label={`${scansRemaining} ${scansRemaining === 1 ? 'scan left' : 'scans left'}`}
            />
          ) : null}
        </View>
      </GlassCard>

      <Text style={[styles.groupLabel, styles.groupLabelSpaced]}>MY SKIN</Text>
      <MenuGroup>
        <MenuRow
          icon="droplet"
          title="My skin profile"
          caption={skinLabel ? `${skinLabel} · Retake quiz` : 'Retake quiz'}
          onPress={() => setStage('skin')}
        />
        <MenuRow icon="image" title="Progress tracker" caption="Before & after photos" soon />
        <MenuRow
          icon="heart"
          title="Favorite products"
          caption={
            favorites.length === 0
              ? 'Nothing saved yet'
              : `${favorites.length} saved`
          }
          onPress={() => setStage('favorites')}
        />
      </MenuGroup>

      <Text style={[styles.groupLabel, styles.groupLabelSpaced]}>GENERAL</Text>
      <MenuGroup>
        <MenuRow
          icon="settings"
          title="App settings"
          caption="Privacy, legal & account"
          onPress={() => setStage('settings')}
        />
        <MenuRow
          icon="help-circle"
          title="Help & support"
          caption={copy.supportEmail}
          onPress={() => Linking.openURL(`mailto:${copy.supportEmail}`)}
        />
      </MenuGroup>

      <Pressable
        onPress={onSignOut}
        accessibilityRole="button"
        style={({ pressed }) => [styles.signOut, shadow.card, pressed && styles.pressed]}
      >
        <Icon name="log-out" size={17} tint={color.primary} />
        <Text style={styles.signOutLabel}>Sign out</Text>
      </Pressable>
    </Screen>
  );
}

// ---------------------------------------------------------------------------

/** A card of rows with inset hairlines between them. */
function MenuGroup({ children }: { children: React.ReactNode }) {
  const rows = React.Children.toArray(children);
  return (
    <View style={[styles.group, shadow.card]}>
      {rows.map((row, index) => (
        <View key={index}>
          {index > 0 ? <View style={styles.separator} /> : null}
          {row}
        </View>
      ))}
    </View>
  );
}

function MenuRow({
  icon,
  title,
  caption,
  onPress,
  soon,
  danger,
}: {
  icon: IconName;
  title: string;
  caption?: string;
  onPress?: () => void;
  /** Shown, but not yet built. Renders a "Soon" tag and takes no taps. */
  soon?: boolean;
  danger?: boolean;
}) {
  const disabled = soon || !onPress;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={soon ? `${title}, coming soon` : caption ? `${title}, ${caption}` : title}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={[styles.rowIcon, danger && styles.rowIconDanger, soon && styles.rowIconSoon]}>
        <Icon name={icon} size={17} tint={danger ? color.danger : soon ? color.textFaint : color.primary} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, danger && styles.rowTitleDanger, soon && styles.rowTitleSoon]}>
          {title}
        </Text>
        {caption ? (
          <Text style={styles.rowCaption} numberOfLines={1}>
            {caption}
          </Text>
        ) : null}
      </View>
      {soon ? (
        <Text style={styles.soon}>SOON</Text>
      ) : (
        <Icon name="chevron-right" size={18} tint={color.textFaint} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // --- header ---
  header: { alignItems: 'center', paddingTop: 26, paddingBottom: 22, marginTop: 4 },
  name: { ...type.display, fontSize: 25, lineHeight: 31, letterSpacing: -0.5, color: color.text, marginTop: 14, textAlign: 'center' },
  email: { ...type.small, fontSize: 13.5, lineHeight: 19, color: color.textMuted, marginTop: 2 },
  headerPills: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 14 },

  // --- groups and rows ---
  groupLabel: { ...type.small, fontSize: 11, lineHeight: 15, letterSpacing: 1.2, fontWeight: '600', color: color.textFaint, marginBottom: 8, marginLeft: 4 },
  groupLabelSpaced: { marginTop: 24 },
  group: {
    backgroundColor: color.glassStrong,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.glassBorder,
    overflow: 'hidden',
  },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: color.lineStrong, marginLeft: 66 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, paddingHorizontal: 16 },
  rowPressed: { backgroundColor: color.surfaceRaised },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.primarySoft,
  },
  rowIconDanger: { backgroundColor: '#FBEAEE' },
  rowIconSoon: { backgroundColor: color.surfaceRaised },
  rowText: { flex: 1 },
  rowTitle: { ...type.bodyStrong, fontSize: 15, lineHeight: 20, color: color.text },
  rowTitleDanger: { color: color.danger },
  rowTitleSoon: { color: color.textMuted },
  rowCaption: { ...type.small, fontSize: 12.5, lineHeight: 17, color: color.textMuted, marginTop: 1 },
  soon: {
    ...type.small,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.8,
    fontWeight: '700',
    color: color.primary,
    backgroundColor: color.primarySoft,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 8,
    overflow: 'hidden',
  },

  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 28,
    paddingVertical: 15,
    borderRadius: radius.pill,
    backgroundColor: color.glassStrong,
    borderWidth: 1,
    borderColor: color.glassBorder,
  },
  signOutLabel: { ...type.bodyStrong, fontSize: 15, lineHeight: 20, color: color.primary },
  pressed: { opacity: 0.8 },

  // --- skin profile ---
  skinHero: { alignItems: 'center', paddingVertical: 26, marginTop: 4 },
  skinHeroIcon: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.primarySoft,
    marginBottom: 14,
  },
  eyebrow: { ...type.small, fontSize: 11, lineHeight: 15, letterSpacing: 1.3, fontWeight: '600', color: color.textFaint },
  skinHeroValue: { ...type.display, fontSize: 30, lineHeight: 37, color: color.text, marginTop: 4 },
  muted: { ...type.small, fontSize: 13, lineHeight: 18, color: color.textMuted, marginTop: 4 },
  block: { marginTop: 24 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  // --- favorites ---
  favList: { gap: 10, marginTop: 4 },
  favRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: color.glassStrong,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.glassBorder,
    padding: 14,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surfaceRaised,
  },
  empty: { alignItems: 'center', paddingVertical: 10 },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.primarySoft,
    marginBottom: 12,
  },
  emptyTitle: { ...type.bodyStrong, fontSize: 16, lineHeight: 21, color: color.text },
  emptyBody: { ...type.small, fontSize: 13.5, lineHeight: 19, color: color.textMuted, textAlign: 'center', marginTop: 4, maxWidth: 260 },

  // --- deletion ---
  warning: {
    backgroundColor: color.attentionSoft,
    borderLeftWidth: 3,
    borderLeftColor: color.danger,
    borderRadius: radius.field,
    padding: space.md,
    marginTop: space.md,
  },
  warningText: { ...type.body, color: color.text },
  error: { ...type.small, color: color.danger, marginTop: space.md },
});
