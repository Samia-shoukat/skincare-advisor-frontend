/**
 * Production capture screen. FR-CAM-001 (gate), FR-CAM-002 (rate),
 * FR-CAM-003 (prepare and transmit), FR-CAM-004 (zero-save).
 *
 * ## Where the gate runs
 *
 * The live path evaluates preview frames before the shutter, which is what
 * FR-CAM-001 asks for. It is still wired and still preferred. On this hardware
 * it delivers nothing — `frame.toArrayBuffer()` fails with "Failed to lock
 * HardwareBuffer for reading" on the emulator and on a physical device, in
 * both RGB and YUV — so the post-capture path takes over. See ADR-014.
 *
 * ## Why every step is behind a timeout
 *
 * Three separate failures during development presented identically: a spinner
 * that never stopped. A native call that hangs, a decode that blocks the JS
 * thread, and a request to an endpoint that does not exist all look the same
 * from the screen, and each needs a different fix.
 */

import React, { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';

import { Button } from '../components/ui';
import { useAuth } from '../lib/auth';
import { CaptureIssue, evaluateFrame, FrameMetrics } from '../lib/captureGate';
import { useCaptureFrameProcessor, FrameSampleResult } from '../lib/frameSource';
import { evaluateCapturedImage } from '../lib/postCaptureGate';
import { prepareImageForUpload, releaseImage } from '../lib/prepareImage';
import type { ScanResponse } from '../lib/api';
import { newIdempotencyKey, uploadImageAndRelease, UploadError } from '../lib/uploadImage';
import { color, radius, space, type } from '../lib/theme';

const PROMPT: Record<CaptureIssue, string> = {
  NO_FACE: 'Center your face in the frame',
  TOO_DARK: 'Move to brighter light',
  TOO_BRIGHT: 'Too much light — turn away from the window',
  BLURRY: 'Hold the phone steady',
};

type CaptureState = 'gating' | 'checking' | 'preparing' | 'uploading' | 'error';

const STEP_LABEL: Record<Exclude<CaptureState, 'gating' | 'error'>, string> = {
  checking: 'Checking the photo…',
  preparing: 'Preparing…',
  uploading: 'Analyzing…',
};

/**
 * Fail a promise that takes too long.
 *
 * The underlying work is not cancelled — most of these calls have no cancel —
 * but the user is released, which is the part that matters. A hung native call
 * with a visible error is a bug report; the same call behind a spinner is a
 * mystery.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

/** FR-AI-003: guidance and an exit are offered after this many unusable results. */
const UNUSABLE_LIMIT = 3;

interface Props {
  onScanComplete: (result: ScanResponse) => void;
  /** FR-TRI-001. The server refused because the user's own answers call for a referral. */
  onReferralRequired: () => void;
  onExit: () => void;
  /** IF-UI-001. Retake copy comes from the server's string bundle. */
  copy: { retake: string; retakeGuidance: string };
}

export function CaptureScreen({ onScanComplete, onReferralRequired, onExit, copy }: Props) {
  const { hasPermission, requestPermission } = useCameraPermission();
    // Reaching into the session directly because the auth context does not
  // expose a plain token yet. Worth tidying when auth.tsx is next touched —
  // every screen that uploads needs this, and each one doing it by hand is
  // one place for it to go wrong.
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const device = useCameraDevice('front');
  const cameraRef = useRef<Camera>(null);

  const [metrics, setMetrics] = useState<FrameMetrics | null>(null);
  const [issue, setIssue] = useState<CaptureIssue | null>(null);
  const [state, setState] = useState<CaptureState>('gating');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // FR-AI-003. Consecutive only: a scan that gets past the analysis resets it.
  const [unusableCount, setUnusableCount] = useState(0);

  const frameProcessor = useCaptureFrameProcessor((result: FrameSampleResult) => {
    setMetrics(result.metrics);
    setIssue(evaluateFrame(result.metrics));
  }, 3);

  // Capture is allowed when the live gate passes, and also when it never ran.
  // Leaving the button disabled on a device that cannot deliver frames would
  // make the app unusable there — the check still happens after the shutter.
  const liveGateUnavailable = metrics === null;
  const canCapture = state === 'gating' && (liveGateUnavailable || issue === null);

  const resetToGating = () => {
    setState('gating');
    setErrorMessage(null);
  };

  const handleCapture = async () => {
    if (!cameraRef.current) return;

    // Temporary. A missing token and a rejected token both surface as 401, and
    // they need opposite fixes — one is "sign in first", the other is a broken
    // verification path.
    console.log('[capture] token present:', !!token);

    setErrorMessage(null);

    let rawUri: string | null = null;

    try {
      // takePhoto() runs before any state change. Every setState re-renders
      // <Camera>, and this device tears the session down on some of those
      // renders — which surfaced as "Camera is closed." from a call that was
      // already in flight.
      const photo = await withTimeout(
        cameraRef.current.takePhoto({ enableShutterSound: false }),
        15000,
        'capture',
      );

      setState('checking');
      rawUri = `file://${photo.path}`;
      console.log('[capture] photo taken');

      // --- the gate -------------------------------------------------------
      // A gate that cannot run must not block capture: refusing every photo on
      // a device where the resize fails is worse than occasionally letting a
      // poor one through. A thrown error here means "unchecked", not
      // "rejected".
      let inspection = null;
      try {
        inspection = await withTimeout(evaluateCapturedImage(rawUri), 8000, 'quality check');
        console.log(
          `[capture] checked in ${inspection.elapsedMs}ms:`,
          inspection.issue ?? 'passed',
        );
      } catch (e) {
        console.log('[capture] could not check photo:', String(e));
      }

      if (inspection?.issue) {
        // Discarded before anything is prepared or sent. The user gets the
        // same instruction the live gate would have given them.
        await releaseImage(rawUri);
        rawUri = null;
        setIssue(inspection.issue);
        setErrorMessage(PROMPT[inspection.issue]);
        setState('gating');
        return;
      }

      // --- prepare --------------------------------------------------------
      setState('preparing');
      const prepared = await withTimeout(
        prepareImageForUpload(rawUri, photo.width, photo.height),
        15000,
        'prepare',
      );
      console.log('[capture] prepared');

      // Only the prepared copy is uploaded, so the full-resolution original
      // goes now rather than after the network call (FR-CAM-004).
      await releaseImage(rawUri);
      rawUri = null;

      // --- upload ---------------------------------------------------------
      setState('uploading');
      const result = await withTimeout(
        uploadImageAndRelease(prepared.uri, token ?? '', newIdempotencyKey()),
        30000,
        'upload',
      );
      console.log('[capture] uploaded');
      setUnusableCount(0);
      onScanComplete(result);
    } catch (err) {
      // Whatever happened, the file goes. FR-CAM-004 has no exception for
      // failure paths — and those are the paths where a stray file is most
      // likely to survive.
      if (rawUri) await releaseImage(rawUri).catch(() => {});

      console.log('[capture] failed:', String(err));

      if (err instanceof UploadError && err.errorCode === 'REFERRAL_REQUIRED') {
        onReferralRequired();
        return;
      }

      // FR-AI-003. The analysis could not read the photo. Back to the camera
      // with a retake prompt; after three in a row, guidance and a way out.
      // The allowance is untouched either way -- the server does not decrement
      // on an unusable result.
      if (err instanceof UploadError && err.errorCode === 'IMAGE_UNUSABLE') {
        const count = unusableCount + 1;
        setUnusableCount(count);
        setErrorMessage(count >= UNUSABLE_LIMIT ? copy.retakeGuidance : copy.retake);
        setState('gating');
        return;
      }

      setState('error');
      setErrorMessage(
        err instanceof UploadError
          ? err.message
          : __DEV__
            ? String(err)
            : 'Could not process that photo. Try again.',
      );
    }
  };

  if (!hasPermission) {
    return (
      <View style={styles.centre}>
        <Text style={styles.heading}>Camera access needed</Text>
        <Text style={styles.body}>
          Skinsight looks at one photo of your face and does not keep it.
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

  const busy = state === 'checking' || state === 'preparing' || state === 'uploading';

  return (
    <View style={styles.fill}>
      <Camera
        ref={cameraRef}
        style={styles.preview}
        device={device}
        // Kept active through every working state. vision-camera tears down
        // its session when this goes false, and the captured file is still
        // being read back at that point.
        isActive={state !== 'error'}
        photo={true}
        // vision-camera 4.7 removed the per-shot `quality` option; this is what
        // replaced it. Smaller photos matter here because the gate has to read
        // one back before the user sees anything.
        photoQualityBalance="speed"
        frameProcessor={state === 'gating' ? frameProcessor : undefined}
        pixelFormat="yuv"
      />

      {state === 'gating' && (
        <View style={[styles.prompt, canCapture && !errorMessage && styles.promptOk]}>
          <Text style={styles.promptText}>
            {/* Three sources, most recent first. A rejection from the last
                capture outranks a live reading, which outranks "not looked
                yet". */}
            {errorMessage
              ? errorMessage
              : metrics === null
                ? 'Take a photo when you are ready'
                : issue
                  ? PROMPT[issue]
                  : 'Looks good'}
          </Text>
        </View>
      )}

      {busy && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={color.onPrimary} />
          <Text style={styles.overlayText}>{STEP_LABEL[state]}</Text>
          <Button label="Cancel" tone="outline" onPress={resetToGating} />
        </View>
      )}

      {state === 'error' && (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>{errorMessage}</Text>
          <View style={styles.actions}>
            <Button label="Try again" onPress={resetToGating} />
            <Button label="Back" tone="outline" onPress={onExit} />
          </View>
        </View>
      )}

      {state === 'gating' && (
        <View style={styles.panel}>
          <Button label="Capture" onPress={handleCapture} disabled={!canCapture} />
          <Button label="Back" tone="outline" onPress={onExit} />
        </View>
      )}
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
    paddingHorizontal: space.md,
    alignItems: 'center',
  },
  promptOk: { backgroundColor: 'rgba(78,107,74,0.9)' },
  promptText: { ...type.bodyStrong, color: color.onPrimary, textAlign: 'center' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
    gap: space.md,
  },
  overlayText: { ...type.bodyStrong, color: color.onPrimary, textAlign: 'center' },
  panel: {
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    padding: space.lg,
    gap: space.sm,
  },
  actions: { gap: space.sm },
});