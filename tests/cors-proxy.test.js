// One proxy policy for every outgoing request.
import { describe, it, expect } from 'vitest';
import { proxyUrl, CORS_ENABLED_HOSTS } from '../js/fhir/cors-proxy.js';

describe('proxyUrl', () => {
  it('sends the request through the proxy, trailing slash ignored', () => {
    expect(proxyUrl('https://fhir.example.org/Patient', 'https://p.example/')).toBe('https://p.example?url=' + encodeURIComponent('https://fhir.example.org/Patient'));
  });
  it('leaves the url alone without a proxy', () => {
    expect(proxyUrl('https://fhir.example.org/Patient', '')).toBe('https://fhir.example.org/Patient');
    expect(proxyUrl('https://fhir.example.org/Patient', undefined)).toBe('https://fhir.example.org/Patient');
  });
  it.each(CORS_ENABLED_HOSTS)('skips the proxy for %s', (host) => {
    expect(proxyUrl(`https://${host}/x`, 'https://p.example')).toBe(`https://${host}/x`);
  });
  it('does not mistake a lookalike host for a public one', () => {
    expect(proxyUrl('https://hapi.fhir.org.evil.example/x', 'https://p.example')).toContain('p.example');
  });
});
