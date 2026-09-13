/**
 * Capture gate spike. FR-CAM-001, FR-CAM-002.
 *
 * Not a product screen. This exists to answer one question that decides the
 * architecture of the whole feature:
 *
 *   Can a mid-range Android phone evaluate frames three times a second while
 *   the preview stays above 24fps?
 *
 * So it shows the numbers rather than hiding them. Achieved evaluation rate,
 * milliseconds per sample, preview frame rate, and the raw metrics — because a
 * spike that reports "it feels fine" has answered nothing.
 *
 * If the achieved rate holds near 3/sec and the preview stays above 24, the
 * still-sampling approach ships and no frame processor is needed. If it does
 * not, that is worth knowing now rather than in month four.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { Button } from '../components/ui';
import {
  CaptureIssue,
  DEFAULT_THRESHOLDS,
  EvaluationLimiter,
  FrameMetrics,
  evaluateFrame,
} from '../lib/captureGate';
import { sampleFrame } from '../lib/frameSource';
import { color, radius, space, type } from '../lib/theme';

/**
 * Prompts live here only because this is a spike. In the real screen they come
 * from the backend string resource — no user-facing claim belongs in a
 * component.
 */
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
  samplesDropped: number;
}

export function CaptureSpikeScreen({ onExit }: { onExit: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [running, setRunning] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [metrics, setMetrics] = useState<FrameMetrics | null>(null);
  const [issue, setIssue] = useState<CaptureIssue | null>(null);
  const [stats, setStats] = useState<Stats>({
    evalsPerSecond: 0,
    avgSampleMs: 0,
    previewFps: 0,
    samplesTaken: 0,
    samplesDropped: 0,
  });

  // Refs rather than state: these are written on every tick and reading them
  // through state would re-render the preview several times a second, which
  // would itself depress the number being measured.
  const limiter = useRef(new EvaluationLimiter(3));
  const inFlight = useRef(false);
  const counters = useRef({
    evals: 0,
    dropped: 0,
    totalMs: 0,
    frames: 0,
    windowStart: Date.now(),
  });

  /** Preview frame counter, driven by requestAnimationFrame. */
  useEffect(() => {
    if (!running) return;
    let raf: number;
    const tick = () => {
      counters.current.frames++;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  /** Roll the counters into displayed stats once a second. */
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const c = counters.current;
      const elapsed = (Date.now() - c.windowStart) / 1000;
      if (elapsed <= 0) return;

      setStats((prev) => ({
        evalsPerSecond: c.evals / elapsed,
        avgSampleMs: c.evals > 0 ? c.totalMs / c.evals : 0,
        previewFps: c.frames / elapsed,
        samplesTaken: prev.samplesTaken + c.evals,
        samplesDropped: prev.samplesDropped + c.dropped,
      }));

      counters.current = {
        evals: 0,
        dropped: 0,
        totalMs: 0,
        frames: 0,
        windowStart: Date.now(),
      };
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

    const sample = useCallback(async () => {
    if (!cameraReady) return;

    // Overlapping samples would queue behind each other and the measured rate
    // would become meaningless. Dropping is the honest response, and the count
    // of drops is itself a result.
    if (inFlight.current) {
      counters.current.dropped++;
      return;
    }
    if (!limiter.current.shouldEvaluate()) return;

    inFlight.current = true;
    try {
      const result = await sampleFrame(cameraRef);
      if (result) {
        setMetrics(result.metrics);
        setIssue(evaluateFrame(result.metrics));
        counters.current.evals++;
        counters.current.totalMs += result.elapsedMs;
      }
    } finally {
      inFlight.current = false;
    }
  }, [cameraReady]);

  /**
   * Driven at 10Hz. The limiter enforces the FR-CAM-001 cap of three; polling
   * faster than the cap and letting the limiter refuse is what makes the
   * achieved rate meaningful — if it comes out below 3, the phone is the
   * bottleneck, not the schedule.
   */
  useEffect(() => {
    if (!running) return;
    const id = setInterval(sample, 100);
    return () => clearInterval(id);
  }, [running, sample]);

  if (!permission) return null;

  if (!permission.granted) {
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

  const rateOk = stats.evalsPerSecond >= 2.5;
  const fpsOk = stats.previewFps >= 24;

  return (
    <View style={styles.fill}>
        <CameraView
        ref={cameraRef}
        style={styles.preview}
        facing="front"
        onCameraReady={() => setCameraReady(true)}
      />

      {/* Live prompt. Green means a photo taken now would be accepted. */}
            {/* Three states, not two. "No metrics yet" must not render as "looks
          good" — on the real capture screen that would mean a gate which has
          failed telling the user to go ahead and take the photo. */}
      <View style={[styles.prompt, metrics !== null && !issue && styles.promptOk]}>
        <Text style={styles.promptText}>
          {metrics === null
            ? 'Checking…'
            : issue
              ? PROMPT[issue]
              : 'Looks good'}
        </Text>
      </View>
      <View style={styles.panel}>
        <Row
          label="Evaluations / sec"
          value={stats.evalsPerSecond.toFixed(2)}
          target="3.00"
          ok={rateOk}
        />
        <Row
          label="Preview fps"
          value={stats.previewFps.toFixed(0)}
          target="≥ 24"
          ok={fpsOk}
        />
        <Row
          label="Sample time"
          value={`${stats.avgSampleMs.toFixed(0)} ms`}
          target="< 333"
          ok={stats.avgSampleMs > 0 && stats.avgSampleMs < 333}
        />
        <Row
          label="Dropped"
          value={String(stats.samplesDropped)}
          target="low"
          ok={stats.samplesDropped < stats.samplesTaken}
        />

        <View style={styles.divider} />

        <Row label="Brightness" value={metrics ? metrics.meanLuma.toFixed(0) : '—'}
             target={`${DEFAULT_THRESHOLDS.minLuma}–${DEFAULT_THRESHOLDS.maxLuma}`} ok />
        <Row label="Variance" value={metrics ? metrics.lumaVariance.toFixed(0) : '—'}
             target={`> ${DEFAULT_THRESHOLDS.minLumaVariance}`} ok />
        <Row label="Sharpness" value={metrics ? metrics.sharpness.toFixed(1) : '—'}
             target={`> ${DEFAULT_THRESHOLDS.minSharpness}`} ok />

        <Text style={styles.platform}>
          {Platform.OS} · {Platform.OS === 'web' ? 'canvas path' : 'still-sampling path'}
        </Text>

        <View style={styles.actions}>
          <Button
            label={running ? 'Stop' : 'Start measuring'}
            onPress={() => setRunning((r) => !r)}
          />
          <Button label="Back" tone="outline" onPress={onExit} />
        </View>
      </View>
    </View>
  );
}

function Row({
  label,
  value,
  target,
  ok,
}: {
  label: string;
  value: string;
  target: string;
  ok: boolean;
}) {
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
  centre: {
    flex: 1,
    justifyContent: 'center',
    padding: space.lg,
    backgroundColor: color.ground,
  },
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