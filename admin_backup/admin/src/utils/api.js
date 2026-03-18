import { API_BASE } from '../config/api';

/**
 * Null-safe fallback response — prevents 'Cannot read property of null' errors.
 * Every page component can safely call `res.json()` without checking null first.
 */
const SAFE_FALLBACK = {
  ok: false,
  status: 0,
  json: async () => [],
  text: async () => '',
  headers: new Headers(),
};

export const fetchWithAuth = async (url, options = {}) => {
  const token = localStorage.getItem('adminToken');
  if (!token) {
    // No token = definitely not authenticated, redirect
    window.location.href = '/login';
    return SAFE_FALLBACK;
  }

  const MAX_RETRIES = 2;
  const TIMEOUT_MS = 30000;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        ...options,
        signal: options.signal || ctrl.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...options.headers,
        },
      });
      clearTimeout(timer);

      if (res.status === 401) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUsername');
        window.location.href = '/login';
        return SAFE_FALLBACK;
      }

      if (res.status >= 500 && attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }

      return res;

    } catch (err) {
      clearTimeout(timer);
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }
      console.error('fetchWithAuth failed:', url, err?.message);
    }
  }

  return SAFE_FALLBACK;
};

/**
 * Safely extract JSON from a response. Always returns a value, never throws.
 * Handles both old API format (array) and new v4.0 format ({data, total}).
 */
export const safeJson = async (res) => {
  if (!res || !res.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
};

export const getWithAuth = async (url, options = {}) => {
  return fetchWithAuth(url, { method: 'GET', ...options });
};

export const postWithAuth = async (url, data, options = {}) => {
  return fetchWithAuth(url, {
    method: 'POST',
    body: JSON.stringify(data),
    ...options,
  });
};

export const putWithAuth = async (url, data, options = {}) => {
  return fetchWithAuth(url, {
    method: 'PUT',
    body: JSON.stringify(data),
    ...options,
  });
};

export const deleteWithAuth = async (url, options = {}) => {
  return fetchWithAuth(url, { method: 'DELETE', ...options });
};
