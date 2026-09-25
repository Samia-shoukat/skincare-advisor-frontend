/**
 * Limitations acknowledgement. FR-ONB-007.
 *
 * The statement is fetched, never hard-coded. FR-ONB-007's rationale is blunt
 * about why: a consent statement that misdescribes what the system does
 * provides no protection. Keeping one copy on the server means the text a user
 * agrees to is the text that was reviewed.
 *
 * The version displayed is sent back with the acknowledgement rather than the
 * server using its own current value. That closes a real gap — the statement
 * being updated between this screen rendering and the user tapping accept. A
 * consent record for text the user never read is worse than no record.
 *
 * The accept control stays disabled until the user has scrolled to the end.
 * A checkbox at the top of unread text records a tap, not an acknowledgement.
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, LinkButton } from '../../components/ui';
import { StepDots } from '../../components/StepDots';
import { ApiError, api, StringsBundle } from '../../lib/api';
import { openLegalPage } from '../../lib/legal';
import { color, radius, space, type } from '../../lib/theme';

export function ConsentScreen({
  token,
  onDone,
}: {
  token: string;
  onDone: () => Promise<void>;
}) {
  const [statement, setStatement] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [legal, setLegal] = useState<StringsBundle['legal'] | null>(null);
  const [readToEnd, setReadToEnd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getStrings()
      .then((bundle) => {
        setStatement(bundle.limitationsStatement);
        setVersion(bundle.consentVersion);
        setLegal(bundle.legal);
      })
      .catch(() => setError('Could not load the terms. Check your connection.'));
  }, []);

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    // 24px of slack: on some devices the final pixel is never reported.
    const atEnd = layoutMeasurement.height + contentOffset.y >= contentSize.height - 24;
    if (atEnd) setReadToEnd(true);
  }

  function onContentSizeChange(_: number, height: number) {
    // Short statement on a tall screen — there is nothing to scroll, so
    // requiring a scroll would leave the button permanently disabled.
    if (height < 320) setReadToEnd(true);
  }

  async function accept() {
    if (!version) return;
    setBusy(true);
    setError(null);
    try {
      await api.recordConsent(token, version);
      await onDone();
    } catch (e) {
      // A 409 means the statement changed while this screen was open. Reload
      // so the user reads the current text rather than agreeing to stale text.
      setError(e instanceof ApiError ? e.message : 'Could not save. Try again.');
      if (e instanceof ApiError && e.errorCode === 'CONSENT_VERSION_MISMATCH') {
        const bundle = await api.getStrings().catch(() => null);
        if (bundle) {
          setStatement(bundle.limitationsStatement);
          setVersion(bundle.consentVersion);
          setReadToEnd(false);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <LinearGradient colors={color.gradient} style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
        <View style={styles.head}>
          <StepDots current={4} />
          <Text style={styles.heading}>Before you start</Text>
        </View>

        {statement ? (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollInner}
            onScroll={onScroll}
            onContentSizeChange={onContentSizeChange}
            scrollEventThrottle={16}
          >
            <Text style={styles.statement}>{statement}</Text>
          </ScrollView>
        ) : (
          <View style={styles.loading}>
            {error ? (
              <Text style={styles.error}>{error}</Text>
            ) : (
              <ActivityIndicator color={color.brand} />
            )}
          </View>
        )}

        <View style={styles.footer}>
          {error && statement ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            label="I understand"
            onPress={accept}
            loading={busy}
            disabled={!readToEnd || !version}
          />
          {!readToEnd && statement ? (
            <Text style={styles.footnote}>Scroll to the end to continue.</Text>
          ) : null}
          {legal ? (
            <View style={styles.links}>
              <LinkButton label="Privacy policy" onPress={() => openLegalPage(legal.privacyPath)} />
              <LinkButton label="Terms of use" onPress={() => openLegalPage(legal.termsPath)} />
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  head: { paddingHorizontal: space.lg, paddingTop: space.xl },
  heading: { ...type.display, color: color.textOnDark, marginBottom: space.lg },
  scroll: { flex: 1, marginHorizontal: space.lg },
  scrollInner: {
    backgroundColor: color.surface,
    borderRadius: radius.field,
    padding: space.md,
  },
  statement: { ...type.body, color: color.textOnDark },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.md,
    gap: space.sm,
  },
  footnote: { ...type.small, color: color.textFaint, textAlign: 'center' },
  links: { flexDirection: 'row', justifyContent: 'center', gap: space.lg },
  error: { ...type.small, color: color.danger, textAlign: 'center' },
});