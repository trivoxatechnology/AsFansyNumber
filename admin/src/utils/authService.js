/**
 * authService.js
 * Secure authentication utility for the Admin Panel.
 *
 * Strategy:
 *  - Credentials are stored in .env (never in source code)
 *  - Password is compared as a SHA-256 hash (never plaintext)
 *  - Session token = base64(username|issuedAt) stored in localStorage
 *  - Token is validated client-side on every ProtectedRoute render (expiry check)
 */

const ADMIN_USERNAME      = import.meta.env.VITE_ADMIN_USERNAME      || 'admin';
const ADMIN_PASSWORD_HASH = import.meta.env.VITE_ADMIN_PASSWORD_HASH || '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';
const SESSION_HOURS       = parseInt(import.meta.env.VITE_SESSION_HOURS || '8', 10);

const TOKEN_KEY    = 'ag_admin_token';
const USERNAME_KEY = 'ag_admin_username';

/** Compute SHA-256 hash of a plain-text string. */
async function sha256(str) {
  const encoded = new TextEncoder().encode(str);
  const hashBuf = await crypto.subtle.digest('SHA-256', encoded);
  return [...new Uint8Array(hashBuf)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Build a session token: base64(username|issuedAtMs) */
function buildToken(username) {
  const payload = `${username}|${Date.now()}`;
  return btoa(payload);
}

/** Decode token back to { username, issuedAt } — returns null if malformed */
function decodeToken(token) {
  try {
    const decoded = atob(token);
    const parts   = decoded.split('|');
    if (parts.length < 2) return null;
    const username  = parts[0];
    const issuedAt  = parseInt(parts[1], 10);
    if (!username || isNaN(issuedAt)) return null;
    return { username, issuedAt };
  } catch {
    return null;
  }
}

/**
 * Attempt to log in with provided credentials.
 * Returns { success: true, username } or { success: false, error: '...' }
 */
export async function login(username, password) {
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD_HASH) {
    return { success: false, error: 'Admin credentials not configured. Check .env file.' };
  }

  let hash;
  try {
    hash = await sha256(password);
  } catch {
    return { success: false, error: 'Hashing failed — browser may not support Web Crypto API.' };
  }

  const isUsernameMatch = username.trim().toLowerCase() === ADMIN_USERNAME.trim().toLowerCase();
  const isHashMatch = hash.trim().toLowerCase() === ADMIN_PASSWORD_HASH.trim().toLowerCase();

<<<<<<< HEAD
=======
  // Debug removed in v4.0 — never log credentials in production

>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f
  if (!isUsernameMatch || !isHashMatch) {
    return { success: false, error: 'Invalid username or password.' };
  }

  const token = buildToken(username.trim());
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USERNAME_KEY, username.trim());

  return { success: true, username: username.trim() };
}

/**
 * Validate the current session.
 * Returns true if a valid, non-expired token exists in localStorage.
 */
export function validateSession() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return false;

  const data = decodeToken(token);
  if (!data) return false;

  const ageMs    = Date.now() - data.issuedAt;
  const maxAgeMs = SESSION_HOURS * 60 * 60 * 1000;
  if (ageMs > maxAgeMs) {
    logout();
    return false;
  }

  return true;
}

/** Clear session data. */
export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USERNAME_KEY);
}

/**
 * Utility: Generate a SHA-256 hash for any password string.
 * Example: generateHash('myNewPassword').then(console.log)
 */
export async function generateHash(password) {
  return sha256(password);
}

<<<<<<< HEAD
// Dev-only escape hatch
=======
// Dev-only escape hatch — never available in production builds
>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f
if (import.meta.env.DEV) {
  window.__forceLogin = () => {
    const token = buildToken('admin');
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USERNAME_KEY, 'admin');
    window.location.href = '/dashboard';
  };
}
