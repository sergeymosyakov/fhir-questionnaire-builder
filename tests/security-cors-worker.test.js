// CORS worker: anchored path allow-list, browser origins only, bounded body.
import { describe, it, expect, vi, afterEach } from 'vitest';
import worker from '../scripts/cors-proxy.worker.js';
import { isAllowedTarget, isAllowedOrigin } from '../scripts/cors-proxy-rules.js';

const pathOk = (p) => isAllowedTarget(new URL(`https://fhir.example.org${p}`));
const call = (url, { origin = 'https://fhirbuilder.com', headers = {}, method = 'GET', body } = {}) =>
  worker.fetch(new Request(`https://proxy.example/?url=${encodeURIComponent(url)}`, { method, body, headers: { ...(origin ? { Origin: origin } : {}), ...headers } }));

describe('worker paths', () => {
  it.each(['/fhir/metadata', '/fhir/ValueSet/$expand', '/fhir/ValueSet/abc', '/fhir/Questionnaire/$validate', '/fhir/Questionnaire/q1/$populate', '/fhir/Patient', '/fhir/Patient/p1'])('allows %s', (p) => {
    expect(pathOk(p)).toBe(true);
  });
  it.each(['/anything/metadata/x', '/PatientSecrets', '/v2/translate', '/translate', '/a/ValueSet/b/c', '/admin'])('refuses %s', (p) => {
    expect(pathOk(p)).toBe(false);
  });
});

describe('DeepL', () => {
  it('may be reached through the proxy, on its own hosts only', () => {
    expect(isAllowedTarget(new URL('https://api-free.deepl.com/v2/translate'))).toBe(true);
    expect(isAllowedTarget(new URL('https://api.deepl.com/v2/translate'))).toBe(true);
    expect(isAllowedTarget(new URL('https://evil.example/v2/translate'))).toBe(false);
    expect(isAllowedTarget(new URL('https://api.deepl.com/v2/usage'))).toBe(false);
  });
});

describe('worker requests', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('refuses a request without an allowed browser origin', async () => {
    expect((await call('https://tx.example/fhir/metadata', { origin: null })).status).toBe(403);
    expect((await call('https://tx.example/fhir/metadata', { origin: 'https://evil.example' })).status).toBe(403);
  });
  it('refuses a substring path match', async () => {
    expect((await call('https://anything.example/x/metadata/more')).status).toBe(403);
  });
  it('refuses an oversized body', async () => {
    const r = await call('https://tx.example/fhir/Questionnaire/$validate', { method: 'POST', body: new Uint8Array(3 * 1024 * 1024) });
    expect(r.status).toBe(413);
  });
  it('proxies an allowed request', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { headers: { 'Content-Type': 'application/fhir+json' } })));
    const r = await call('https://tx.example/fhir/metadata');
    expect(r.status).toBe(200);
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('https://fhirbuilder.com');
  });
  it('forwards Authorization to the target', async () => {
    const fetchMock = vi.fn(async () => new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    await call('https://tx.example/fhir/Patient', { headers: { Authorization: 'Bearer t' } });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer t');
  });
  it('answers a preflight from an allowed origin', async () => {
    const r = await worker.fetch(new Request('https://proxy.example/', { method: 'OPTIONS', headers: { Origin: 'https://fhirbuilder.com' } }));
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('https://fhirbuilder.com');
  });
  it('knows the allowed origins', () => {
    expect(isAllowedOrigin('http://localhost:3000')).toBe(true);
    expect(isAllowedOrigin('https://fhirbuilder.com.evil.example')).toBe(false);
  });
});
