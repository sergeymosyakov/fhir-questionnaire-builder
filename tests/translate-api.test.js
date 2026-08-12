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

// ── Provider dispatch ─────────────────────────────────────────────────────────
describe('translate-api provider dispatch', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  function configure(overrides) {
    const provider = new MapProvider();
    for (const [k, v] of Object.entries(overrides)) provider.set(k, v);
    serverConfig.register(provider); // highest priority
  }

  it('DeepL: POSTs form data via the CORS proxy with the auth key', async () => {
    configure({
      [CONFIG_KEYS.TRANSLATE_PROVIDER]: 'deepl',
      [CONFIG_KEYS.TRANSLATE_API_KEY]:  'secret',
      [CONFIG_KEYS.TRANSLATE_API]:       '',
      [CONFIG_KEYS.CORS_PROXY]:          'https://proxy.example.com',
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ translations: [{ text: 'hola' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const out = await translateBatch(['hello'], 'es');

    expect(out).toEqual(['hola']);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('https://proxy.example.com?url=');
    expect(url).toContain('deepl');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('DeepL-Auth-Key secret');
    expect(init.body).toContain('text=hello');
    expect(init.body).toContain('target_lang=ES');
  });

  it('DeepL: throws a helpful error when no API key is set', async () => {
    configure({
      [CONFIG_KEYS.TRANSLATE_PROVIDER]: 'deepl',
      [CONFIG_KEYS.TRANSLATE_API_KEY]:  '',
    });
    vi.stubGlobal('fetch', vi.fn());
    await expect(translateBatch(['hello'], 'es')).rejects.toThrow(/DeepL requires an API key/);
  });

  it('LibreTranslate: POSTs JSON to the configured endpoint', async () => {
    configure({
      [CONFIG_KEYS.TRANSLATE_PROVIDER]: 'libre',
      [CONFIG_KEYS.TRANSLATE_API]:       'https://libre.example.com/translate',
      [CONFIG_KEYS.TRANSLATE_API_KEY]:  '',
      [CONFIG_KEYS.CORS_PROXY]:          '',
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ translatedText: ['bonjour'] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const out = await translateBatch(['hello'], 'fr');

    expect(out).toEqual(['bonjour']);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://libre.example.com/translate');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ q: ['hello'], target: 'fr', format: 'text' });
  });

  it('OpenAI: parses the JSON translations object from the completion', async () => {
    configure({
      [CONFIG_KEYS.TRANSLATE_PROVIDER]: 'openai',
      [CONFIG_KEYS.TRANSLATE_API_KEY]:  'sk-test',
      [CONFIG_KEYS.TRANSLATE_API]:       '',
      [CONFIG_KEYS.CORS_PROXY]:          '',
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"translations":["hallo"]}' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const out = await translateBatch(['hello'], 'de');

    expect(out).toEqual(['hallo']);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer sk-test');
  });
});

