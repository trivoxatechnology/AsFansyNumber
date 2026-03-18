/**
 * Shared API configuration for admin app.
 * Centralizes base URL for easy environment switching.
 */
export const API_BASE = '/fancy_number/api.php';

export function apiUrl(path) {
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  return `${API_BASE}/${normalized}`;
}

export function getTemplateUrl(format = 'xlsx') {
  // Extract the base directory from API_BASE and point to ajax folder
  // If API_BASE is .../fancy_number/api.php, we want .../fancy_number/ajax/...
  const base = API_BASE.substring(0, API_BASE.lastIndexOf('/'));
  return `${base}/ajax/download-template.php?format=${format}`;
}
