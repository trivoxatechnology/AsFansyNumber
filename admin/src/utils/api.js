import { API_BASE } from '../config/api';

const SAFE_FALLBACK = null;

export const fetchWithAuth = async (url, options = {}) => {
  const token = localStorage.getItem('ag_admin_token');
  const MAX_RETRIES = 2;
  const TIMEOUT_MS  = 30000;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

    try {
      const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
      const headers = {
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      };
      if (!isFormData && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }

      const res = await fetch(url, {
        ...options,
        signal: options.signal || ctrl.signal,
        headers,
      });
      clearTimeout(timer);

      if (res.status === 401) {
        localStorage.removeItem('ag_admin_token');
        localStorage.removeItem('ag_admin_username');
        if (window.location.pathname !== '/admin/login' && window.location.pathname !== '/login') {
          window.location.replace('/admin/login');
        }
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

export const safeJson = async (response) => {
  if (!response || !response.ok) return null;
  try {
    return await response.json();
  } catch (e) {
    console.error('safeJson failed to parse:', e);
    return null;
  }
};
