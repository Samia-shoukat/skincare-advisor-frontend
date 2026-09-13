/**
 * Getting pixels out of a camera, on two platforms that offer nothing in
 * common.
 *
 * Native has no access to live preview frames in Expo Go — frame processors
 * need a development build. So the native path samples small still images
 * instead and decodes them in JavaScript.
 *
 * That is slower than a frame processor and it is also a real architecture,
 * not a stand-in. The question this app has to answer is whether a mid-range
 * Android phone can evaluate three times a second while the preview stays
 * smooth. Sampling stills is the cheapest way to get a number for that, and if
 * it turns out to be fast enough the frame processor may never be needed.
 *
 * Web uses a canvas, which gives real pixel data directly. Useful for
 * developing the gate; not representative of phone performance.
 */

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { decode as decodeJpeg } from 'jpeg-js';

import { computeMetrics, FrameMetrics } from './captureGate';

export interface SampleResult {
  metrics: FrameMetrics;
  /** Wall-clock milliseconds for capture plus decode plus metrics. */
  elapsedMs: number;
}

/**
 * Sample one frame from a camera ref and measure it.
 *
 * The image is taken small on purpose. FR-CAM-001 asks for three evaluations a
 * second, and a full-resolution JPEG cannot be decoded in JavaScript anywhere
 * near that often. A 160-pixel-wide frame carries more than enough information
 * for mean brightness and gradient energy — this is not the photograph, it is
 * the measurement of one.
 */
export async function sampleFrame(cameraRef: any): Promise<SampleResult | null> {
  if (!cameraRef?.current) return null;

  const started = Date.now();

  try {
    const photo = await cameraRef.current.takePictureAsync({
      quality: 0.3,
      base64: true,
      imageType: 'jpg',
    });

    if (!photo?.base64) return null;

    // FR-CAM-004. takePictureAsync writes a file whether or not base64 was
    // asked for. Deleting it immediately is the whole of the Zero-Save
    // guarantee on this path, and it has to happen before anything can throw.
    await discardCapturedFile(photo.uri);

    const bytes = base64ToBytes(photo.base64);
    const decoded = decodeJpeg(bytes, { useTArray: true });

    const metrics = computeMetrics(
      decoded.data as unknown as Uint8ClampedArray,
      decoded.width,
      decoded.height,
      null, // face detection is not available on this path
      2,
    );

    return { metrics, elapsedMs: Date.now() - started };
    } catch (e) {
    // A sample failing is not worth tearing down the preview for — the next one
    // is 300ms away. But swallowing it silently is how a gate that never runs
    // ends up looking like a gate that passes, so it goes to the console.
    console.warn('[frameSource] sample failed:', e);
    return null;
  }
}

/**
 * Delete a captured file. FR-CAM-004.
 *
 * Failures are swallowed deliberately: on web there is no file, and on native
 * a missing file means it was never written. Neither is a reason to interrupt
 * the user. What matters is that the call is always made.
 */
export async function discardCapturedFile(uri: string | undefined): Promise<void> {
  if (!uri || Platform.OS === 'web') return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Nothing useful to do, and nothing about it worth logging — a log line
    // naming a photo path is closer to the thing we are trying to avoid.
  }
}

/** Base64 to bytes without Buffer, which React Native does not ship. */
function base64ToBytes(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array((clean.length * 3) / 4);

  let byteIndex = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = chars.indexOf(clean[i]);
    const b = chars.indexOf(clean[i + 1]);
    const c = chars.indexOf(clean[i + 2]);
    const d = chars.indexOf(clean[i + 3]);

    bytes[byteIndex++] = (a << 2) | (b >> 4);
    if (c !== -1) bytes[byteIndex++] = ((b & 15) << 4) | (c >> 2);
    if (d !== -1) bytes[byteIndex++] = ((c & 3) << 6) | d;
  }

  return bytes.subarray(0, byteIndex);
}