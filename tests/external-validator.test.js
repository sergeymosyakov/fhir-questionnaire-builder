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
