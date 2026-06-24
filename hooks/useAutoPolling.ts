/**
 * useAutoPolling Hook
 * 
 * Provides automatic polling for real-time data updates.
 * Polls at a configurable interval until the component unmounts.
 */
import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';

interface UseAutoPollingOptions {
  intervalMs?: number;
  enabled?: boolean;
  fetchOnMount?: boolean;
  pauseInBackground?: boolean;
}

export function useAutoPolling(
  fetchFn: () => void | Promise<void>,
  options: UseAutoPollingOptions = {}
) {
  const {
    intervalMs = 10000,
    enabled = true,
    fetchOnMount = true,
    pauseInBackground = true,
  } = options;

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const fetchFnRef = useRef(fetchFn);
  const intervalMsRef = useRef(intervalMs);
  const enabledRef = useRef(enabled);
  const hasInitialFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);

  // Keep refs in sync
  useEffect(() => {
    fetchFnRef.current = fetchFn;
  }, [fetchFn]);

  useEffect(() => {
    intervalMsRef.current = intervalMs;
  }, [intervalMs]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const runFetch = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      await Promise.resolve(fetchFnRef.current());
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  // Stable callbacks using refs - no dependencies needed
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      runFetch();
    }, intervalMsRef.current);
  }, [runFetch]);

  // Handle app state changes (pause in background)
  useEffect(() => {
    if (!pauseInBackground) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const wasBackground = appStateRef.current.match(/inactive|background/);
      const isNowActive = nextAppState === 'active';

      if (wasBackground && isNowActive && enabledRef.current) {
        console.log('[useAutoPolling] App came to foreground, resuming polling');
        runFetch();
        startPolling();
      } else if (nextAppState.match(/inactive|background/)) {
        console.log('[useAutoPolling] App went to background, pausing polling');
        stopPolling();
      }

      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [pauseInBackground, runFetch, startPolling, stopPolling]);

  // Main polling effect - runs only on enabled/fetchOnMount changes
  useEffect(() => {
    if (!enabled) {
      stopPolling();
      return;
    }

    // Initial fetch only once (StrictMode-safe)
    if (fetchOnMount && !hasInitialFetchedRef.current) {
      console.log('[useAutoPolling] Initial fetch on mount');
      runFetch();
      hasInitialFetchedRef.current = true;
    }

    startPolling();
    return () => stopPolling();
  }, [enabled, fetchOnMount, runFetch, startPolling, stopPolling]);

  return {
    startPolling,
    stopPolling,
    refetch: useCallback(() => runFetch(), [runFetch]),
  };
}

export default useAutoPolling;