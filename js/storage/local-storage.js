// ── LocalStorage adapter ──────────────────────────────────────────────────────
// Implements the StorageAdapter interface using window.localStorage.
// Swap this out for a Supabase / IndexedDB adapter when needed.

export class LocalStorageAdapter {
  /** @param {string} key @returns {string|null} */
  getItem(key)        { return localStorage.getItem(key); }

  /** @param {string} key @param {string} value */
  setItem(key, value) { localStorage.setItem(key, value); }

  /** @param {string} key */
  removeItem(key)     { localStorage.removeItem(key); }

  /** @returns {string[]} */
  keys()              { return Object.keys(localStorage); }
}
