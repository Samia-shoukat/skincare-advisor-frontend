/**
 * Referral screen. FR-TRI-003, FR-TRI-005.
 *
 * Two variants, chosen by `referral.kind`:
 *
 *   DECLARED (FR-TRI-001) -- the user's own safety answers call for an
 *   in-person assessment. No photo was taken. The general message only: no
 *   observation, no association list.
 *
 *   OBSERVED (FR-TRI-002) -- the photo showed something outside cosmetic scope.
 *   The observation for each finding, and an association list only where the
 *   server sent one.
 *
 * ## What this screen must never show
 *
 * FR-TRI-003: no treatment, no ingredient, no product. There is no routine on
 * this screen and no route from it to one -- `onDone` returns to the scan home,
 * which the server has already told cannot produce a routine for this scan.
 *
 * ## The association list
 *
 * In release 1.0 the server never sends one (every Appendix H row is disabled),
 * so this branch does not render today. It is built rather than stubbed so that
 * enabling a row server-side needs no client release, and it is built to the
 * letter of FR-TRI-003 because that is when it will matter:
 *
 *   - opened and closed by the fixed server strings, never by anything local;
 *   - every name at the same size and weight, in the order received, with no
 *     numbering and no bullets that could read as a ranking -- ranking a
 *     differential converts it back into a single label.
 *
 * All copy is from the server string bundle (IF-UI-001).
 */

import React, { useEffect, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';

import { Body, Button, Card, FormScreen, Heading } from '../components/ui';
import { api, Referral, StringsBundle } from '../lib/api';
import { color, radius, space, type } from '../lib/theme';

interface Props {
  referral: Referral;
  onDone: () => void;
}

export function ReferralScreen({ referral, onDone }: Props) {
  const [copy, setCopy] = useState<StringsBundle | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  useEffect(() => {
    api.getStrings().then(setCopy).catch(() => setCopy(null));
  }, []);

  if (!copy) {
    // Nothing rendered until the fixed copy arrives. A referral screen missing
    // its interim guidance or its "only a dermatologist" line is a screen
    // FR-TRI-003 does not permit, so a blank moment is the better failure.
    return <FormScreen>{null}</FormScreen>;
  }

  const shareSummary = async () => {
    setShareError(null);
    try {
      // The system share sheet rather than a clipboard module. Both Android and
      // iOS offer "Copy" in it, it can send straight to a clinic, and it needs
      // no new native dependency -- adding one would mean rebuilding the dev
      // client. The summary text is also selectable below, for copying by hand.
      await Share.share({ message: referral.summary });
    } catch {
      setShareError(copy.referralScreen.share);
    }
  };

  const observed = referral.kind === 'OBSERVED' && referral.signals.length > 0;

  return (
    <FormScreen
      footer={
        <>
          <Button label={copy.referralScreen.share} onPress={shareSummary} />
          <Button label="Done" tone="outline" onPress={onDone} />
        </>
      }
    >
      <Heading>{copy.referralScreen.heading}</Heading>

      {observed ? (
        <>
          <Body muted>{copy.referralScreen.observedIntro}</Body>
          {referral.signals.map((signal, index) => (
            <Card key={index}>
              <Text style={styles.observation}>{signal.observation}</Text>

              {/* FR-AI-007 / FR-TRI-003. Only when the server sent names. */}
              {signal.associations && signal.associations.length >= 2 ? (
                <View style={styles.associations}>
                  <Text style={styles.framing}>{copy.referral.associationIntro}</Text>
                  <View style={styles.nameRow}>
                    {signal.associations.map((name) => (
                      <Text key={name} style={styles.name}>
                        {name}
                      </Text>
                    ))}
                  </View>
                  <Text style={styles.framing}>{copy.referral.associationOutro}</Text>
                </View>
              ) : null}
            </Card>
          ))}
        </>
      ) : (
        <Body>{copy.referral.general}</Body>
      )}

      {/* FR-TRI-003: on every referral screen, with or without findings. */}
      <View style={styles.notice}>
        <Text style={styles.noticeText}>{copy.referral.interimGuidance}</Text>
      </View>

      {/* FR-TRI-005 */}
      <Text style={styles.sectionHeading}>{copy.referralScreen.summaryHeading}</Text>
      <View style={styles.summary}>
        <Text selectable style={styles.summaryText}>
          {referral.summary}
        </Text>
      </View>
      {shareError ? <Text style={styles.error}>{shareError}</Text> : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  observation: { ...type.body, color: color.text },
  associations: { marginTop: space.md, gap: space.sm },
  framing: { ...type.small, color: color.textMuted },
  // Wrapped, unnumbered, identical styling for every name: equal prominence.
  nameRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  name: {
    ...type.body,
    color: color.text,
    backgroundColor: color.surfaceRaised,
    borderRadius: radius.pill,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
  },
  notice: {
    backgroundColor: color.attentionSoft,
    borderLeftWidth: 3,
    borderLeftColor: color.attention,
    borderRadius: radius.field,
    padding: space.md,
    marginTop: space.lg,
  },
  noticeText: { ...type.body, color: color.text },
  sectionHeading: { ...type.title, color: color.text, marginTop: space.xl, marginBottom: space.sm },
  summary: {
    backgroundColor: color.surface,
    borderColor: color.line,
    borderWidth: 1,
    borderRadius: radius.field,
    padding: space.md,
  },
  summaryText: { ...type.small, color: color.text },
  error: { ...type.small, color: color.danger, marginTop: space.sm },
});
