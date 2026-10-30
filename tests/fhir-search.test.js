// ── Unit tests: js/fhir/fhir-search.js ───────────────────────────────────────
// fetch and the OAuth client are mocked; serverConfig.get is stubbed per test.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../js/fhir/oauth-client.js', () => ({
  getValidAccessToken: vi.fn(() => null),
  refreshAccessToken:  vi.fn(async () => {}),
  clearStoredToken:    vi.fn(),
}));

import {
  proxiedUrl, fhirAuthHeaderFor, reauthHeaderFor, displayName,
  searchFhir, getResourceByReference,
} from '../js/fhir/fhir-search.js';
import { serverConfig } from '../js/fhir/server-config.js';
import * as oauth from '../js/fhir/oauth-client.js';

const BASE = 'https://fhir.example.org/r4';

function jsonRes(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

let cfg;
beforeEach(() => {
  cfg = { fhirBaseUrl: BASE, corsProxyUrl: null };
  vi.spyOn(serverConfig, 'get').mockImplementation(k => cfg[k] ?? null);
  oauth.getValidAccessToken.mockReset().mockReturnValue(null);
  oauth.refreshAccessToken.mockReset().mockResolvedValue(undefined);
  oauth.clearStoredToken.mockReset();
  vi.stubGlobal('sessionStorage', { getItem: () => null });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('proxiedUrl', () => {
  it('returns the url unchanged without a proxy', () => {
    expect(proxiedUrl('https://a.example/x')).toBe('https://a.example/x');
  });
  it('wraps the url in the proxy query and strips a trailing slash from the proxy', () => {
    expect(proxiedUrl('https://a.example/x?y=1', 'https://proxy.example/')).toBe(
      'https://proxy.example?url=' + encodeURIComponent('https://a.example/x?y=1'));
  });
  it('skips the proxy for CORS-enabled hosts', () => {
    expect(proxiedUrl('https://hapi.fhir.org/baseR4/Patient', 'https://proxy.example')).toBe('https://hapi.fhir.org/baseR4/Patient');
  });
  it('reads the proxy from serverConfig when not passed', () => {
    cfg.corsProxyUrl = 'https://p.example';
    expect(proxiedUrl('https://a.example/')).toBe('https://p.example?url=' + encodeURIComponent('https://a.example/'));
  });
  it('proxies an unparsable url instead of throwing', () => {
    expect(proxiedUrl('not a url', 'https://p.example')).toBe('https://p.example?url=' + encodeURIComponent('not a url'));
  });
});

describe('fhirAuthHeaderFor / reauthHeaderFor', () => {
  it('returns {} for CORS-enabled public hosts without consulting OAuth', async () => {
    expect(await fhirAuthHeaderFor('https://hapi.fhir.org/x', 'FHIR_BASE')).toEqual({});
    expect(oauth.getValidAccessToken).not.toHaveBeenCalled();
  });
  it('uses the OAuth bearer token for the server key', async () => {
    oauth.getValidAccessToken.mockReturnValue('tok');
    expect(await fhirAuthHeaderFor(BASE, 'FHIR_BASE')).toEqual({ Authorization: 'Bearer tok' });
    expect(oauth.getValidAccessToken).toHaveBeenCalledWith('FHIR_BASE');
  });
  it('falls back to the debug bridge (empty when no credentials saved)', async () => {
    expect(await fhirAuthHeaderFor(BASE, 'FHIR_BASE')).toEqual({});
  });
  it('reauth refreshes the token and returns the new header', async () => {
    oauth.getValidAccessToken.mockReturnValue('fresh');
    expect(await reauthHeaderFor(BASE, 'SDC_SERVER')).toEqual({ Authorization: 'Bearer fresh' });
    expect(oauth.refreshAccessToken).toHaveBeenCalledWith('SDC_SERVER');
    expect(oauth.clearStoredToken).not.toHaveBeenCalled();
  });
  it('reauth clears the stored token when refresh fails', async () => {
    oauth.refreshAccessToken.mockRejectedValue(new Error('nope'));
    expect(await reauthHeaderFor(BASE, 'FHIR_BASE')).toEqual({});
    expect(oauth.clearStoredToken).toHaveBeenCalledWith('FHIR_BASE');
  });
  it('reauth without a server key does not touch OAuth', async () => {
    await reauthHeaderFor(BASE);
    expect(oauth.refreshAccessToken).not.toHaveBeenCalled();
  });
});

describe('displayName', () => {
  it('formats a Patient as "family, given"', () => {
    expect(displayName({ resourceType: 'Patient', id: 'p', name: [{ family: 'Doe', given: ['Jane', 'Q'] }] })).toBe('Doe, Jane Q');
  });
  it('falls back to name.text, then id', () => {
    expect(displayName({ resourceType: 'Patient', id: 'p', name: [{ text: 'J. Doe' }] })).toBe('J. Doe');
    expect(displayName({ resourceType: 'Patient', id: 'p' })).toBe('p');
  });
  it('uses name for an Organization', () => {
    expect(displayName({ resourceType: 'Organization', id: 'o', name: 'Acme' })).toBe('Acme');
  });
  it('composes an Encounter from subject, date and status', () => {
    expect(displayName({ resourceType: 'Encounter', id: 'e', subject: { display: 'Jane' }, period: { start: '2024-05-06T10:00:00Z' }, status: 'finished' }))
      .toBe('Jane 2024-05-06 [finished]');
  });
  it('composes an Observation from code and subject', () => {
    expect(displayName({ resourceType: 'Observation', id: 'o', code: { coding: [{ display: 'Weight' }] }, subject: { display: 'Jane' } }))
      .toBe('Weight — Jane');
  });
  it('uses name, title, then id for other types', () => {
    expect(displayName({ resourceType: 'Questionnaire', id: 'q', title: 'T' })).toBe('T');
    expect(displayName({ resourceType: 'Questionnaire', id: 'q' })).toBe('q');
  });
});

describe('searchFhir', () => {
  it('returns [] without fetching when base, type or query is missing', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f);
    cfg.fhirBaseUrl = null;
    expect(await searchFhir('Patient', 'x')).toEqual([]);
    cfg.fhirBaseUrl = BASE;
    expect(await searchFhir('', 'x')).toEqual([]);
    expect(await searchFhir('Patient', '   ')).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });

  it.each(['Patient/../x', 'Pat ient', 'Patient?x=1', 'Patient1', '../Patient'])(
    'rejects invalid resourceType %j without fetching', async (rt) => {
      const f = vi.fn(); vi.stubGlobal('fetch', f);
      expect(await searchFhir(rt, 'x')).toEqual([]);
      expect(f).not.toHaveBeenCalled();
    });

  it('builds the URL with _count and the type-specific search param', async () => {
    const f = vi.fn(async () => jsonRes({ entry: [] })); vi.stubGlobal('fetch', f);
    await searchFhir('Patient', 'doe', 5, { fhirBase: BASE + '/' });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe(`${BASE}/Patient?_count=5&name=doe`);
    expect(init.headers).toEqual({ Accept: 'application/fhir+json' });
  });

  it('uses patient.name for clinical resources and _id for unknown types', async () => {
    const f = vi.fn(async () => jsonRes({})); vi.stubGlobal('fetch', f);
    await searchFhir('Observation', 'x');
    await searchFhir('Questionnaire', 'x');
    expect(f.mock.calls[0][0]).toContain('patient.name=x');
    expect(f.mock.calls[1][0]).toContain('_id=x');
  });

  it('maps entries to {id, display} and drops entries without an id', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonRes({ entry: [
      { resource: { resourceType: 'Patient', id: 'a', name: [{ family: 'Doe', given: ['J'] }] } },
      { resource: { resourceType: 'Patient', name: [{ family: 'NoId' }] } },
      { resource: { resourceType: 'Organization', id: 'b', name: 'Acme' } },
    ] })));
    expect(await searchFhir('Patient', 'x')).toEqual([
      { id: 'a', display: 'Doe, J' },
      { id: 'b', display: 'Acme' },
    ]);
  });

  it('routes through the CORS proxy when configured', async () => {
    const f = vi.fn(async () => jsonRes({})); vi.stubGlobal('fetch', f);
    await searchFhir('Patient', 'x', 10, { corsProxy: 'https://proxy.example' });
    expect(f.mock.calls[0][0]).toBe('https://proxy.example?url=' + encodeURIComponent(`${BASE}/Patient?_count=10&name=x`));
  });

  it('sends the OAuth Authorization header', async () => {
    oauth.getValidAccessToken.mockReturnValue('tok');
    const f = vi.fn(async () => jsonRes({})); vi.stubGlobal('fetch', f);
    await searchFhir('Patient', 'x');
    expect(f.mock.calls[0][1].headers).toEqual({ Accept: 'application/fhir+json', Authorization: 'Bearer tok' });
  });

  it('on 401 refreshes the token and retries once with the new Authorization', async () => {
    oauth.getValidAccessToken.mockReturnValueOnce('old').mockReturnValue('new');
    const f = vi.fn()
      .mockResolvedValueOnce(jsonRes({}, 401))
      .mockResolvedValueOnce(jsonRes({ entry: [{ resource: { resourceType: 'Organization', id: 'z', name: 'Z' } }] }));
    vi.stubGlobal('fetch', f);
    expect(await searchFhir('Organization', 'z')).toEqual([{ id: 'z', display: 'Z' }]);
    expect(f).toHaveBeenCalledTimes(2);
    expect(f.mock.calls[0][1].headers.Authorization).toBe('Bearer old');
    expect(f.mock.calls[1][1].headers.Authorization).toBe('Bearer new');
    expect(oauth.refreshAccessToken).toHaveBeenCalledWith('FHIR_BASE');
  });

  it('does not retry a second time when the retry is also 401', async () => {
    const f = vi.fn(async () => jsonRes({ issue: [{ diagnostics: 'expired' }] }, 401)); vi.stubGlobal('fetch', f);
    await expect(searchFhir('Patient', 'x')).rejects.toThrow('HTTP 401 — expired');
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('throws HTTP status with truncated OperationOutcome diagnostics', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonRes({ issue: [{ diagnostics: 'x'.repeat(300) }] }, 500)));
    await expect(searchFhir('Patient', 'x')).rejects.toThrow(`HTTP 500 — ${'x'.repeat(120)}`);
  });

  it('throws plain HTTP status when the error body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => { throw new Error('bad'); } })));
    await expect(searchFhir('Patient', 'x')).rejects.toThrow(/^HTTP 503$/);
  });

  it('passes an abort signal that follows the external signal', async () => {
    const f = vi.fn(async () => jsonRes({})); vi.stubGlobal('fetch', f);
    const ac = new AbortController();
    await searchFhir('Patient', 'x', 10, { signal: ac.signal });
    const sig = f.mock.calls[0][1].signal;
    expect(sig.aborted).toBe(false);
    ac.abort();
    expect(sig.aborted).toBe(true);
  });
});

describe('getResourceByReference', () => {
  it('throws when no base is configured', async () => {
    cfg.fhirBaseUrl = null;
    await expect(getResourceByReference('Patient/1')).rejects.toThrow('FHIR Base Server not configured.');
  });
  it.each(['Patient', 'Patient/1/2', '', '1/Patient', 'Pat ient/1'])('rejects invalid reference %j', async (ref) => {
    vi.stubGlobal('fetch', vi.fn());
    await expect(getResourceByReference(ref)).rejects.toThrow(/Invalid reference/);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('fetches and returns the resource', async () => {
    const f = vi.fn(async () => jsonRes({ resourceType: 'Patient', id: '1' })); vi.stubGlobal('fetch', f);
    expect(await getResourceByReference(' Patient/1 ')).toEqual({ resourceType: 'Patient', id: '1' });
    expect(f.mock.calls[0][0]).toBe(`${BASE}/Patient/1`);
  });
  it('uses an explicit authHeader and does not retry on 401', async () => {
    const f = vi.fn(async () => jsonRes({}, 401)); vi.stubGlobal('fetch', f);
    await expect(getResourceByReference('Patient/1', { authHeader: { Authorization: 'Bearer host' } })).rejects.toThrow('HTTP 401');
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0][1].headers).toEqual({ Accept: 'application/fhir+json', Authorization: 'Bearer host' });
    expect(oauth.getValidAccessToken).not.toHaveBeenCalled();
  });
  it('retries once on 401 with refreshed auth when no explicit header', async () => {
    const f = vi.fn().mockResolvedValueOnce(jsonRes({}, 401)).mockResolvedValueOnce(jsonRes({ id: 'ok' }));
    vi.stubGlobal('fetch', f);
    expect(await getResourceByReference('Patient/1')).toEqual({ id: 'ok' });
    expect(oauth.refreshAccessToken).toHaveBeenCalledWith('FHIR_BASE');
  });
});
