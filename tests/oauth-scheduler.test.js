// ── Unit tests: js/fhir/oauth-scheduler.js ───────────────────────────────────
// Uses fake timers to drive the self-rescheduling renewal tick without real
// delays. document.dispatchEvent is stubbed to observe OAUTH_LOGIN_REQUIRED.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { serverConfig, DefaultConfigProvider, CONFIG_KEYS } from '../js/fhir/server-config.js';
import { AppEvents } from '../js/events.js';
import { startScheduler, stopScheduler, resumeSchedulersFromStorage } from '../js/fhir/oauth-scheduler.js';

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

let dispatchMock;

beforeEach(() => {
  serverConfig._clear();
  vi.stubGlobal('localStorage', _fakeStorage());
  dispatchMock = vi.fn();
  vi.stubGlobal('document', { dispatchEvent: dispatchMock });
  vi.useFakeTimers();
});

afterEach(() => {
  stopScheduler('FHIR_BASE');
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('startScheduler', () => {
  it('is a no-op when the server has no OAuth configured', async () => {
    startScheduler('FHIR_BASE');
    await vi.runOnlyPendingTimersAsync();
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('is a no-op when there is no stored token', async () => {
    serverConfig.register(new DefaultConfigProvider(CONFIGURED));
    startScheduler('FHIR_BASE');
    await vi.runOnlyPendingTimersAsync();
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('dispatches OAUTH_LOGIN_REQUIRED immediately when the token is already expired with no refresh token', async () => {
    serverConfig.register(new DefaultConfigProvider(CONFIGURED));
    localStorage.setItem('fhirqb.oauthToken.FHIR_BASE.accessToken', 'tok');
    localStorage.setItem('fhirqb.oauthToken.FHIR_BASE.expiresAt', String(Date.now() - 1));

    startScheduler('FHIR_BASE');
    await vi.runOnlyPendingTimersAsync();

    expect(dispatchMock).toHaveBeenCalledTimes(1);
    const evt = dispatchMock.mock.calls[0][0];
    expect(evt.type).toBe(AppEvents.OAUTH_LOGIN_REQUIRED);
    expect(evt.detail).toEqual({ serverKey: 'FHIR_BASE' });
    // Token is cleared so a subsequent lazy trigger starts a fresh login.
    expect(localStorage.getItem('fhirqb.oauthToken.FHIR_BASE.accessToken')).toBeNull();
  });

  it('silently refreshes via refresh_token near expiry and reschedules', async () => {
    serverConfig.register(new DefaultConfigProvider(CONFIGURED));
    localStorage.setItem('fhirqb.oauthToken.FHIR_BASE.accessToken', 'old');
    localStorage.setItem('fhirqb.oauthToken.FHIR_BASE.refreshToken', 'r');
    localStorage.setItem('fhirqb.oauthToken.FHIR_BASE.expiresAt', String(Date.now() - 1));

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: 'new', refresh_token: 'r2', expires_in: 3600 }),
    }));

    startScheduler('FHIR_BASE');
    await vi.runOnlyPendingTimersAsync();

    expect(dispatchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('fhirqb.oauthToken.FHIR_BASE.accessToken')).toBe('new');
  });

  it('dispatches OAUTH_LOGIN_REQUIRED when the refresh call itself fails', async () => {
    serverConfig.register(new DefaultConfigProvider(CONFIGURED));
    localStorage.setItem('fhirqb.oauthToken.FHIR_BASE.accessToken', 'old');
    localStorage.setItem('fhirqb.oauthToken.FHIR_BASE.refreshToken', 'r');
    localStorage.setItem('fhirqb.oauthToken.FHIR_BASE.expiresAt', String(Date.now() - 1));

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400 }));

    startScheduler('FHIR_BASE');
    await vi.runOnlyPendingTimersAsync();

    expect(dispatchMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('fhirqb.oauthToken.FHIR_BASE.accessToken')).toBeNull();
  });
});

describe('resumeSchedulersFromStorage', () => {
  it('starts a scheduler for every server that already has a stored token', async () => {
    serverConfig.register(new DefaultConfigProvider({
      ...CONFIGURED,
      [CONFIG_KEYS.SDC_SERVER_OAUTH_AUTHORIZE_URL]: 'https://idp.example.com/oauth2/authorize',
      [CONFIG_KEYS.SDC_SERVER_OAUTH_TOKEN_URL]:     'https://idp.example.com/oauth2/token',
      [CONFIG_KEYS.SDC_SERVER_OAUTH_CLIENT_ID]:     'client-456',
    }));
    localStorage.setItem('fhirqb.oauthToken.FHIR_BASE.accessToken', 'a');
    localStorage.setItem('fhirqb.oauthToken.FHIR_BASE.expiresAt', String(Date.now() - 1));
    // SDC_SERVER has no stored token — should stay a no-op.

    resumeSchedulersFromStorage();
    await vi.runOnlyPendingTimersAsync();

    expect(dispatchMock).toHaveBeenCalledTimes(1);
    expect(dispatchMock.mock.calls[0][0].detail).toEqual({ serverKey: 'FHIR_BASE' });
    stopScheduler('SDC_SERVER');
  });
});
