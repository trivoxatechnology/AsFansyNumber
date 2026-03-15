import { useState, useEffect, useCallback, useRef } from 'react';
import { recordSuccess, recordFailure, getCached, shouldShowBanner, getLastError } from './connectionState';

export function useResilientFetch(
  fetchFn,
  cacheKey,
  intervalMs = 30000
) {
  const cached   = getCached(cacheKey);
  const [data,   setData]   = useState(cached?.data ?? null);
  const [loading, setLoading] = useState(!cached);
  const [showBanner, setShowBanner] = useState(shouldShowBanner());
  const [lastError, setLastError] = useState(getLastError());
  const mountedRef = useRef(true);

  const execute = useCallback(async () => {
    try {
      const result = await fetchFn();
      if (!mountedRef.current) return;

      // Skip status: If fetchFn explicitly returns undefined, 
      // it means we are pausing polling (e.g. background job running).
      // We do nothing: no success, no failure.
      if (result === undefined) {
        // Still sync banner status in case other components succeeded/failed
        setShowBanner(shouldShowBanner());
        setLastError(getLastError());
        return;
      }

      if (result !== null) {
        setData(result);
        recordSuccess(cacheKey, result);
        setShowBanner(false);
        setLastError('');
      } else {
        recordFailure('Server returned empty or error response');
        setShowBanner(shouldShowBanner());
        setLastError(getLastError());
      }
    } catch (err) {
      if (!mountedRef.current) return;
      recordFailure(err.message || 'Network unreachable');
      setShowBanner(shouldShowBanner());
      setLastError(getLastError());
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [fetchFn, cacheKey]);

  useEffect(() => {
    mountedRef.current = true;
    execute();
    const interval = setInterval(execute, intervalMs);
    
    // Sync with global FAIL_KEY changes (cross-tab or cross-component)
    const handleStorage = (e) => {
      if (e.key === 'fn_fail_count' || e.key === 'fn_last_err') {
        setShowBanner(shouldShowBanner());
        setLastError(getLastError());
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      window.removeEventListener('storage', handleStorage);
    };
  }, [execute, intervalMs]);

  return { data, loading, showBanner, lastError, refresh: execute };
}
