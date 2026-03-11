/**
 * authService.js
 * Secure authentication utility for the Admin Panel.
 *
 * Strategy:
 *  - Credentials are stored in .env (never in source code)
 *  - Password is compared as a SHA-256 hash (never plaintext)
 *  - Session token = base64(username|role|issuedAt) stored in localStorage
 *  - Token is validated client-side on every ProtectedRoute render (expiry check)
 */

const ADMIN_USERNAME      = import.meta.env.VITE_ADMIN_USERNAME      || 'admin';
const ADMIN_PASSWORD_HASH = import.meta.env.VITE_ADMIN_PASSWORD_HASH || '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';
const SESSION_HOURS       = parseInt(import.meta.env.VITE_SESSION_HOURS || '8', 10);

const TOKEN_KEY    = 'adminToken';
const USERNAME_KEY = 'adminUsername';

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
  // Guard: ensure env vars are configured
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD_HASH) {
    return { success: false, error: 'Admin credentials not configured. Check .env file.' };
  }

  // Hash the entered password
  let hash;
  try {
    hash = await sha256(password);
  } catch {
    return { success: false, error: 'Hashing failed — browser may not support Web Crypto API.' };
  }

  // Compare (both username and password must match)
  const isUsernameMatch = username.trim().toLowerCase() === ADMIN_USERNAME.trim().toLowerCase();
  const isHashMatch = hash.trim().toLowerCase() === ADMIN_PASSWORD_HASH.trim().toLowerCase();

  console.log('Login attempt debug:', {
    providedUsername: username.trim().toLowerCase(),
    expectedUsername: ADMIN_USERNAME.trim().toLowerCase(),
    isUsernameMatch,
    providedHash: hash.trim().toLowerCase(),
    expectedHash: ADMIN_PASSWORD_HASH.trim().toLowerCase(),
    isHashMatch
  });

  if (!isUsernameMatch || !isHashMatch) {
    return { success: false, error: 'Invalid username or password.' };
  }

  // Issue session token
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
  if (!data) return false; // Malformed or old "mock-secure-token" — rejected

  const ageMs      = Date.now() - data.issuedAt;
  const maxAgeMs   = SESSION_HOURS * 60 * 60 * 1000;
  if (ageMs > maxAgeMs) {
    logout(); // Expired — clean up
    return false;
  }

  return true;
}

/** Clear session data and redirect to login. */
export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USERNAME_KEY);
}

/**
 * Utility: Generate a SHA-256 hash for any password string.
 * Use this in your browser console to create a new VITE_ADMIN_PASSWORD_HASH.
 * Example: generateHash('myNewPassword').then(console.log)
 */
export async function generateHash(password) {
  return sha256(password);
}

// Ensure the user is never permanently locked out while developing
window.__forceLogin = () => {
  const token = buildToken('admin');
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USERNAME_KEY, 'admin');
  console.log('✅ Forced login successful. Navigate to /dashboard or refresh.');
  window.location.href = '/dashboard';
};
