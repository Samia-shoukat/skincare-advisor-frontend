/**
 * Android hardware back button.
 *
 * This app has no navigation library: screens are chosen by state, with the
 * server deciding the onboarding step (see App.tsx). Without this hook,
 * Android's back button would close the app from any screen -- including
 * mid-scan or halfway through account deletion.
 *
 * `handler` returns true when it handled the press (went back a step), or
 * false to let Android do its default (leave the app). Pass null to not
 * intercept at all, e.g. on the top-level screen.
 *
 * Uses React Native's built-in BackHandler rather than a navigation library,
 * so no native dependency is added and the dev client does not need a rebuild.
 * iOS has no hardware back button; the on-screen Back buttons cover it.
 */

import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';

export function useBackHandler(handler: (() => boolean) | null): void {
  // Kept in a ref so the listener always calls the latest handler without
  // re-subscribing on every render.
  const ref = useRef(handler);
  ref.current = handler;

  const active = handler !== null;

  useEffect(() => {
    if (!active) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () =>
      ref.current ? ref.current() : false,
    );
    return () => subscription.remove();
  }, [active]);
}
