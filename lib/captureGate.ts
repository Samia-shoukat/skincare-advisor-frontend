/**
 * On-device capture quality gate. FR-CAM-001.
 *
 * Split into two halves on purpose:
 *
 *   `computeMetrics` turns raw pixels into four numbers.
 *   `evaluateFrame`  turns four numbers into a decision.
 *
 * Neither half touches a camera. That means the decision logic — which is the
 * part with requirements attached — can be tested exhaustively on a laptop
 * with synthetic pixel data, while only the plumbing needs a device.
 *
 * FR-CAM-001 caps evaluation at three per second. The cap is not a performance
 * budget, it is the point: a gate that runs on every frame would compete with
 * the preview, and FR-CAM-002 requires the preview to stay above 24fps. Three
 * per second is faster than a person can react to feedback anyway.
 */

/** What a single sampled frame tells us. */
export interface FrameMetrics {
  /** Mean brightness, 0–255. */
  meanLuma: number;
  /** How much the brightness varies. A flat wall and a face differ here. */
  lumaVariance: number;
  /** Gradient energy. Low means soft edges, which means motion or bad focus. */
  sharpness: number;
  /**
   * Null when face detection is unavailable on this platform rather than when
   * no face was found. The two are different and must not collapse: "we
   * couldn't look" should not read as "nobody is there".
   */
  faceDetected: boolean | null;
}

export type CaptureIssue = 'NO_FACE' | 'TOO_DARK' | 'TOO_BRIGHT' | 'BLURRY';

/**
 * Thresholds.
 *
 * **These are placeholders.** The specification's non-functional section, which
 * would have given real figures, was never written — so these are reasoned
 * starting points, not validated numbers. They need calibrating against real
 * photographs on real phones before release, and the values will differ by
 * camera.
 *
 * Kept in one object rather than scattered through the function so that
 * calibration is an edit to a table, and so the tests can override them.
 */
export const DEFAULT_THRESHOLDS = {
  /** Below this a phone camera is guessing at colour, and so is the model. */
  minLuma: 55,
  /** Above this highlights clip and texture disappears into white. */
  maxLuma: 215,
  /**
   * Low variance on an adequately lit frame means the camera is pointed at
   * something flat. Catches a pocket or a ceiling that happens to be bright.
   */
  minLumaVariance: 180,
  /** Gradient energy below this is motion blur or a missed focus. */
  minSharpness: 12,
} as const;

export type Thresholds = typeof DEFAULT_THRESHOLDS;

/**
 * Decide whether a frame is usable.
 *
 * Returns the single most actionable problem, not all of them. A dark, blurry,
 * faceless frame gets one instruction; three at once is noise, and the user
 * cannot act on three things simultaneously anyway.
 *
 * The order is by what the user must fix first. Framing before lighting before
 * focus: there is no point telling someone to hold still while the camera is
 * pointed at the ceiling.
 */
export function evaluateFrame(
  metrics: FrameMetrics,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): CaptureIssue | null {
  // Explicitly false, not falsy. `null` means detection was unavailable, and
  // blocking capture on a platform that cannot detect faces would make the app
  // unusable there rather than safer.
  if (metrics.faceDetected === false) return 'NO_FACE';

  if (metrics.meanLuma < thresholds.minLuma) return 'TOO_DARK';
  if (metrics.meanLuma > thresholds.maxLuma) return 'TOO_BRIGHT';
  // Checked after brightness because a dark frame has low variance by
  // definition, and "move to brighter light" is the useful instruction there.
  if (metrics.lumaVariance < thresholds.minLumaVariance) return 'NO_FACE';

  if (metrics.sharpness < thresholds.minSharpness) return 'BLURRY';

  return null;
}

/**
 * Turn RGBA pixel data into metrics.
 *
 * Samples rather than reads every pixel. A 720×1280 preview is nearly a
 * million pixels; at three evaluations per second that is three million
 * operations per second competing with the preview for the same thread. Every
 * fourth pixel gives the same answer to two significant figures and costs a
 * sixteenth of the work.
 *
 * `faceDetected` is not computed here — it comes from the platform's detector
 * and is passed in, so this function stays pure and testable.
 *
 * Marked as a worklet: this runs on the frame-processor thread inside
 * `frameSource.ts`, and worklets-core can only call functions that are
 * themselves compiled as worklets. Without this directive, the caller's
 * compiled worklet ends up with corrupted/empty code at runtime.
 */
export function computeMetrics(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  faceDetected: boolean | null = null,
  step = 4,
  channels = 4,
): FrameMetrics {
  'worklet';

  let sum = 0;
  let sumSquares = 0;
  let count = 0;
  let gradientSum = 0;
  let gradientCount = 0;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * channels;

      // Rec. 601 luma. Integer weights avoid float work in the inner loop,
      // which at this call rate is worth the slight loss of precision.
      const luma = (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000;

      sum += luma;
      sumSquares += luma * luma;
      count++;

      // Horizontal difference against the next sampled pixel. A full Laplacian
      // would be more accurate and several times the cost; for "is this
      // blurred", the difference between the two is not worth the frames.
      const right = x + step;
      if (right < width) {
        const j = (y * width + right) * channels;
        const rightLuma =
          (rgba[j] * 299 + rgba[j + 1] * 587 + rgba[j + 2] * 114) / 1000;
        gradientSum += Math.abs(luma - rightLuma);
        gradientCount++;
      }
    }
  }

  if (count === 0) {
    return { meanLuma: 0, lumaVariance: 0, sharpness: 0, faceDetected };
  }

  const meanLuma = sum / count;

  return {
    meanLuma,
    lumaVariance: Math.max(0, sumSquares / count - meanLuma * meanLuma),
    sharpness: gradientCount > 0 ? gradientSum / gradientCount : 0,
    faceDetected,
  };
}

/**
 * Rate limiter for the gate.
 *
 * FR-CAM-001 caps evaluation at three per second. Enforcing it here rather
 * than in the camera component means the cap cannot be lost when that
 * component is rewritten — and it will be, because the current one targets a
 * browser webcam and the shipped one will not.
 *
 * Not a worklet: this class is used on the JS thread, not inside the frame
 * processor, so it stays a plain class.
 */
export class EvaluationLimiter {
  private lastRun = 0;
  private readonly interval: number;

  constructor(perSecond = 3) {
    this.interval = 1000 / perSecond;
  }

  /** True if enough time has passed. Records the time when it returns true. */
  shouldEvaluate(now: number = Date.now()): boolean {
    if (now - this.lastRun < this.interval) return false;
    this.lastRun = now;
    return true;
  }
}