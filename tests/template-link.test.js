import { describe, it, expect } from 'vitest';
import { parseTemplateLink, withoutTemplateParam } from '../js/fhir/template-link.js';

describe('parseTemplateLink', () => {
  it('returns null without a template parameter', () => {
    expect(parseTemplateLink('')).toBeNull();
    expect(parseTemplateLink('?foo=1')).toBeNull();
  });

  it('accepts catalog-style ids', () => {
    expect(parseTemplateLink('?template=phq-9')).toEqual({ id: 'phq-9' });
    expect(parseTemplateLink('?a=1&template=cha2ds2-vasc')).toEqual({ id: 'cha2ds2-vasc' });
  });

  it('takes the first of repeated parameters and ignores array-style keys', () => {
    expect(parseTemplateLink('?template=a&template=b')).toEqual({ id: 'a' });
    expect(parseTemplateLink('?template[]=x')).toBeNull();
  });

  it.each(['', 'PHQ-9', '../etc/passwd', 'https://evil.example/x', 'a b', '-lead', 'x'.repeat(65), 'a/b', 'a.json'])('rejects %j', (value) => {
    expect(parseTemplateLink(`?template=${encodeURIComponent(value)}`)).toEqual({ invalid: true });
  });
});

describe('withoutTemplateParam', () => {
  it('removes only the template parameter and keeps path, other parameters and hash', () => {
    expect(withoutTemplateParam('https://fhirbuilder.com/?template=phq-9')).toBe('/');
    expect(withoutTemplateParam('https://fhirbuilder.com/index.html?foo=1&template=gad-7&bar=2#x')).toBe('/index.html?foo=1&bar=2#x');
    expect(withoutTemplateParam('/?template=a')).toBe('/');
    expect(withoutTemplateParam('/?template=a&template=b')).toBe('/');
  });
});
