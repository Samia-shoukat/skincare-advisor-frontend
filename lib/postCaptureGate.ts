/**
 * Quality gate on a captured photo.
 *
 * FR-CAM-001 asks for this check before the shutter. That path is unavailable
 * on this hardware — `frame.toArrayBuffer()` fails with "Failed to lock
 * HardwareBuffer for reading" on both the emulator and a physical device, in
 * RGB and YUV — so the check runs immediately after capture instead. The user
 * sees the same instruction, one tap later. Recorded as a deviation, not a fix.
 *
 * ## Why the image is shrunk first
 *
 * jpeg-js is pure JavaScript. Decoding a camera photo means constructing
 * millions of pixels on the JS thread, which blocks the entire app — the
 * screen simply appears frozen, with no error and no end. That is not a slow
 * path to be tuned; it is the wrong place to do the work.
 *
 * expo-image-manipulator resizes in native code. JavaScript then decodes a
 * 32-pixel-wide thumbnail — about a thousand pixels, a fraction of a
 * millisecond. Heavy work native, light work JS.
 *
 * Thirty-two pixels is enough because the gate measures whether there is any
 * detail, not what the detail is. Mean brightness survives downscaling almost
 * exactly; gradient energy is reduced but consistently, which is why the
 * sharpness threshold below is separate from the live-frame one.
 */

import { decode as decodeJpeg } from 'jpeg-js';

import {
  CaptureIssue,
  DEFAULT_THRESHOLDS,
  FrameMetrics,
  Thresholds,
  computeMetrics,
  evaluateFrame,
} from './captureGate';

/** Width of the thumbnail the gate actually measures. */
const THUMBNAIL_WIDTH = 32;

/**
 * Thresholds for the post-capture path.
 *
 * Brightness carries over unchanged — downscaling averages pixels, and the
 * mean of the averages is the mean. Sharpness does not: neighbouring pixels in
 * a 32-wide thumbnail are far apart in the original, so gradients read higher
 * than on a full-size frame. A single shared number would either pass every
 * blurred photo or reject every sharp one.
 *
 * **Placeholder figures.** The specification's non-functional section was never
 * written, so there is nothing to calibrate against yet. These need measuring
 * against real photographs before release.
 */
export const POST_CAPTURE_THRESHOLDS: Thresholds = {
  ...DEFAULT_THRESHOLDS,
  minSharpness: 6,
};

export interface PostCaptureResult {
  metrics: FrameMetrics;
  issue: CaptureIssue | null;
  /** Milliseconds for resize, decode and measurement together. */
  elapsedMs: number;
}

/**
 * Shrink a captured photo, decode the thumbnail, and run the gate over it.
 *
 * Throws if the resize or decode fails. The caller decides what that means —
 * see the note in CaptureScreen on why a gate that cannot run must not block
 * capture.
 */
export async function evaluateCapturedImage(
  uri: string,
  thresholds: Thresholds = POST_CAPTURE_THRESHOLDS,
): Promise<PostCaptureResult> {
  const started = Date.now();

  // Imported lazily. expo-image-manipulator's API has moved between SDK
  // versions, and a module-level import that fails takes the whole screen
  // down instead of failing one check.
  const ImageManipulator: any = await import('expo-image-manipulator');

  const thumbnail = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: THUMBNAIL_WIDTH } }],
    {
      base64: true,
      // No compression: the thumbnail is about a kilobyte either way, and
      // compression artefacts would show up as gradient energy — the gate
      // would read its own compression as sharpness.
      compress: 1,
      format: ImageManipulator.SaveFormat?.JPEG ?? 'jpeg',
    },
  );

  if (!thumbnail?.base64) {
    throw new Error('resize produced no image data');
  }

  const bytes = base64ToBytes(thumbnail.base64);
  const decoded = decodeJpeg(bytes, { useTArray: true });

  const metrics = computeMetrics(
    decoded.data as unknown as Uint8ClampedArray,
    decoded.width,
    decoded.height,
    // Face detection is not wired on this path. `null` means unavailable, and
    // the gate treats that as "cannot check" rather than "no face" — blocking
    // capture on it would make the app unusable rather than safer.
    null,
    // Every pixel. At this size there is nothing to save by skipping, and
    // sampling a tiny image sparsely starts to lose the signal.
    1,
  );

  return {
    metrics,
    issue: evaluateFrame(metrics, thresholds),
    elapsedMs: Date.now() - started,
  };
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