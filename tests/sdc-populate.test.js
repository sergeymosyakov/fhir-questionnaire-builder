// ── Unit tests: js/fhir/sdc-populate.js ──────────────────────────────────────
// fetch, serverConfig and the auth helpers are mocked; no network.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../js/fhir/fhir-search.js', () => ({
  proxiedUrl:         vi.fn(u => u),
  fhirAuthHeaderFor:  vi.fn(async () => ({ Authorization: 'Bearer first' })),
  reauthHeaderFor:    vi.fn(async () => ({ Authorization: 'Bearer retry' })),
}));

import { populateFromServer } from '../js/fhir/sdc-populate.js';
import { serverConfig } from '../js/fhir/server-config.js';
import * as search from '../js/fhir/fhir-search.js';

const Q = { resourceType: 'Questionnaire', status: 'draft' };
const QR = { resourceType: 'QuestionnaireResponse', status: 'in-progress' };

function res(body, status = 200, text) {
  return {
    ok: status >= 200 && status < 300, status,
    json: async () => body,
    text: async () => text ?? JSON.stringify(body),
  };
}

let cfg;
beforeEach(() => {
  cfg = {};
  vi.spyOn(serverConfig, 'get').mockImplementation(k => cfg[k] ?? null);
  search.proxiedUrl.mockClear();
  search.fhirAuthHeaderFor.mockClear();
  search.reauthHeaderFor.mockClear();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('populateFromServer request', () => {
  it('posts a Parameters resource to {fhirBase}/Questionnaire/$populate', async () => {
    const f = vi.fn(async () => res(QR)); vi.stubGlobal('fetch', f);
    await populateFromServer('https://fhir.example/r4/', Q, 'Patient/1');
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://fhir.example/r4/Questionnaire/$populate');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/fhir+json', Accept: 'application/fhir+json', Authorization: 'Bearer first',
    });
    expect(JSON.parse(init.body)).toEqual({
      resourceType: 'Parameters',
      parameter: [
        { name: 'questionnaire', resource: Q },
        { name: 'subject', valueReference: { reference: 'Patient/1' } },
      ],
    });
    expect(search.fhirAuthHeaderFor).toHaveBeenCalledWith('https://fhir.example/r4/Questionnaire/$populate', 'FHIR_BASE');
  });

  it('prefers the configured SDC server and its auth key', async () => {
    cfg.sdcServerUrl = 'https://sdc.example/fhir';
    const f = vi.fn(async () => res(QR)); vi.stubGlobal('fetch', f);
    await populateFromServer('https://fhir.example/r4', Q, 'Patient/1');
    expect(f.mock.calls[0][0]).toBe('https://sdc.example/fhir/Questionnaire/$populate');
    expect(search.fhirAuthHeaderFor).toHaveBeenCalledWith('https://sdc.example/fhir/Questionnaire/$populate', 'SDC_SERVER');
  });

  it('uses the explicit authHeader and skips OAuth resolution and the 401 retry', async () => {
    const f = vi.fn(async () => res({}, 401)); vi.stubGlobal('fetch', f);
    await expect(populateFromServer('https://f.example', Q, 'Patient/1', { authHeader: { Authorization: 'Bearer host' } }))
      .rejects.toThrow('$populate: HTTP 401');
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0][1].headers.Authorization).toBe('Bearer host');
    expect(search.fhirAuthHeaderFor).not.toHaveBeenCalled();
  });

  it('retries once on 401 with a re-authenticated header', async () => {
    const f = vi.fn().mockResolvedValueOnce(res({}, 401)).mockResolvedValueOnce(res(QR));
    vi.stubGlobal('fetch', f);
    expect(await populateFromServer('https://f.example', Q, 'Patient/1')).toEqual(QR);
    expect(f).toHaveBeenCalledTimes(2);
    expect(f.mock.calls[1][1].headers.Authorization).toBe('Bearer retry');
    expect(search.reauthHeaderFor).toHaveBeenCalledWith('https://f.example/Questionnaire/$populate', 'FHIR_BASE');
  });
});

describe('populateFromServer response parsing', () => {
  it('returns a bare QuestionnaireResponse', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res(QR)));
    expect(await populateFromServer('https://f.example', Q, 'Patient/1')).toEqual(QR);
  });

  it.each(['questionnaire-response', 'response', 'return'])('unwraps a Parameters.%s resource', async (name) => {
    vi.stubGlobal('fetch', vi.fn(async () => res({ resourceType: 'Parameters', parameter: [{ name: 'issues' }, { name, resource: QR }] })));
    expect(await populateFromServer('https://f.example', Q, 'Patient/1')).toEqual(QR);
  });

  it('throws when Parameters has no QuestionnaireResponse', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res({ resourceType: 'Parameters', parameter: [{ name: 'return', resource: { resourceType: 'OperationOutcome' } }] })));
    await expect(populateFromServer('https://f.example', Q, 'Patient/1')).rejects.toThrow('did not contain a QuestionnaireResponse');
  });

  it('throws on an unexpected resourceType', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res({ resourceType: 'Bundle' })));
    await expect(populateFromServer('https://f.example', Q, 'Patient/1')).rejects.toThrow('unexpected resourceType: Bundle');
  });
});

describe('populateFromServer errors', () => {
  it('uses OperationOutcome diagnostics and adds the unsupported-operation hint on 404', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res({ resourceType: 'OperationOutcome', issue: [{ diagnostics: 'no such op' }] }, 404)));
    await expect(populateFromServer('https://f.example', Q, 'Patient/1')).rejects.toThrow(
      '$populate: HTTP 404 — no such op (This server may not support the SDC $populate operation.)');
  });

  it('falls back to issue.details.text and has no hint on 500', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res({ issue: [{ details: { text: 'boom' } }] }, 500)));
    await expect(populateFromServer('https://f.example', Q, 'Patient/1')).rejects.toThrow(/^\$populate: HTTP 500 — boom$/);
  });

  it('falls back to the raw body when the OperationOutcome has no diagnostics or details', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res({ issue: [{ code: 'x' }] }, 400)));
    await expect(populateFromServer('https://f.example', Q, 'Patient/1')).rejects.toThrow(
      `$populate: HTTP 400 — {"issue":[{"code":"x"}]} (This server may not support the SDC $populate operation.)`);
  });

  it('truncates a non-JSON error body to 150 characters', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res(null, 502, 'y'.repeat(400))));
    const err = await populateFromServer('https://f.example', Q, 'Patient/1').catch(e => e);
    expect(err.message).toBe(`$populate: HTTP 502 — ${'y'.repeat(150)}`);
  });

  it('reports a bare status when the error body is empty', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, text: async () => { throw new Error('x'); } })));
    await expect(populateFromServer('https://f.example', Q, 'Patient/1')).rejects.toThrow(/^\$populate: HTTP 500$/);
  });
});
