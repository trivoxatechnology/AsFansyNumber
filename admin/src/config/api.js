/**
 * Shared API configuration for admin app.
 * Uses VITE_API_URL env variable for dev/production switching.
 *
 * Dev:  Vite proxy at /fancy_number/api.php → Hostinger
 * Prod: Direct URL to https://asfancynumber.com/admin/api.php
 */
export const API_BASE = import.meta.env.VITE_API_URL || '/fancy_number/api.php';

export function apiUrl(path) {
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  return `${API_BASE}/${normalized}`;
}

export function getTemplateUrl(format = 'xlsx') {
  const base = API_BASE.substring(0, API_BASE.lastIndexOf('/'));
  return `${base}/ajax/download-template.php?format=${format}`;
}
