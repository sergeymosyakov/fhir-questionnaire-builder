import { describe, it, expect } from 'vitest';
import { compileRegex, regexMatches, MAX_PATTERN_LENGTH, MAX_VALUE_LENGTH } from '../js/fhir/safe-regex.js';

describe('compileRegex', () => {
  it('compiles a valid pattern and caches the instance', () => {
    const a = compileRegex('^\\d+$');
    expect(a).toBeInstanceOf(RegExp);
    expect(compileRegex('^\\d+$')).toBe(a);
  });

  it.each([['invalid syntax', '('], ['empty', ''], ['non-string', null]])('returns null for %s', (_n, p) => {
    expect(compileRegex(p)).toBeNull();
  });

  it('returns null when the pattern exceeds the length cap', () => {
    expect(compileRegex('a'.repeat(MAX_PATTERN_LENGTH + 1))).toBeNull();
    expect(compileRegex('a'.repeat(MAX_PATTERN_LENGTH))).toBeInstanceOf(RegExp);
  });
});

describe('regexMatches', () => {
  it('matches and rejects with a usable pattern', () => {
    expect(regexMatches('^\\d+$', '123')).toBe(true);
    expect(regexMatches('^\\d+$', 'abc')).toBe(false);
  });

  it('coerces non-string values', () => {
    expect(regexMatches('^\\d+$', 42)).toBe(true);
  });

  it('does not fail the value when the pattern is unusable', () => {
    expect(regexMatches('(', 'anything')).toBe(true);
    expect(regexMatches('a'.repeat(MAX_PATTERN_LENGTH + 1), 'x')).toBe(true);
  });

  it('skips values over the length cap without running the regex', () => {
    expect(regexMatches('^\\d+$', 'a'.repeat(MAX_VALUE_LENGTH + 1))).toBe(true);
  });
});
