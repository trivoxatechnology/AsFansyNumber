/**
 * Shared API configuration for admin app.
 * Centralizes base URL for easy environment switching.
 */
export const API_BASE = 'https://asfancynumber.com/fancy_number/api.php';

export function apiUrl(path) {
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  return `${API_BASE}/${normalized}`;
}
