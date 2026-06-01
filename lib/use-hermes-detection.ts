'use client';

import { useEffect, useSyncExternalStore } from 'react';
import {
  hermesDetectionController,
  type HermesDetection,
  type HermesDetectionState,
} from '@/lib/hermes-detection-client';

export type { HermesDetection };

type UseHermesDetectionOptions = {
  enabled?: boolean;
  pollMs?: number | null;
};

const DISABLED_STATE: HermesDetectionState = {
  detection: null,
  loading: false,
  error: null,
};

export function useHermesDetection({ enabled = true, pollMs = null }: UseHermesDetectionOptions = {}) {
  const state = useSyncExternalStore(
    hermesDetectionController.subscribe,
    hermesDetectionController.getState,
    () => DISABLED_STATE,
  );

  useEffect(() => {
    if (!enabled) return;
    return hermesDetectionController.startPolling(pollMs);
  }, [enabled, pollMs]);

  if (!enabled) {
    return { ...DISABLED_STATE, refresh: hermesDetectionController.refresh };
  }

  return { ...state, refresh: hermesDetectionController.refresh };
}
