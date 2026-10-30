// ── Security: OAuth authorize/token URLs must be https (http only for localhost) ─
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { serverConfig, DefaultConfigProvider, CONFIG_KEYS } from '../js/fhir/server-config.js';
import { startLogin } from '../js/fhir/oauth-client.js';

function cfg(authorizeUrl, tokenUrl) {
  serverConfig.register(new DefaultConfigProvider({
    [CONFIG_KEYS.FHIR_BASE_OAUTH_AUTHORIZE_URL]: authorizeUrl,
    [CONFIG_KEYS.FHIR_BASE_OAUTH_TOKEN_URL]: tokenUrl,
    [CONFIG_KEYS.FHIR_BASE_OAUTH_CLIENT_ID]: 'c',
  }));
}

let open;

beforeEach(() => {
  serverConfig._clear();
  open = vi.fn(() => null);
  const store = new Map();
  vi.stubGlobal('sessionStorage', { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) });
  vi.stubGlobal('window', { open, location: { href: 'https://app.example.com/', origin: 'https://app.example.com' } });
});

afterEach(() => vi.unstubAllGlobals());

describe('startLogin URL scheme checks', () => {
  it('rejects an http authorize URL before opening the popup', async () => {
    cfg('http://idp.example.com/authorize', 'https://idp.example.com/token');
    await expect(startLogin('FHIR_BASE')).rejects.toThrow(/authorize URL must use https/);
    expect(open).not.toHaveBeenCalled();
  });

  it('rejects an http token URL before opening the popup', async () => {
    cfg('https://idp.example.com/authorize', 'http://idp.example.com/token');
    await expect(startLogin('FHIR_BASE')).rejects.toThrow(/token URL must use https/);
    expect(open).not.toHaveBeenCalled();
  });

  it('rejects javascript: and unparsable URLs', async () => {
    cfg('javascript:alert(1)', 'https://idp.example.com/token');
    await expect(startLogin('FHIR_BASE')).rejects.toThrow(/https/);
    serverConfig._clear();
    cfg('not a url', 'https://idp.example.com/token');
    await expect(startLogin('FHIR_BASE')).rejects.toThrow(/not a valid URL/);
    expect(open).not.toHaveBeenCalled();
  });

  it('allows https and http://localhost (reaches window.open)', async () => {
    for (const [a, t] of [['https://idp.example.com/authorize', 'https://idp.example.com/token'], ['http://localhost:8080/authorize', 'http://localhost:8080/token']]) {
      serverConfig._clear();
      cfg(a, t);
      await expect(startLogin('FHIR_BASE')).rejects.toThrow(/Popup blocked/);
    }
    expect(open).toHaveBeenCalledTimes(2);
  });
});
