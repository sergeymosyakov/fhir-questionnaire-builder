// ── Unit tests: js/fhir/oauth-client.js ──────────────────────────────────────
// Focused on the pure/testable pieces (config resolution, token storage,
// refresh, ensureLoggedIn's early-return paths). The full popup + postMessage
// login flow (startLogin) needs real browser APIs and is left to manual/e2e
// testing — see docs/FHIR-SERVER-AUTH-PLAN.md.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { serverConfig, DefaultConfigProvider, CONFIG_KEYS } from '../js/fhir/server-config.js';
import {
  isOauthConfigured,
  getStoredToken,
  getValidAccessToken,
  clearStoredToken,
  refreshAccessToken,
  ensureLoggedIn,
} from '../js/fhir/oauth-client.js';

function _fakeStorage() {
  const store = new Map();
  return {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
  };
}

const CONFIGURED = {
  [CONFIG_KEYS.FHIR_BASE_OAUTH_AUTHORIZE_URL]: 'https://idp.example.com/oauth2/authorize',
  [CONFIG_KEYS.FHIR_BASE_OAUTH_TOKEN_URL]:     'https://idp.example.com/oauth2/token',
  [CONFIG_KEYS.FHIR_BASE_OAUTH_CLIENT_ID]:     'client-123',
};

beforeEach(() => {
  serverConfig._clear();
  vi.stubGlobal('localStorage', _fakeStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isOauthConfigured', () => {
  it('is false with no config registered', () => {
    expect(isOauthConfigured('FHIR_BASE')).toBe(false);
  });

  it('is false when a required field is missing', () => {
    serverConfig.register(new DefaultConfigProvider({
      [CONFIG_KEYS.FHIR_BASE_OAUTH_AUTHORIZE_URL]: 'https://idp.example.com/authorize',
    }));
    expect(isOauthConfigured('FHIR_BASE')).toBe(false);
  });

  it('is true when authorizeUrl/tokenUrl/clientId are all set', () => {
    serverConfig.register(new DefaultConfigProvider(CONFIGURED));
    expect(isOauthConfigured('FHIR_BASE')).toBe(true);
  });

  it('is false for an unknown serverKey', () => {
    serverConfig.register(new DefaultConfigProvider(CONFIGURED));
    expect(isOauthConfigured('NOT_A_SERVER')).toBe(false);
  });
});

describe('token storage (getStoredToken / getValidAccessToken / clearStoredToken)', () => {
  it('getStoredToken returns null when nothing is stored', () => {
    expect(getStoredToken('FHIR_BASE')).toBeNull();
  });

  it('getValidAccessToken returns null for an expired token', () => {
    localStorage.setItem('fhirqb.oauthToken.FHIR_BASE.accessToken', 'tok');
    localStorage.setItem('fhirqb.oauthToken.FHIR_BASE.expiresAt', String(Date.now() - 1000));
    expect(getValidAccessToken('FHIR_BASE')).toBeNull();
  });

  it('getValidAccessToken returns the token when still valid', () => {
    localStorage.setItem('fhirqb.oauthToken.FHIR_BASE.accessToken', 'tok');
    localStorage.setItem('fhirqb.oauthToken.FHIR_BASE.expiresAt', String(Date.now() + 60_000));
    expect(getValidAccessToken('FHIR_BASE')).toBe('tok');
  });

  it('clearStoredToken removes access/refresh/expiry', () => {
    localStorage.setItem('fhirqb.oauthToken.FHIR_BASE.accessToken', 'tok');
    localStorage.setItem('fhirqb.oauthToken.FHIR_BASE.refreshToken', 'rtok');
    localStorage.setItem('fhirqb.oauthToken.FHIR_BASE.expiresAt', String(Date.now() + 60_000));
    clearStoredToken('FHIR_BASE');
    expect(getStoredToken('FHIR_BASE')).toBeNull();
  });
});

describe('refreshAccessToken', () => {
  beforeEach(() => {
    serverConfig.register(new DefaultConfigProvider(CONFIGURED));
  });

  it('throws no-refresh-token when nothing is stored', async () => {
    await expect(refreshAccessToken('FHIR_BASE')).rejects.toThrow('no-refresh-token');
  });

  it('exchanges the refresh token and stores the new access token', async () => {
    localStorage.setItem('fhirqb.oauthToken.FHIR_BASE.refreshToken', 'old-refresh');
    localStorage.setItem('fhirqb.oauthToken.FHIR_BASE.accessToken', 'old-access');
    localStorage.setItem('fhirqb.oauthToken.FHIR_BASE.expiresAt', String(Date.now() - 1));

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 }),
    }));

    const token = await refreshAccessToken('FHIR_BASE');
    expect(token).toBe('new-access');
    expect(getValidAccessToken('FHIR_BASE')).toBe('new-access');
    expect(getStoredToken('FHIR_BASE').refreshToken).toBe('new-refresh');
  });

  it('keeps the old refresh token if the server does not rotate it', async () => {
    localStorage.setItem('fhirqb.oauthToken.FHIR_BASE.accessToken', 'old-access');
    localStorage.setItem('fhirqb.oauthToken.FHIR_BASE.expiresAt', String(Date.now() - 1));
    localStorage.setItem('fhirqb.oauthToken.FHIR_BASE.refreshToken', 'stays-the-same');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: 'new-access', expires_in: 3600 }),
    }));
    await refreshAccessToken('FHIR_BASE');
    expect(getStoredToken('FHIR_BASE').refreshToken).toBe('stays-the-same');
  });

  it('throws when the token endpoint returns a non-ok response', async () => {
    localStorage.setItem('fhirqb.oauthToken.FHIR_BASE.accessToken', 'old-access');
    localStorage.setItem('fhirqb.oauthToken.FHIR_BASE.expiresAt', String(Date.now() - 1));
    localStorage.setItem('fhirqb.oauthToken.FHIR_BASE.refreshToken', 'r');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400 }));
    await expect(refreshAccessToken('FHIR_BASE')).rejects.toThrow('HTTP 400');
  });
});

describe('ensureLoggedIn', () => {
  it('returns null when the server has no OAuth configured', async () => {
    expect(await ensureLoggedIn('FHIR_BASE')).toBeNull();
  });

  it('returns the existing token without any network call when still valid', async () => {
    serverConfig.register(new DefaultConfigProvider(CONFIGURED));
    localStorage.setItem('fhirqb.oauthToken.FHIR_BASE.accessToken', 'tok');
    localStorage.setItem('fhirqb.oauthToken.FHIR_BASE.expiresAt', String(Date.now() + 60_000));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(await ensureLoggedIn('FHIR_BASE')).toBe('tok');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('silently refreshes when the token is expired but a refresh token exists', async () => {
    serverConfig.register(new DefaultConfigProvider(CONFIGURED));
    localStorage.setItem('fhirqb.oauthToken.FHIR_BASE.accessToken', 'old');
    localStorage.setItem('fhirqb.oauthToken.FHIR_BASE.expiresAt', String(Date.now() - 1000));
    localStorage.setItem('fhirqb.oauthToken.FHIR_BASE.refreshToken', 'r');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: 'refreshed', expires_in: 3600 }),
    }));

    expect(await ensureLoggedIn('FHIR_BASE')).toBe('refreshed');
  });
});
