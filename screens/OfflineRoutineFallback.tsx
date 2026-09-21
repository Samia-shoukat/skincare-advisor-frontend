/**
 * SRS 2.4: "Stored routines are viewable offline."
 *
 * Shown in place of the "can't reach your profile" screen when the phone has a
 * saved routine for this account. Without it, a user opening the app with no
 * signal would never get past the profile check to the routine they already
 * have. If nothing is saved, `fallback` is rendered as before.
 */

import React, { useEffect, useState } from 'react';

import { loadRoutine, SavedRoutine } from '../lib/routineCache';
import { RoutineScreen } from './RoutineScreen';

interface Props {
  userId: string;
  onRetry: () => void;
  onSignOut: () => void;
  fallback: React.ReactElement;
}

export function OfflineRoutineFallback({ userId, onRetry, onSignOut, fallback }: Props) {
  // undefined while reading storage, null when nothing is saved.
  const [saved, setSaved] = useState<SavedRoutine | null | undefined>(undefined);

  useEffect(() => {
    loadRoutine(userId).then(setSaved);
  }, [userId]);

  if (saved === undefined) return null;
  if (saved === null) return fallback;

  return (
    <RoutineScreen
      routine={saved.routine}
      copy={saved.copy}
      offline
      onDone={onRetry}
      onSignOut={onSignOut}
    />
  );
}
