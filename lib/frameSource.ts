/**
 * Getting pixels out of a camera — native frame processor path.
 *
 * First attempt used vision-camera-resize-plugin, which pins Android Gradle
 * Plugin 7.2.1 in its own buildscript — incompatible with this project's
 * modern AGP/Gradle setup and not worth fighting. Dropped the dependency
 * entirely: frame.toArrayBuffer() gives the full-resolution frame directly,
 * and computeMetrics already accepts a stride, so a full-res buffer sampled
 * every 8th pixel costs about the same as a resized one would have.
 */

import { useMemo, useRef } from 'react';
import type { Frame } from 'react-native-vision-camera';
import { useFrameProcessor, runAtTargetFps } from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';

import { computeMetrics, FrameMetrics } from './captureGate';

/**
 * Pixel stride for metrics sampling. Frame is full resolution (e.g.
 * 1280x720); this keeps the per-sample workload comparable to what the
 * still-sampling path did on a 160px-wide image, without a native resize.
 */
const SAMPLE_STEP = 8;

/** Bytes per pixel for pixelFormat: 'rgb' on the <Camera> component. */
const RGB_CHANNELS = 4;

export interface FrameSampleResult {
  metrics: FrameMetrics;
  /** Milliseconds for the metrics pass, measured on the worklet thread. */
  elapsedMs: number;
}

/**
 * Hook that wires a vision-camera frame processor to the capture gate.
 *
 * `onSample` is called on the JS thread, at most `perSecond` times a second —
 * enforced natively by `runAtTargetFps`, which is the FR-CAM-001 limiter for
 * this path.
 *
 * react-native-worklets-core does not export a bare `runOnJS`; the bridge
 * from worklet thread back to JS thread is `Worklets.createRunOnJS`, which
 * must be created once (not per frame) and is safe to call from the worklet.
 */
export function useCaptureFrameProcessor(
  onSample: (result: FrameSampleResult) => void,
  perSecond = 3,
) {
  const onSampleRef = useRef(onSample);
  onSampleRef.current = onSample;

  const deliverOnJS = useMemo(
    () =>
      Worklets.createRunOnJS((metrics: FrameMetrics, elapsedMs: number) => {
        onSampleRef.current({ metrics, elapsedMs });
      }),
    [],
  );

  const frameProcessor = useFrameProcessor(
    (frame: Frame) => {
      'worklet';
      runAtTargetFps(perSecond, () => {
        'worklet';
        const started = performance.now();

        const buffer = frame.toArrayBuffer();
        const pixels = new Uint8Array(buffer);

        const metrics = computeMetrics(
          pixels as unknown as Uint8ClampedArray,
          frame.width,
          frame.height,
          null, // face detection: separate plugin, not wired yet
          SAMPLE_STEP,
          RGB_CHANNELS,
        );

        const elapsedMs = performance.now() - started;
        deliverOnJS(metrics, elapsedMs);
      });
    },
    [deliverOnJS, perSecond],
  );

  return frameProcessor;
}