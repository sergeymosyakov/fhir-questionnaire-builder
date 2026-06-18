// ── Server Configuration ──────────────────────────────────────────────────────
// Provider-based config system. Providers registered in priority order
// (last registered wins). Falls through to next provider if value is null.
//
// Usage:
//   serverConfig.register(new DefaultConfigProvider(cfgJson));   // lowest prio
//   serverConfig.register(new LocalStorageConfigProvider());      // medium prio
//   serverConfig.register(new SupabaseConfigProvider(cache));     // highest prio
//
// Read:  serverConfig.get('terminologyServer')
// Write: serverConfig.set('terminologyServer', url)   → first writable provider
// Init:  await serverConfig.load('./config.json')     → fetches + registers default

// ── Config keys ───────────────────────────────────────────────────────────────
export const CONFIG_KEYS = {
  CORS_PROXY:         'corsProxyUrl',
  TERMINOLOGY_SERVER: 'terminologyServer',
  NLM_API_BASE:       'nlmApiBaseUrl',
  FHIR_BASE:          'fhirBaseUrl',     // for patient / resource search
  VALIDATORS:         'validators',      // JSON array string
};

const LS_PREFIX = 'fhirqb.server.';

// ── Base provider ─────────────────────────────────────────────────────────────
export class ServerConfigProvider {
  /** @param {string} _key @returns {string|null} */
  get(_key) { return null; }
  /** @param {string} _key @param {string|null} _value */
  set(_key, _value) {}
  get writable() { return false; }
  /** Human-readable label shown in settings UI */
  get label() { return 'Unknown'; }
}

// ── Providers ─────────────────────────────────────────────────────────────────

/** Reads from a plain JS object (loaded from config.json). Read-only. */
export class DefaultConfigProvider extends ServerConfigProvider {
  constructor(cfg = {}) {
    super();
    this._cfg = cfg;
  }
  get(key) {
    const v = this._cfg[key];
    if (v == null) return null;
    return typeof v === 'string' ? v : JSON.stringify(v);
  }
  get label() { return 'Default (config.json)'; }
}

/** Reads/writes localStorage with the `fhirqb.server.*` prefix. */
export class LocalStorageConfigProvider extends ServerConfigProvider {
  get(key) {
    try { return localStorage.getItem(LS_PREFIX + key) ?? null; } catch { return null; }
  }
  set(key, value) {
    try {
      if (value == null) localStorage.removeItem(LS_PREFIX + key);
      else               localStorage.setItem(LS_PREFIX + key, value);
    } catch { /* storage unavailable */ }
  }
  get writable() { return true; }
  get label() { return 'Custom (saved in browser)'; }
}

/** Reads/writes from a pre-loaded cache object (populated from Supabase on login). */
export class SupabaseConfigProvider extends ServerConfigProvider {
  /** @param {Record<string, string>} cache  Key→value map loaded from Supabase */
  constructor(cache = {}) {
    super();
    this._cache = { ...cache };
  }
  get(key) { return this._cache[key] ?? null; }
  set(key, value) {
    if (value == null) delete this._cache[key];
    else this._cache[key] = value;
  }
  get writable() { return true; }
  get label() { return 'Cloud (your account)'; }
  /** Replace entire cache (call after fetching from Supabase). */
  hydrate(data) { this._cache = { ...data }; }
  toJSON() { return { ...this._cache }; }
}

// ── Singleton ─────────────────────────────────────────────────────────────────
function _makeServerConfig() {
  const _providers = []; // index 0 = highest priority
  let _ready = null;     // Promise — resolves when config.json is loaded

  return {
    /**
     * Register a provider. Last registered = highest priority.
     * @param {ServerConfigProvider} provider
     */
    register(provider) {
      _providers.unshift(provider);
    },

    /**
     * Fetch config.json, create DefaultConfigProvider from it and register it
     * as the lowest-priority provider. Returns the loaded config object.
     * @param {string} [url='./config.json']
     * @returns {Promise<object>}
     */
    load(url = './config.json') {
      if (_ready) return _ready;
      _ready = fetch(url)
        .then(r => r.json())
        .then(cfg => {
          // Register at lowest priority (after existing providers)
          _providers.push(new DefaultConfigProvider(cfg));
          return cfg;
        })
        .catch(() => {
          _providers.push(new DefaultConfigProvider({}));
          return {};
        });
      return _ready;
    },

    /**
     * Wait for config.json to load (if load() was called).
     * Resolves immediately if load() was never called.
     */
    ready() {
      return _ready ?? Promise.resolve({});
    },

    /**
     * Get a config value. First non-null result from providers in priority order.
     * @param {string} key
     * @returns {string|null}
     */
    get(key) {
      for (const p of _providers) {
        const v = p.get(key);
        if (v != null) return v;
      }
      return null;
    },

    /**
     * Get parsed value. Returns array for CONFIG_KEYS.VALIDATORS, string otherwise.
     * @param {string} key
     * @returns {any}
     */
    getParsed(key) {
      const v = this.get(key);
      if (v == null) return null;
      if (key === CONFIG_KEYS.VALIDATORS) {
        try { return JSON.parse(v); } catch { return null; }
      }
      return v;
    },

    /**
     * Write to the first writable provider (highest priority writable).
     * @param {string} key
     * @param {string|null} value  null = clear/reset to default
     */
    set(key, value) {
      for (const p of _providers) {
        if (p.writable) { p.set(key, value); return; }
      }
    },

    /**
     * Clear a user override — removes from the first writable provider.
     * Falls back to next provider's value on next get().
     * @param {string} key
     */
    reset(key) { this.set(key, null); },

    /**
     * Returns all registered providers (for display in settings UI).
     * @returns {ServerConfigProvider[]}
     */
    getProviders() { return [..._providers]; },

    /**
     * Returns true if any writable provider has an override for this key.
     * @param {string} key
     */
    hasOverride(key) {
      for (const p of _providers) {
        if (p.writable && p.get(key) != null) return true;
      }
      return false;
    },

    /** FOR TESTS ONLY — clears all providers and resets the ready promise. */
    _clear() { _providers.length = 0; _ready = null; },
  };
}

export const serverConfig = _makeServerConfig();
