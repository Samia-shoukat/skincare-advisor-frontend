/**
 * Capture gate spike. FR-CAM-001, FR-CAM-002.
 *
 * Frame-processor path. The still-sampling path (expo-camera +
 * takePictureAsync) measured 0 evaluations/sec and 8-13fps preview in
 * Expo Go — both fail the requirement. This path uses
 * react-native-vision-camera's native frame processor instead: frames are
 * read on the native side, on a background thread, without ever encoding a
 * JPEG or writing a file. Requires a development build.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';

import { Button } from '../components/ui';
import {
  CaptureIssue,
  DEFAULT_THRESHOLDS,
  FrameMetrics,
  evaluateFrame,
} from '../lib/captureGate';
import { useCaptureFrameProcessor, FrameSampleResult } from '../lib/frameSource';
import { color, radius, space, type } from '../lib/theme';

const PROMPT: Record<CaptureIssue, string> = {
  NO_FACE: 'Center your face in the frame',
  TOO_DARK: 'Move to brighter light',
  TOO_BRIGHT: 'Too much light — turn away from the window',
  BLURRY: 'Hold the phone steady',
};

interface Stats {
  evalsPerSecond: number;
  avgSampleMs: number;
  previewFps: number;
  samplesTaken: number;
}

export function CaptureSpikeScreen({ onExit }: { onExit: () => void }) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');

  const [running, setRunning] = useState(false);
  const [metrics, setMetrics] = useState<FrameMetrics | null>(null);
  const [issue, setIssue] = useState<CaptureIssue | null>(null);
  const [stats, setStats] = useState<Stats>({
    evalsPerSecond: 0,
    avgSampleMs: 0,
    previewFps: 0,
    samplesTaken: 0,
  });

  // Refs, not state: written every sample / every preview frame. Reading
  // through state here would re-render several times a second and depress
  // the very numbers being measured.
  const counters = useRef({ evals: 0, totalMs: 0, windowStart: Date.now() });
  const previewFrames = useRef(0);

  const frameProcessor = useCaptureFrameProcessor((result: FrameSampleResult) => {
    counters.current.evals++;
    counters.current.totalMs += result.elapsedMs;
    previewFrames.current++; // frame processor runs on every preview frame
    setMetrics(result.metrics);
    setIssue(evaluateFrame(result.metrics));
  }, 3);

  /** Roll counters into displayed stats once a second. */
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const c = counters.current;
      const elapsed = (Date.now() - c.windowStart) / 1000;
      if (elapsed <= 0) return;

      setStats((prev) => ({
        evalsPerSecond: c.evals / elapsed,
        avgSampleMs: c.evals > 0 ? c.totalMs / c.evals : 0,
        // The frame processor callback fires once per preview frame
        // regardless of the runAtTargetFps cap inside it, so this is a
        // reasonable proxy for preview fps without a separate counter.
        previewFps: previewFrames.current / elapsed,
        samplesTaken: prev.samplesTaken + c.evals,
      }));

      counters.current = { evals: 0, totalMs: 0, windowStart: Date.now() };
      previewFrames.current = 0;
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  if (!hasPermission) {
    return (
      <View style={styles.centre}>
        <Text style={styles.heading}>Camera access needed</Text>
        <Text style={styles.body}>
          The capture gate has to look at the preview to tell you whether a
          photo will be usable.
        </Text>
        <View style={styles.actions}>
          <Button label="Allow camera" onPress={requestPermission} />
          <Button label="Back" tone="outline" onPress={onExit} />
        </View>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.centre}>
        <Text style={styles.heading}>No front camera found</Text>
        <Button label="Back" tone="outline" onPress={onExit} />
      </View>
    );
  }

  const rateOk = stats.evalsPerSecond >= 2.5;
  const fpsOk = stats.previewFps >= 24;

  return (
    <View style={styles.fill}>
      <Camera
        style={styles.preview}
        device={device}
        isActive={running}
        frameProcessor={running ? frameProcessor : undefined}
        pixelFormat="yuv"
      />

      <View style={[styles.prompt, metrics !== null && !issue && styles.promptOk]}>
        <Text style={styles.promptText}>
          {metrics === null ? 'Checking…' : issue ? PROMPT[issue] : 'Looks good'}
        </Text>
      </View>

      <View style={styles.panel}>
        <Row label="Evaluations / sec" value={stats.evalsPerSecond.toFixed(2)} target="3.00" ok={rateOk} />
        <Row label="Preview fps" value={stats.previewFps.toFixed(0)} target="≥ 24" ok={fpsOk} />
        <Row
          label="Sample time"
          value={`${stats.avgSampleMs.toFixed(0)} ms`}
          target="< 333"
          ok={stats.avgSampleMs > 0 && stats.avgSampleMs < 333}
        />

        <View style={styles.divider} />

        <Row label="Brightness" value={metrics ? metrics.meanLuma.toFixed(0) : '—'}
             target={`${DEFAULT_THRESHOLDS.minLuma}–${DEFAULT_THRESHOLDS.maxLuma}`} ok />
        <Row label="Variance" value={metrics ? metrics.lumaVariance.toFixed(0) : '—'}
             target={`> ${DEFAULT_THRESHOLDS.minLumaVariance}`} ok />
        <Row label="Sharpness" value={metrics ? metrics.sharpness.toFixed(1) : '—'}
             target={`> ${DEFAULT_THRESHOLDS.minSharpness}`} ok />

        <Text style={styles.platform}>{Platform.OS} · frame-processor path</Text>

        <View style={styles.actions}>
          <Button label={running ? 'Stop' : 'Start measuring'} onPress={() => setRunning((r) => !r)} />
          <Button label="Back" tone="outline" onPress={onExit} />
        </View>
      </View>
    </View>
  );
}

function Row({ label, value, target, ok }: { label: string; value: string; target: string; ok: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, !ok && styles.rowValueBad]}>{value}</Text>
      <Text style={styles.rowTarget}>{target}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.ground },
  centre: { flex: 1, justifyContent: 'center', padding: space.lg, backgroundColor: color.ground },
  heading: { ...type.display, color: color.text, marginBottom: space.sm },
  body: { ...type.body, color: color.textMuted, marginBottom: space.xl },
  preview: { flex: 1 },
  prompt: {
    position: 'absolute',
    top: space.xxl,
    left: space.lg,
    right: space.lg,
    backgroundColor: 'rgba(62,50,38,0.82)',
    borderRadius: radius.pill,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  promptOk: { backgroundColor: 'rgba(78,107,74,0.9)' },
  promptText: { ...type.bodyStrong, color: color.onPrimary },
  panel: {
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    padding: space.lg,
    gap: space.xs,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
  rowLabel: { ...type.small, color: color.textMuted, flex: 1.4 },
  rowValue: { ...type.bodyStrong, color: color.primary, flex: 1, textAlign: 'right' },
  rowValueBad: { color: color.danger },
  rowTarget: { ...type.small, color: color.textFaint, flex: 1, textAlign: 'right' },
  divider: { height: 1, backgroundColor: color.line, marginVertical: space.sm },
  platform: { ...type.small, color: color.textFaint, marginTop: space.sm },
  actions: { marginTop: space.md, gap: space.sm },
});