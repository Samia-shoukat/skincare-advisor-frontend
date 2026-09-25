/**
 * Opening the privacy policy, terms, and account-deletion page.
 *
 * They are public web pages served by the backend (Google Play needs URLs for
 * them), so the app shows the same pages in an in-app browser rather than a
 * second copy that could drift from what was published.
 */

import * as WebBrowser from 'expo-web-browser';

export async function openLegalPage(path: string): Promise<void> {
  const base = process.env.EXPO_PUBLIC_API_URL ?? '';
  await WebBrowser.openBrowserAsync(`${base}${path}`);
}
