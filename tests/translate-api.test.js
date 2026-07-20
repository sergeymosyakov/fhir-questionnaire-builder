// ── translate-api tests ───────────────────────────────────────────────────────
// Verifies that translateBatch calls the endpoint configured in serverConfig
// (CONFIG_KEYS.TRANSLATE_API), falling back to the default Google gtx endpoint.
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  serverConfig,
  ServerConfigProvider,
  CONFIG_KEYS,
} from '../js/fhir/server-config.js';
import { translateBatch } from '../js/fhir/translate-api.js';

const DEFAULT_ENDPOINT = 'https://translate.googleapis.com/translate_a/single';

// gtx response shape: [ [[translated, original, null, null, 1], ...], ... ]
function gtxResponse(translated) {
  return { ok: true, json: async () => [[[translated, translated, null, null, 1]], null] };
}

// Minimal in-memory provider (localStorage is unavailable in the Node test env).
class MapProvider extends ServerConfigProvider {
  constructor() { super(); this._m = {}; }
  get(key) { return this._m[key] ?? null; }
  set(key, value) { if (value == null) delete this._m[key]; else this._m[key] = value; }
  get writable() { return true; }
}

describe('translate-api endpoint configuration', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('uses the default Google gtx endpoint when no override is configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue(gtxResponse('hola'));
    vi.stubGlobal('fetch', fetchMock);

    const out = await translateBatch(['hello'], 'es');

    expect(out).toEqual(['hola']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain(DEFAULT_ENDPOINT);
    expect(fetchMock.mock.calls[0][0]).toContain('tl=es');
  });

  it('uses the configured endpoint URL when set in serverConfig', async () => {
    const custom = 'https://my-proxy.example.com/translate';
    const provider = new MapProvider();
    provider.set(CONFIG_KEYS.TRANSLATE_API, custom);
    serverConfig.register(provider); // highest priority

    const fetchMock = vi.fn().mockResolvedValue(gtxResponse('bonjour'));
    vi.stubGlobal('fetch', fetchMock);

    const out = await translateBatch(['hello'], 'fr');

    expect(out).toEqual(['bonjour']);
    expect(fetchMock.mock.calls[0][0]).toContain(custom);
    expect(fetchMock.mock.calls[0][0]).not.toContain(DEFAULT_ENDPOINT);
    expect(fetchMock.mock.calls[0][0]).toContain('tl=fr');
  });
});
