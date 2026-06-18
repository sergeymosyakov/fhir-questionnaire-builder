// ── Unit tests: ExternalValidator (version routing + payload sanitisation) ───
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExternalValidator } from '../js/fhir/validators/external.js';

const VERSION_EXT_URL =
  'https://sergeymosyakov.github.io/fhir-questionnaire-builder/StructureDefinition/builder-target-version';
const OK_OUTCOME = { resourceType: 'OperationOutcome', issue: [] };

/** Build a fetch mock that records calls and returns an empty OperationOutcome. */
function makeFetchMock() {
  const calls = [];
  const fn = vi.fn(async (url, opts) => {
    calls.push({ url, opts });
    return {
      ok: true,
      status: 200,
      json: async () => OK_OUTCOME,
      headers: { get: () => 'application/fhir+json' },
      text: async () => '',
    };
  });
  fn.calls = calls;
  return fn;
}

describe('ExternalValidator', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = makeFetchMock();
    // First fetch is config.json (proxy lookup), the rest are validation POSTs.
    vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
      if (typeof url === 'string' && url.includes('config.json')) {
        return { ok: true, json: async () => ({}) }; // no corsProxyUrl → no proxy
      }
      return fetchMock(url, opts);
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('routes to baseR4 / baseR4B / baseR5 based on the target version', async () => {
    for (const [version, base] of [['R4', 'baseR4'], ['R4B', 'baseR4B'], ['R5', 'baseR5']]) {
      const v = new ExternalValidator({
        name: 'HAPI FHIR', url: 'https://hapi.fhir.org/baseR4', getFhirTarget: () => version,
      });
      v.enabled = true;
      await v.run({ resourceType: 'Questionnaire', item: [] });
      const last = fetchMock.calls.at(-1).url;
      expect(last).toBe(`https://hapi.fhir.org/${base}/Questionnaire/$validate`);
    }
  });

  it('reflects the active version in the display name', () => {
    let version = 'R5';
    const v = new ExternalValidator({ name: 'HAPI FHIR', url: 'https://hapi.fhir.org/baseR4', getFhirTarget: () => version });
    expect(v.name).toBe('HAPI FHIR R5');
    version = 'R4B';
    expect(v.name).toBe('HAPI FHIR R4B');
  });

  it('strips the builder-target-version extension from the validated payload', async () => {
    const v = new ExternalValidator({ name: 'HAPI FHIR', url: 'https://hapi.fhir.org/baseR4', getFhirTarget: () => 'R5' });
    v.enabled = true;
    await v.run({
      resourceType: 'Questionnaire',
      extension: [{ url: VERSION_EXT_URL, valueCode: '5.0.0' }],
      item: [],
    });
    const sentBody = JSON.parse(fetchMock.calls.at(-1).opts.body);
    expect(sentBody.extension).toBeUndefined();
  });

  it('keeps other extensions while stripping only the version marker', async () => {
    const v = new ExternalValidator({ name: 'HAPI FHIR', url: 'https://hapi.fhir.org/baseR4', getFhirTarget: () => 'R4' });
    v.enabled = true;
    await v.run({
      resourceType: 'Questionnaire',
      extension: [
        { url: VERSION_EXT_URL, valueCode: '4.0.1' },
        { url: 'http://example.org/keep', valueString: 'x' },
      ],
      item: [],
    });
    const sentBody = JSON.parse(fetchMock.calls.at(-1).opts.body);
    expect(sentBody.extension).toEqual([{ url: 'http://example.org/keep', valueString: 'x' }]);
  });

  it('falls back to the configured URL when it has no recognised base segment', async () => {
    const v = new ExternalValidator({ name: 'My FHIR', url: 'https://my.server/fhir', getFhirTarget: () => 'R5' });
    v.enabled = true;
    await v.run({ resourceType: 'Questionnaire', item: [] });
    expect(fetchMock.calls.at(-1).url).toBe('https://my.server/fhir/Questionnaire/$validate');
  });
});

/**
 * Stub fetch so that config.json returns the given config object and every
 * other request resolves to `response` (an object or a function of (url,opts)).
 */
function stubFetch(config, response) {
  vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
    if (typeof url === 'string' && url.includes('config.json')) {
      return { ok: true, json: async () => config };
    }
    return typeof response === 'function' ? response(url, opts) : response;
  }));
}

const okResp = (outcome) => ({
  ok: true, status: 200, statusText: 'OK',
  json: async () => outcome,
  text: async () => '',
});

describe('ExternalValidator — OperationOutcome parsing', () => {
  afterEach(() => vi.unstubAllGlobals());

  async function validate(outcome, questJson = { resourceType: 'Questionnaire', item: [] }) {
    stubFetch({}, okResp(outcome));
    const v = new ExternalValidator({ name: 'HAPI FHIR', url: 'https://hapi.fhir.org/baseR4', getFhirTarget: () => 'R4' });
    v.enabled = true;
    return v.run(questJson);
  }

  it('returns [] for an empty OperationOutcome', async () => {
    expect(await validate({ resourceType: 'OperationOutcome', issue: [] })).toEqual([]);
  });

  it('maps fatal/error severities to "error" and others to "warning"', async () => {
    const issues = await validate({
      issue: [
        { severity: 'fatal',       diagnostics: 'a' },
        { severity: 'error',       diagnostics: 'b' },
        { severity: 'warning',     diagnostics: 'c' },
        { severity: 'information', diagnostics: 'd' },
      ],
    });
    expect(issues.map(i => i.severity)).toEqual(['error', 'error', 'warning', 'warning']);
  });

  it('derives the message from diagnostics, details.text, details.coding, or a fallback', async () => {
    const issues = await validate({
      issue: [
        { severity: 'error', diagnostics: 'from diagnostics' },
        { severity: 'error', details: { text: 'from details.text' } },
        { severity: 'error', details: { coding: [{ display: 'from coding' }] } },
        { severity: 'error' },
      ],
    });
    expect(issues.map(i => i.message)).toEqual([
      'from diagnostics', 'from details.text', 'from coding', 'Unknown issue',
    ]);
  });

  it('resolves a linkId from an item[] expression path', async () => {
    const quest = {
      resourceType: 'Questionnaire',
      item: [
        { linkId: 'g1', item: [{ linkId: 'q-inner' }] },
        { linkId: 'q-top' },
      ],
    };
    const issues = await validate({
      issue: [{ severity: 'error', diagnostics: 'x', expression: ['Questionnaire.item[0].item[0]'] }],
    }, quest);
    expect(issues[0].nodeId).toBe('q-inner');
  });

  it('falls back to "(external)" when the path cannot be mapped', async () => {
    const issues = await validate({
      issue: [{ severity: 'error', diagnostics: 'x', location: ['Questionnaire.name'] }],
    });
    expect(issues[0].nodeId).toBe('(external)');
  });
});

describe('ExternalValidator — error handling', () => {
  afterEach(() => vi.unstubAllGlobals());

  function makeValidator(opts = {}) {
    const v = new ExternalValidator({ name: 'HAPI FHIR', url: 'https://hapi.fhir.org/baseR4', getFhirTarget: () => 'R4', ...opts });
    v.enabled = true;
    return v;
  }

  it('throws a non-retryable error on HTTP 413 (payload too large)', async () => {
    stubFetch({}, { ok: false, status: 413, statusText: 'Payload Too Large', text: async () => '' });
    const v = makeValidator({ retries: 3 });
    await expect(v.run({ resourceType: 'Questionnaire', item: [] })).rejects.toThrow(/too large/i);
  });

  it('throws a non-retryable error on a 4xx response', async () => {
    stubFetch({}, { ok: false, status: 400, statusText: 'Bad Request', text: async () => 'bad input' });
    const v = makeValidator({ retries: 3 });
    await expect(v.run({ resourceType: 'Questionnaire', item: [] })).rejects.toThrow(/HTTP 400.*bad input/);
  });

  it('retries on a 5xx response and fails after exhausting attempts', async () => {
    let calls = 0;
    stubFetch({}, () => { calls++; return { ok: false, status: 500, statusText: 'Server Error', text: async () => '' }; });
    const v = makeValidator({ retries: 1 });
    await expect(v.run({ resourceType: 'Questionnaire', item: [] })).rejects.toThrow(/failed after 1 attempts/);
    expect(calls).toBe(1);
  });

  it('retries on a network error before giving up', async () => {
    let calls = 0;
    stubFetch({}, () => { calls++; throw new Error('network down'); });
    const v = makeValidator({ retries: 1 });
    await expect(v.run({ resourceType: 'Questionnaire', item: [] })).rejects.toThrow(/network down/);
    expect(calls).toBe(1);
  });

  it('waits between retries and succeeds on a later attempt', async () => {
    vi.useFakeTimers();
    let calls = 0;
    stubFetch({}, () => {
      calls++;
      if (calls < 2) throw new Error('transient');
      return okResp({ resourceType: 'OperationOutcome', issue: [] });
    });
    const v = makeValidator({ retries: 2 });
    const p = v.run({ resourceType: 'Questionnaire', item: [] });
    await vi.runAllTimersAsync();
    await expect(p).resolves.toEqual([]);
    expect(calls).toBe(2);
    vi.useRealTimers();
  });
});

describe('ExternalValidator — CORS proxy', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

  it('wraps the endpoint in the configured CORS proxy URL', async () => {
    vi.resetModules();
    const sent = [];
    vi.stubGlobal('fetch', vi.fn(async (url, _opts) => {
      sent.push(url);
      return okResp({ resourceType: 'OperationOutcome', issue: [] });
    }));
    const { serverConfig, DefaultConfigProvider } = await import('../js/fhir/server-config.js');
    serverConfig.register(new DefaultConfigProvider({ corsProxyUrl: 'https://proxy.example/' }));
    const { ExternalValidator: FreshValidator } = await import('../js/fhir/validators/external.js');
    const v = new FreshValidator({ name: 'HAPI FHIR', url: 'https://hapi.fhir.org/baseR4', getFhirTarget: () => 'R4' });
    v.enabled = true;
    await v.run({ resourceType: 'Questionnaire', item: [] });
    expect(sent[0]).toBe(
      'https://proxy.example?url=' +
      encodeURIComponent('https://hapi.fhir.org/baseR4/Questionnaire/$validate'),
    );
  });
});
