const CACHE_PREFIX = 'fn_cache_';
const FAIL_KEY     = 'fn_fail_count';
const ERR_KEY      = 'fn_last_err';

export function recordSuccess(cacheKey, data) {
  localStorage.setItem(
    CACHE_PREFIX + cacheKey,
    JSON.stringify({ data, ts: Date.now() })
  );
  localStorage.setItem(FAIL_KEY, '0');
  localStorage.setItem(ERR_KEY, '');
}

export function recordFailure(errMessage = 'Unknown Error') {
  const current = parseInt(
    localStorage.getItem(FAIL_KEY) || '0'
  );
  localStorage.setItem(FAIL_KEY, String(current + 1));
  localStorage.setItem(ERR_KEY, String(errMessage));
  return current + 1;
}

export function getFailCount() {
  return parseInt(localStorage.getItem(FAIL_KEY) || '0');
}

export function getLastError() {
  return localStorage.getItem(ERR_KEY) || '';
}

export function resetConnectionState() {
  localStorage.setItem(FAIL_KEY, '0');
  localStorage.setItem(ERR_KEY, '');
}

export function getCached(cacheKey) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + cacheKey);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function shouldShowBanner() {
  return getFailCount() >= 3;
}
