const BASE = import.meta.env.VITE_API_URL
  || 'https://yourdomain.com/api.php';

async function call(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token   = localStorage.getItem('fn_token');
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res  = await fetch(BASE + path, { headers, ...options });
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

// ── Numbers ───────────────────────────────────

// Generic — pass any combination of filters
export async function getNumbers(filters = {}) {
  const p = new URLSearchParams();
  Object.entries(filters).forEach(([k,v]) => {
    if (v !== undefined && v !== null && v !== '')
      p.set(k, v);
  });
  return call('/numbers?' + p.toString());
}

// Fetch all Couple pairs
export async function getCouples() {
  return call('/couples');
}

// Fetch all Group numbers
export async function getGroups() {
  return call('/groups');
}

// Fetch all Couple and Business groups (LEGACY - keeping for compat if needed elsewhere)
export async function getGroupsList() {
  return call('/groups-list');
}

// Load one category row for homepage
export async function getCategoryRow(categoryId, limit=12, offset=0) {
  return getNumbers({ category: categoryId, limit, offset });
}

// Load by pattern family (nav dropdown click)
export async function getByPatternFamily(categoryType, limit=24, offset=0) {
  return getNumbers({ category_type: categoryType, limit, offset });
}

// Load by exact sub-category
export async function getBySubCategory(subCategory, limit=24, offset=0) {
  return getNumbers({ sub_category: subCategory, limit, offset });
}

// Load all 5 homepage rows in parallel
export async function getHomepageRows(limitPerRow=12) {
  const [diamond,platinum,gold,silver,bronze, groups] = await Promise.all([
    getCategoryRow(1, limitPerRow),
    getCategoryRow(2, limitPerRow),
    getCategoryRow(3, limitPerRow),
    getCategoryRow(4, limitPerRow),
    getCategoryRow(5, limitPerRow),
    getGroupsList().catch(() => ({ success: false, data: [] }))
  ]);
  return { diamond, platinum, gold, silver, bronze, groups };
}

// ── Meta ──────────────────────────────────────

export async function getStats()      { return call('/numbers/stats'); }
export async function getFeatured()   { return call('/numbers/featured'); }
export async function getCategories() { return call('/categories'); }
export async function getPatterns()   { return call('/patterns'); }

// ── Search ────────────────────────────────────

export async function searchNumbers(query, limit=24) {
  return call(`/search?q=${encodeURIComponent(query)}&limit=${limit}`);
}

// ── Auth helpers ──────────────────────────────

export function getUser() {
  try { return JSON.parse(localStorage.getItem('fn_user')); }
  catch { return null; }
}
export function isLoggedIn() { return !!getUser(); }
export function setAuthData(token, user) {
  localStorage.setItem('fn_token', token);
  localStorage.setItem('fn_user', JSON.stringify(user));
}
export function logout() {
  localStorage.removeItem('fn_token');
  localStorage.removeItem('fn_user');
}

// ── Cart ──────────────────────────────────────

export async function addToCart(numberId) {
  return call('/cart/add', {
    method:'POST',
    body: JSON.stringify({ number_id: numberId }),
  });
}
export async function getCart()          { return call('/cart'); }
export async function removeFromCart(id) {
  return call('/cart/remove', {
    method:'POST',
    body: JSON.stringify({ number_id: id }),
  });
}

// ── Orders ────────────────────────────────────

export async function placeOrder(numberIds, notes='') {
  return call('/order', {
    method:'POST',
    body: JSON.stringify({ number_ids: numberIds, notes }),
  });
}
