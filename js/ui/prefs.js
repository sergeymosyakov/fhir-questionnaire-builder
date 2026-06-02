// ── User Preferences ─────────────────────────────────────────────────────────
// Pure localStorage wrapper — no imports, no state, no side-effects.
// Each pref has a key and a default value.

const DEFAULTS = {
  validate:         true,   // run local validator on export / import
  validateExternal: false,  // run server (external) validators — off by default
  tips:             true,   // tooltips enabled
  autosave:         true,   // autosave enabled
};

export class Prefs {
  /** @param {string} [ns] — localStorage key prefix (default 'fhirqb') */
  constructor(ns = 'fhirqb') {
    this._ns = ns;
  }

  /** @param {'validate'|'validateExternal'|'tips'|'autosave'} key */
  get(key) {
    const raw = localStorage.getItem(this._ns + '.' + key);
    return raw === null ? DEFAULTS[key] : raw === 'true';
  }

  /** @param {'validate'|'validateExternal'|'tips'|'autosave'} key */
  set(key, value) {
    localStorage.setItem(this._ns + '.' + key, String(!!value));
  }

  toggle(key) {
    const next = !this.get(key);
    this.set(key, next);
    return next;
  }
}
