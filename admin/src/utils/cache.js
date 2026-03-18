export const Cache = {
  set(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify({
        data, ts: Date.now()
      }))
    } catch(e) {}
  },

  get(key) {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      return parsed?.data ?? null
    } catch(e) { return null }
  },

  clear(key) {
    try { localStorage.removeItem(key) } catch(e) {}
  }
}
