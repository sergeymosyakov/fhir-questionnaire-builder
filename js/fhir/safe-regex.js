// Questionnaire-supplied regex guard: compiled once, length-capped, never throws.
// Not a full ReDoS defence (nested quantifiers on short input can still be slow); it bounds the cost.
export const MAX_PATTERN_LENGTH = 500;
export const MAX_VALUE_LENGTH = 10000;

const _cache = new Map();

/** Compiled RegExp, or null when the pattern is invalid or too long. */
export function compileRegex(pattern) {
  if (typeof pattern !== 'string' || pattern.length === 0 || pattern.length > MAX_PATTERN_LENGTH) return null;
  if (_cache.has(pattern)) return _cache.get(pattern);
  let re = null;
  try { re = new RegExp(pattern); } catch { /* invalid regex — skip */ }
  _cache.set(pattern, re);
  return re;
}

/** False only when the pattern is usable, the value is within bounds, and it does not match. */
export function regexMatches(pattern, value) {
  const re = compileRegex(pattern);
  if (!re) return true;
  const s = String(value);
  if (s.length > MAX_VALUE_LENGTH) return true;
  return re.test(s);
}
