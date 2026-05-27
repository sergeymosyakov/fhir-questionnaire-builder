// ── LocalStorage adapter ──────────────────────────────────────────────────────
// Implements the StorageAdapter interface using window.localStorage.
// Swap this out for a Supabase / IndexedDB adapter when needed.

export class LocalStorageAdapter {
  /** @param {string} key @returns {Promise<string|null>} */
  async getItem(key)        { return localStorage.getItem(key); }

  /** @param {string} key @param {string} value @returns {Promise<void>} */
  async setItem(key, value) { localStorage.setItem(key, value); }

  /** @param {string} key @returns {Promise<void>} */
  async removeItem(key)     { localStorage.removeItem(key); }

  /** @returns {Promise<string[]>} */
  async keys()              { return Object.keys(localStorage); }
}
