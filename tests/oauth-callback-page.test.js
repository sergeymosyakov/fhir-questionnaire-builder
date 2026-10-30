// @vitest-environment jsdom
// ── Unit tests: js/fhir/oauth-callback-page.js ───────────────────────────────
// The module runs on import, so each test sets the URL / opener then re-imports it.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

async function runPage(search, opener) {
  history.replaceState(null, '', '/oauth-callback.html' + search);
  Object.defineProperty(window, 'opener', { value: opener, configurable: true, writable: true });
  vi.resetModules();
  await import('../js/fhir/oauth-callback-page.js');
}

let closeSpy;
beforeEach(() => { closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); });

describe('oauth-callback-page', () => {
  it('relays code and state to the opener, targeted at its own origin, then closes', async () => {
    const opener = { postMessage: vi.fn() };
    await runPage('?code=abc&state=xyz', opener);
    expect(opener.postMessage).toHaveBeenCalledTimes(1);
    expect(opener.postMessage).toHaveBeenCalledWith(
      { source: 'fhirqb-oauth-callback', code: 'abc', state: 'xyz', error: null },
      window.location.origin);
    expect(window.location.origin).not.toBe('null');
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('prefers error_description over error', async () => {
    const opener = { postMessage: vi.fn() };
    await runPage('?error=access_denied&error_description=User%20said%20no&state=s', opener);
    expect(opener.postMessage.mock.calls[0][0]).toEqual({
      source: 'fhirqb-oauth-callback', code: null, state: 's', error: 'User said no',
    });
  });

  it('falls back to the error code when there is no description', async () => {
    const opener = { postMessage: vi.fn() };
    await runPage('?error=access_denied', opener);
    expect(opener.postMessage.mock.calls[0][0].error).toBe('access_denied');
  });

  it('does not post anywhere without an opener but still closes', async () => {
    await runPage('?code=abc', null);
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });
});
