/**
 * Getting pixels out of a camera — native frame processor path.
 *
 * Two dead ends are worth recording, because both cost real time.
 *
 * vision-camera-resize-plugin pins Android Gradle Plugin 7.2.1 in its own
 * buildscript, which this project's toolchain will not tolerate. Dropped: the
 * frame buffer is available directly and computeMetrics already takes a
 * stride, so sampling a full-resolution frame every 8th pixel costs about what
 * a resized one would have.
 *
 * RGB frames then failed on device with "Failed to lock HardwareBuffer for
 * reading" — on the emulator and on a physical phone alike. Several Android
 * camera drivers refuse that lock. YUV frames arrive through a path that does
 * not need it, and the format suits the gate better anyway: the first plane IS
 * brightness, so there is no colour conversion to do per pixel.
 */

import { useMemo, useRef } from 'react';
import type { Frame } from 'react-native-vision-camera';
import { useFrameProcessor, runAtTargetFps } from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';

import { computeMetricsFromLuma, FrameMetrics } from './captureGate';

/**
 * Pixel stride for metrics sampling. The frame is full resolution (e.g.
 * 1280x720); every 8th pixel in both directions is a 64th of the work and
 * gives the same answer to two significant figures.
 */
const SAMPLE_STEP = 8;

export interface FrameSampleResult {
  metrics: FrameMetrics;
  /** Milliseconds for the metrics pass, measured on the worklet thread. */
  elapsedMs: number;
}

/**
 * Hook that wires a vision-camera frame processor to the capture gate.
 *
 * `onSample` is called on the JS thread, at most `perSecond` times a second —
 * enforced natively by `runAtTargetFps`, which is the FR-CAM-001 limiter on
 * this path.
 *
 * react-native-worklets-core does not export a bare `runOnJS`; the bridge from
 * worklet thread back to JS thread is `Worklets.createRunOnJS`, which must be
 * created once rather than per frame.
 *
 * The <Camera> this is attached to must set `pixelFormat="yuv"`.
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
        try {
          // Date.now(), not performance.now(). Worklets run in a separate JS
          // runtime where `performance` is not guaranteed to exist — and a
          // ReferenceError on the first line of a try block with a silent
          // catch looks exactly like "frames arrive but nothing is delivered".
          const started = Date.now();

          const buffer = frame.toArrayBuffer();
          const luma = new Uint8Array(buffer);

          const metrics = computeMetricsFromLuma(
            luma,
            frame.width,
            frame.height,
            null, // face detection: separate plugin, not wired yet
            SAMPLE_STEP,
          );

          deliverOnJS(metrics, Date.now() - started);
        } catch (e) {
          // This log is the reason the HardwareBuffer failure was findable at
          // all. An empty catch here turns every failure into silence, and a
          // processor that throws on every frame looks identical from the
          // screen to one that is never called — while needing a completely
          // different fix.
          //
          // Worth keeping until the metrics are confirmed stable on more than
          // one device, then reducing to a counter rather than a per-frame log.
          // console.log('[frameSource] failed:', String(e));
        }
      });
    },
    [deliverOnJS, perSecond],
  );

  return frameProcessor;
}