// ── Unit tests: js/fhir/server-config.js ─────────────────────────────────────
// ServerConfig is a pure in-memory config provider system — no DOM required.
// fetch is mocked via vi.stubGlobal for the load() tests.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ServerConfigProvider,
  DefaultConfigProvider,
  LocalStorageConfigProvider,
  SupabaseConfigProvider,
  CONFIG_KEYS,
  serverConfig,
} from '../js/fhir/server-config.js';

// ── CONFIG_KEYS ───────────────────────────────────────────────────────────────

describe('CONFIG_KEYS', () => {
  it('has CORS_PROXY key', () => {
    expect(CONFIG_KEYS.CORS_PROXY).toBe('corsProxyUrl');
  });
  it('has TERMINOLOGY_SERVER key', () => {
    expect(CONFIG_KEYS.TERMINOLOGY_SERVER).toBe('terminologyServer');
  });
  it('has VALIDATORS key', () => {
    expect(CONFIG_KEYS.VALIDATORS).toBe('validators');
  });
});

// ── ServerConfigProvider (base) ───────────────────────────────────────────────

describe('ServerConfigProvider (base)', () => {
  let p;
  beforeEach(() => { p = new ServerConfigProvider(); });

  it('get returns null for any key', () => {
    expect(p.get('terminologyServer')).toBeNull();
    expect(p.get('anything')).toBeNull();
  });

  it('set is a no-op and does not throw', () => {
    expect(() => p.set('key', 'value')).not.toThrow();
  });

  it('writable is false', () => {
    expect(p.writable).toBe(false);
  });

  it('label is "Unknown"', () => {
    expect(p.label).toBe('Unknown');
  });
});

// ── DefaultConfigProvider ─────────────────────────────────────────────────────

describe('DefaultConfigProvider', () => {
  it('returns string values from cfg object', () => {
    const p = new DefaultConfigProvider({ terminologyServer: 'https://tx.fhir.org' });
    expect(p.get('terminologyServer')).toBe('https://tx.fhir.org');
  });

  it('returns null for missing keys', () => {
    const p = new DefaultConfigProvider({ a: 'b' });
    expect(p.get('missing')).toBeNull();
  });

  it('returns null for null values', () => {
    const p = new DefaultConfigProvider({ key: null });
    expect(p.get('key')).toBeNull();
  });

  it('returns null for undefined values', () => {
    const p = new DefaultConfigProvider({ key: undefined });
    expect(p.get('key')).toBeNull();
  });

  it('JSON.stringifies non-string values (e.g. arrays)', () => {
    const validators = [{ url: 'https://hapi.fhir.org' }];
    const p = new DefaultConfigProvider({ validators });
    expect(p.get('validators')).toBe(JSON.stringify(validators));
  });

  it('label is "Default (config.json)"', () => {
    const p = new DefaultConfigProvider();
    expect(p.label).toBe('Default (config.json)');
  });

  it('writable is false (inherited from base)', () => {
    expect(new DefaultConfigProvider().writable).toBe(false);
  });
});

// ── LocalStorageConfigProvider ────────────────────────────────────────────────

describe('LocalStorageConfigProvider', () => {
  let p;
  beforeEach(() => { p = new LocalStorageConfigProvider(); });

  it('get returns null when localStorage is unavailable in Node env', () => {
    // In Node test env, localStorage is undefined → try/catch returns null
    expect(p.get('key')).toBeNull();
  });

  it('set does not throw when localStorage is unavailable', () => {
    expect(() => p.set('key', 'value')).not.toThrow();
    expect(() => p.set('key', null)).not.toThrow();
  });

  it('writable is true', () => {
    expect(p.writable).toBe(true);
  });

  it('label is "Custom (saved in browser)"', () => {
    expect(p.label).toBe('Custom (saved in browser)');
  });

  it('set and get round-trip when localStorage is available', () => {
    const store = {};
    vi.stubGlobal('localStorage', {
      getItem:    (k) => store[k] ?? null,
      setItem:    (k, v) => { store[k] = v; },
      removeItem: (k) => { delete store[k]; },
    });
    try {
      p.set('myKey', 'myVal');
      expect(p.get('myKey')).toBe('myVal');
      p.set('myKey', null);
      expect(p.get('myKey')).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

// ── SupabaseConfigProvider ────────────────────────────────────────────────────

describe('SupabaseConfigProvider', () => {
  it('constructor accepts initial cache', () => {
    const p = new SupabaseConfigProvider({ terminologyServer: 'https://tx.fhir.org' });
    expect(p.get('terminologyServer')).toBe('https://tx.fhir.org');
  });

  it('constructor defaults to empty cache', () => {
    const p = new SupabaseConfigProvider();
    expect(p.get('anything')).toBeNull();
  });

  it('get returns null for missing key', () => {
    const p = new SupabaseConfigProvider({ a: 'b' });
    expect(p.get('missing')).toBeNull();
  });

  it('set stores a value', () => {
    const p = new SupabaseConfigProvider({});
    p.set('key', 'value');
    expect(p.get('key')).toBe('value');
  });

  it('set with null deletes the key', () => {
    const p = new SupabaseConfigProvider({ key: 'original' });
    p.set('key', null);
    expect(p.get('key')).toBeNull();
  });

  it('writable is true', () => {
    expect(new SupabaseConfigProvider({}).writable).toBe(true);
  });

  it('label is "Cloud (your account)"', () => {
    expect(new SupabaseConfigProvider({}).label).toBe('Cloud (your account)');
  });

  it('hydrate replaces entire cache', () => {
    const p = new SupabaseConfigProvider({ old: 'data' });
    p.hydrate({ newKey: 'newVal' });
    expect(p.get('newKey')).toBe('newVal');
    expect(p.get('old')).toBeNull();
  });

  it('toJSON returns a shallow copy of the cache', () => {
    const p = new SupabaseConfigProvider({ key: 'val' });
    const json = p.toJSON();
    expect(json).toEqual({ key: 'val' });
    // Ensure it's a copy, not the same reference
    json.extra = 'x';
    expect(p.get('extra')).toBeNull();
  });
});

// ── serverConfig singleton ────────────────────────────────────────────────────

describe('serverConfig', () => {
  beforeEach(() => {
    serverConfig._clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('get returns null when no providers registered', () => {
    expect(serverConfig.get('any')).toBeNull();
  });

  it('register + get returns value from registered provider', () => {
    serverConfig.register(new DefaultConfigProvider({ key: 'value' }));
    expect(serverConfig.get('key')).toBe('value');
  });

  it('last registered provider has highest priority', () => {
    serverConfig.register(new DefaultConfigProvider({ key: 'low-priority' }));
    serverConfig.register(new SupabaseConfigProvider({ key: 'high-priority' }));
    expect(serverConfig.get('key')).toBe('high-priority');
  });

  it('falls through to lower-priority provider when value is null', () => {
    serverConfig.register(new DefaultConfigProvider({ key: 'fallback' }));
    serverConfig.register(new SupabaseConfigProvider({}));  // no 'key'
    expect(serverConfig.get('key')).toBe('fallback');
  });

  it('returns null when all providers return null', () => {
    serverConfig.register(new DefaultConfigProvider({}));
    serverConfig.register(new SupabaseConfigProvider({}));
    expect(serverConfig.get('missing')).toBeNull();
  });

  it('getParsed returns string value for non-VALIDATORS keys', () => {
    serverConfig.register(new DefaultConfigProvider({ terminologyServer: 'https://tx.fhir.org' }));
    expect(serverConfig.getParsed('terminologyServer')).toBe('https://tx.fhir.org');
  });

  it('getParsed parses JSON array for VALIDATORS key', () => {
    const validators = [{ url: 'https://hapi.fhir.org', name: 'HAPI' }];
    serverConfig.register(new DefaultConfigProvider({ validators }));
    expect(serverConfig.getParsed(CONFIG_KEYS.VALIDATORS)).toEqual(validators);
  });

  it('getParsed returns null for missing key', () => {
    expect(serverConfig.getParsed('notfound')).toBeNull();
  });

  it('getParsed returns null for malformed JSON in VALIDATORS', () => {
    serverConfig.register({
      get: (key) => key === 'validators' ? 'not valid json{' : null,
      writable: false,
    });
    expect(serverConfig.getParsed(CONFIG_KEYS.VALIDATORS)).toBeNull();
  });

  it('set writes to the first writable provider', () => {
    serverConfig.register(new DefaultConfigProvider({ key: 'default' }));
    const supabase = new SupabaseConfigProvider({});
    serverConfig.register(supabase);
    serverConfig.set('key', 'custom');
    expect(serverConfig.get('key')).toBe('custom');
  });

  it('set does nothing when no writable providers exist', () => {
    serverConfig.register(new DefaultConfigProvider({ key: 'readonly' }));
    expect(() => serverConfig.set('key', 'new')).not.toThrow();
    // DefaultConfigProvider is read-only, value unchanged
    expect(serverConfig.get('key')).toBe('readonly');
  });

  it('reset clears override in writable provider (falls back to lower priority)', () => {
    serverConfig.register(new DefaultConfigProvider({ key: 'default' }));
    const supabase = new SupabaseConfigProvider({ key: 'override' });
    serverConfig.register(supabase);
    expect(serverConfig.get('key')).toBe('override');
    serverConfig.reset('key');
    expect(serverConfig.get('key')).toBe('default');
  });

  it('getProviders returns all registered providers', () => {
    const p1 = new DefaultConfigProvider({});
    const p2 = new SupabaseConfigProvider({});
    serverConfig.register(p1);
    serverConfig.register(p2);
    const providers = serverConfig.getProviders();
    expect(providers).toHaveLength(2);
    expect(providers).toContain(p1);
    expect(providers).toContain(p2);
  });

  it('hasOverride returns true when writable provider has the key', () => {
    serverConfig.register(new SupabaseConfigProvider({ key: 'val' }));
    expect(serverConfig.hasOverride('key')).toBe(true);
  });

  it('hasOverride returns false when only read-only providers have the key', () => {
    serverConfig.register(new DefaultConfigProvider({ key: 'readonly-val' }));
    expect(serverConfig.hasOverride('key')).toBe(false);
  });

  it('hasOverride returns false when writable provider has no value for key', () => {
    serverConfig.register(new SupabaseConfigProvider({}));
    expect(serverConfig.hasOverride('missing')).toBe(false);
  });

  it('ready() resolves immediately when load() was never called', async () => {
    const result = await serverConfig.ready();
    expect(result).toEqual({});
  });

  it('load() fetches config.json and registers a DefaultConfigProvider', async () => {
    const mockCfg  = { terminologyServer: 'https://test.fhir.org' };
    const fetchMock = vi.fn().mockResolvedValue({ json: () => Promise.resolve(mockCfg) });
    vi.stubGlobal('fetch', fetchMock);

    const cfg = await serverConfig.load('./test-config.json');
    expect(cfg).toEqual(mockCfg);
    expect(serverConfig.get('terminologyServer')).toBe('https://test.fhir.org');
    expect(fetchMock).toHaveBeenCalledWith('./test-config.json');
  });

  it('load() returns cached promise on repeated calls', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ k: 'v' }) });
    vi.stubGlobal('fetch', fetchMock);

    await serverConfig.load('./config.json');
    await serverConfig.load('./other.json');   // second call — uses cache
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('load() falls back to empty config when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    const cfg = await serverConfig.load('./missing.json');
    expect(cfg).toEqual({});
  });

  it('ready() returns the same promise as load()', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ k: 'val' }) });
    vi.stubGlobal('fetch', fetchMock);
    serverConfig.load('./config.json');        // don't await yet
    const cfg = await serverConfig.ready();   // should return the same promise
    expect(cfg).toEqual({ k: 'val' });
  });

  it('_clear resets providers and the ready promise', async () => {
    serverConfig.register(new DefaultConfigProvider({ key: 'val' }));
    serverConfig._clear();
    expect(serverConfig.get('key')).toBeNull();
    expect(serverConfig.getProviders()).toHaveLength(0);
    // ready() should resolve to {} again after _clear
    const result = await serverConfig.ready();
    expect(result).toEqual({});
  });
});
