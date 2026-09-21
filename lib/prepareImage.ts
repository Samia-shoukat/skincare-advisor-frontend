/**
 * Image preparation for transmission. FR-CAM-003.
 *
 * Takes a freshly captured photo and produces exactly what the wire format
 * requires: resized, compressed, EXIF-free. Runs after the capture gate
 * (captureGate.ts) has already approved the frame that led to this photo —
 * this stage does not re-validate quality, it only prepares the bytes.
 *
 * expo-image-manipulator strips EXIF as a side effect of any manipulation —
 * the output carries no EXIF block unless the caller explicitly re-attaches
 * it, which this code does not do. That satisfies the EXIF requirement
 * without an extra step, and orientation is baked into the pixel data
 * before the tag is dropped, so a photo taken in any device rotation still
 * displays upright even with EXIF gone.
 */

import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

const LONGEST_EDGE = 1024;
const JPEG_QUALITY = 0.8; // ImageManipulator's `compress` is 0..1, not 0..100

export interface PreparedImage {
  /** Local file URI of the prepared JPEG. Caller owns cleanup via releaseImage. */
  uri: string;
  width: number;
  height: number;
}

/**
 * Resize to a longest edge of 1024px, encode JPEG at quality 80, drop EXIF.
 * Does not touch the original file at `sourceUri` — caller releases that
 * separately.
 *
 * Only downscales. Camera output is always larger than 1024px on its
 * longest edge in practice; a smaller source is re-encoded for the
 * quality/EXIF requirements but not upscaled, since that would only add
 * file size for no visual benefit.
 */
export async function prepareImageForUpload(
  sourceUri: string,
  sourceWidth: number,
  sourceHeight: number,
): Promise<PreparedImage> {
  const longestEdge = Math.max(sourceWidth, sourceHeight);

  const resizeAction: ImageManipulator.Action[] =
    longestEdge > LONGEST_EDGE
      ? [
          sourceWidth >= sourceHeight
            ? { resize: { width: LONGEST_EDGE } }
            : { resize: { height: LONGEST_EDGE } },
        ]
      : [];

  const result = await ImageManipulator.manipulateAsync(sourceUri, resizeAction, {
    compress: JPEG_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return { uri: result.uri, width: result.width, height: result.height };
}

/**
 * Deletes an image file from the device — the original capture, the
 * prepared copy, or both. Safe to call more than once and safe to call on
 * a URI that no longer exists.
 *
 * Does not swallow failures: the Zero-Save Policy (CON-001) means a delete
 * that silently fails is a policy violation, not a minor bug, so this lets
 * the caller find out.
 */
export async function releaseImage(uri: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) return;
  await FileSystem.deleteAsync(uri, { idempotent: true });
}