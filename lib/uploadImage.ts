/**
 * Transmission half of FR-CAM-003, and the client side of the Zero-Save Policy
 * (CON-001): whatever happens to the request — success, failure, or a thrown
 * exception — no image file is left on the device once this function returns.
 *
 * Routing behind the endpoint (FR-AI-004) is a server concern and does not
 * reach here. This function's job is to hand over one image with one token and
 * then make sure the file is gone.
 */

import * as FileSystem from 'expo-file-system/legacy';

import { getApiBase, refreshApiBase, SERVER_OVERRIDE_ALLOWED } from './apiBase';
import type { ScanResponse } from './api';
import { releaseImage } from './prepareImage';

const SCAN_ENDPOINT_PATH = '/v1/scans/';
const SCAN_BASE64_PATH = '/v1/scans/base64';

/**
 * `errorCode` is the server's IF-COMM-003 code where there was one --
 * IMAGE_UNUSABLE, ANALYSIS_INVALID, PROVIDER_UNAVAILABLE, QUOTA_EXCEEDED,
 * REFERRAL_REQUIRED. The capture screen needs it: a retake, a retry and a
 * referral are three different next steps, and a bare HTTP status cannot tell
 * them apart. Null for failures that never reached the server.
 */
export class UploadError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly errorCode: string | null = null,
  ) {
    super(message);
    this.name = 'UploadError';
  }
}

/**
 * A key per capture, so a retry after a dropped connection is recognised by the
 * server as the same scan and does not use the allowance twice (FR-SUB-003).
 * Not cryptographic -- the server scopes keys to the signed-in user, so this
 * only has to avoid colliding with that user's own earlier scans.
 */
export function newIdempotencyKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Uploads a prepared image and always deletes the local file afterward.
 *
 * That guarantee — not the response — is why this exists rather than a bare
 * fetch call. FR-CAM-003 requires release "when the request ends", and "ends"
 * has to include the failure paths, which are exactly where a stray file is
 * most likely to survive.
 */
export async function uploadImageAndRelease(
  preparedUri: string,
  token: string,
  idempotencyKey: string,
): Promise<ScanResponse> {
  const apiUrl = await getApiBase();

  if (!apiUrl) {
    throw new UploadError('EXPO_PUBLIC_API_URL is not configured');
  }

  // A face photograph over plain HTTP is readable by anything on the network
  // between here and the server, so the default is refusal.
  //
  // Development against a local backend is the exception. Loopback never
  // leaves the device; a LAN address does cross a network, so permitting it is
  // a real relaxation — it exists because a phone cannot reach the laptop any
  // other way, and it is gated on __DEV__ so it cannot ship.
  const isLocalNetwork =
    /^https?:\/\/(127\.0\.0\.1|localhost|10\.0\.2\.2|192\.168\.\d+\.\d+)(:|$)/.test(apiUrl);
  if (!apiUrl.startsWith('https://') && !(__DEV__ && isLocalNetwork)) {
    throw new UploadError(`Refusing to upload over non-TLS endpoint: ${apiUrl}`);
  }

  if (!token) {
    // Caught here rather than as a 401 from the server, because the image
    // would be on the wire before that answer came back.
    throw new UploadError('Not signed in');
  }

  // Built fresh for each attempt: a FormData holding a file URI cannot be
  // replayed reliably once a request has consumed it.
  const send = (base: string) => {
    const form = new FormData();
    form.append('image', {
      uri: preparedUri,
      name: 'scan.jpg',
      type: 'image/jpeg',
    } as unknown as Blob);
    // No profile context is sent. The server reads skin type, age band and
    // safety flags from the stored profile (FR-ONB-006), so sending them would
    // only put pregnancy and treatment answers on the wire for nothing.

    return fetch(`${base}${SCAN_ENDPOINT_PATH}`, {
      method: 'POST',
      // Content-Type is deliberately absent. fetch sets it along with the
      // multipart boundary; setting it by hand produces a body the server
      // cannot parse, and the resulting 400 looks like a server bug.
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: form,
    });
  };

  /**
   * The same scan as JSON, with the image base64-encoded.
   *
   * Multipart uploads from React Native failed on a real device with no
   * server-side trace: the request never arrived. This path has no streamed
   * file handle and no multipart boundary -- it reads the file, encodes it,
   * and posts an ordinary JSON body. About a third more bytes, which is why it
   * is the fallback rather than the default.
   */
  const sendBase64 = async (base: string) => {
    const imageBase64 = await FileSystem.readAsStringAsync(preparedUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return fetch(`${base}${SCAN_BASE64_PATH}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ imageBase64, contentType: 'image/jpeg' }),
    });
  };

  try {
    let response: Response;
    try {
      response = await send(apiUrl);
    } catch (first) {
      // The upload is the largest request the app makes and the one most
      // likely to meet a tunnel that has just moved or dropped. Retrying on a
      // freshly looked-up address costs one attempt and fixes the common case.
      // The same Idempotency-Key is reused, so if the first attempt did reach
      // the server, the retry returns that result rather than scanning twice.
      const base = SERVER_OVERRIDE_ALLOWED ? await refreshApiBase() : apiUrl;
      try {
        response = await send(base);
      } catch (second) {
        // Multipart is not getting through from this device. Same scan, same
        // idempotency key, different shape on the wire.
        response = await sendBase64(base);
      }
    }

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new UploadError(
        payload?.message ?? `Scan request failed: ${response.status}`,
        undefined,
        payload?.errorCode ?? null,
      );
    }

    return payload as ScanResponse;
  } catch (err) {
    if (err instanceof UploadError) throw err;
    // The underlying reason is included in test builds. "Scan request failed"
    // on its own is unactionable: a dropped tunnel, a timeout and a refused
    // connection all look identical, and they need different fixes.
    const detail = SERVER_OVERRIDE_ALLOWED ? `: ${String(err)}` : '';
    throw new UploadError(`Scan request failed${detail}`, err);
  } finally {
    // Runs on every path, including the throws above. This is the line the
    // whole function is built around.
    await releaseImage(preparedUri);
  }
}