// Unit tests for js/fhir/form-checks.js — pure preview PASS/FAIL validation.
// No DOM, no state: store is a plain { get } stub.

import { describe, it, expect } from 'vitest';
import {
  calcFormOk, isMandatory, evalConstraints, CHECKABLE_TYPES, NONEMPTY_TYPES,
} from '../js/fhir/form-checks.js';

// Store stub: get(id) reads from a plain map.
const store = (map = {}) => ({ data: map, get: id => map[id] });
const node = (over = {}) => ({ id: 'q', itemType: 'text', mandatory: null, ...over });

// ── isMandatory ────────────────────────────────────────────────────────────────
describe('isMandatory', () => {
  it('true only when mandatory === true', () => {
    expect(isMandatory({ mandatory: true })).toBe(true);
    expect(isMandatory({ mandatory: false })).toBe(false);
    expect(isMandatory({ mandatory: null })).toBe(false);
    expect(isMandatory({})).toBe(false);
  });
});

// ── type-set membership ─────────────────────────────────────────────────────────
describe('CHECKABLE_TYPES / NONEMPTY_TYPES', () => {
  it('CHECKABLE includes url and attachment; NONEMPTY excludes them', () => {
    expect(CHECKABLE_TYPES.has('url')).toBe(true);
    expect(CHECKABLE_TYPES.has('attachment')).toBe(true);
    expect(NONEMPTY_TYPES.has('url')).toBe(false);
    expect(NONEMPTY_TYPES.has('attachment')).toBe(false);
    expect(NONEMPTY_TYPES.has('text')).toBe(true);
  });
});

// ── calculatedExpression + readOnly ─────────────────────────────────────────────
describe('calcFormOk — calculatedExpression read-only', () => {
  it('non-checkbox computed read-only is always ok', () => {
    expect(calcFormOk(node({ itemType: 'text', _calculatedExpr: 'x', _readOnly: true }), store())).toBe(true);
  });
  it('checkbox computed read-only is ok only when value is true', () => {
    const n = node({ itemType: 'checkbox', _calculatedExpr: 'x', _readOnly: true });
    expect(calcFormOk(n, store({ q: true }))).toBe(true);
    expect(calcFormOk(n, store({ q: false }))).toBe(false);
    expect(calcFormOk(n, store({}))).toBe(false);
  });
});

// ── checkbox (tristate) ─────────────────────────────────────────────────────────
describe('calcFormOk — checkbox', () => {
  it('mandatory checkbox needs an explicit true/false (not undefined)', () => {
    const n = node({ itemType: 'checkbox', mandatory: true });
    expect(calcFormOk(n, store({ q: true }))).toBe(true);
    expect(calcFormOk(n, store({ q: false }))).toBe(true);
    expect(calcFormOk(n, store({}))).toBe(false);
  });
  it('optional checkbox is always ok', () => {
    expect(calcFormOk(node({ itemType: 'checkbox', mandatory: false }), store({}))).toBe(true);
  });
});

// ── url ─────────────────────────────────────────────────────────────────────────
describe('calcFormOk — url', () => {
  it('empty optional url is ok; empty mandatory url is not', () => {
    expect(calcFormOk(node({ itemType: 'url', mandatory: false }), store({ q: '' }))).toBe(true);
    expect(calcFormOk(node({ itemType: 'url', mandatory: true }), store({ q: '' }))).toBe(false);
  });
  it('invalid url fails, valid url passes', () => {
    expect(calcFormOk(node({ itemType: 'url' }), store({ q: 'not a url' }))).toBe(false);
    expect(calcFormOk(node({ itemType: 'url' }), store({ q: 'https://example.org' }))).toBe(true);
  });
  it('valid url must also satisfy a regex when set', () => {
    const n = node({ itemType: 'url', _regex: '^https://' });
    expect(calcFormOk(n, store({ q: 'http://example.org' }))).toBe(false);
    expect(calcFormOk(n, store({ q: 'https://example.org' }))).toBe(true);
  });
});

// ── attachment ──────────────────────────────────────────────────────────────────
describe('calcFormOk — attachment', () => {
  it('file over max size fails', () => {
    const n = node({ itemType: 'attachment', _maxFileSizeMB: 1 });
    expect(calcFormOk(n, store({ q: { size: 2 * 1024 * 1024 } }))).toBe(false);
    expect(calcFormOk(n, store({ q: { size: 0.5 * 1024 * 1024 } }))).toBe(true);
  });
  it('optional empty attachment ok; mandatory empty fails', () => {
    expect(calcFormOk(node({ itemType: 'attachment', mandatory: false }), store({}))).toBe(true);
    expect(calcFormOk(node({ itemType: 'attachment', mandatory: true }), store({}))).toBe(false);
    expect(calcFormOk(node({ itemType: 'attachment', mandatory: true }), store({ q: { size: 10 } }))).toBe(true);
  });
});

// ── numeric (integer / decimal) ─────────────────────────────────────────────────
describe('calcFormOk — numeric', () => {
  it('non-finite value fails', () => {
    expect(calcFormOk(node({ itemType: 'integer' }), store({ q: 'abc' }))).toBe(false);
  });
  it('min / max bounds enforced', () => {
    const n = node({ itemType: 'integer', _minValue: 1, _maxValue: 10 });
    expect(calcFormOk(n, store({ q: 0 }))).toBe(false);
    expect(calcFormOk(n, store({ q: 11 }))).toBe(false);
    expect(calcFormOk(n, store({ q: 5 }))).toBe(true);
  });
  it('maxDecimalPlaces enforced', () => {
    const n = node({ itemType: 'decimal', _maxDecimalPlaces: 2 });
    expect(calcFormOk(n, store({ q: '1.234' }))).toBe(false);
    expect(calcFormOk(n, store({ q: '1.23' }))).toBe(true);
    expect(calcFormOk(n, store({ q: '1' }))).toBe(true);
  });
  it('mandatory numeric requires a value; optional empty is ok', () => {
    expect(calcFormOk(node({ itemType: 'integer', mandatory: true }), store({}))).toBe(false);
    expect(calcFormOk(node({ itemType: 'integer', mandatory: false }), store({}))).toBe(true);
    expect(calcFormOk(node({ itemType: 'integer', mandatory: true }), store({ q: 3 }))).toBe(true);
  });
});

// ── mandatory === false short-circuit ───────────────────────────────────────────
describe('calcFormOk — optional short-circuit', () => {
  it('mandatory:false text is always ok even when empty', () => {
    expect(calcFormOk(node({ itemType: 'text', mandatory: false }), store({}))).toBe(true);
  });
});

// ── reference ───────────────────────────────────────────────────────────────────
describe('calcFormOk — reference', () => {
  it('mandatory reference needs a { reference } object', () => {
    const n = node({ itemType: 'reference', mandatory: true });
    expect(calcFormOk(n, store({}))).toBe(false);
    expect(calcFormOk(n, store({ q: {} }))).toBe(false);
    expect(calcFormOk(n, store({ q: { reference: 'Patient/1' } }))).toBe(true);
  });
  it('optional reference is ok', () => {
    expect(calcFormOk(node({ itemType: 'reference', mandatory: false }), store({}))).toBe(true);
  });
});

// ── quantity ────────────────────────────────────────────────────────────────────
describe('calcFormOk — quantity', () => {
  it('mandatory quantity needs both value and unit', () => {
    const n = node({ itemType: 'quantity', mandatory: true });
    expect(calcFormOk(n, store({}))).toBe(false);
    expect(calcFormOk(n, store({ q: { value: 5 } }))).toBe(false);
    expect(calcFormOk(n, store({ q: { value: 5, unit: 'kg' } }))).toBe(true);
  });
  it('optional quantity is ok', () => {
    expect(calcFormOk(node({ itemType: 'quantity', mandatory: false }), store({}))).toBe(true);
  });
});

// ── minLength / regex on text ───────────────────────────────────────────────────
describe('calcFormOk — minLength / regex', () => {
  it('value shorter than minLength fails; long enough passes', () => {
    const n = node({ itemType: 'text', _minLength: 3 });
    expect(calcFormOk(n, store({ q: 'ab' }))).toBe(false);
    expect(calcFormOk(n, store({ q: 'abc' }))).toBe(true);
  });
  it('value not matching regex fails; matching passes', () => {
    const n = node({ itemType: 'text', _regex: '^[0-9]+$' });
    expect(calcFormOk(n, store({ q: 'abc' }))).toBe(false);
    expect(calcFormOk(n, store({ q: '123' }))).toBe(true);
  });
  it('invalid regex is skipped (does not fail)', () => {
    const n = node({ itemType: 'text', _regex: '[' });
    expect(calcFormOk(n, store({ q: 'anything' }))).toBe(true);
  });
});

// ── mandatory NONEMPTY types ─────────────────────────────────────────────────────
describe('calcFormOk — mandatory non-empty types', () => {
  it('mandatory text requires a non-empty value', () => {
    const n = node({ itemType: 'text', mandatory: true });
    expect(calcFormOk(n, store({}))).toBe(false);
    expect(calcFormOk(n, store({ q: '' }))).toBe(false);
    expect(calcFormOk(n, store({ q: 'hi' }))).toBe(true);
  });
  it('mandatory radio/select/checklist require a value', () => {
    for (const t of ['radio', 'select', 'checklist']) {
      expect(calcFormOk(node({ itemType: t, mandatory: true }), store({}))).toBe(false);
      expect(calcFormOk(node({ itemType: t, mandatory: true }), store({ q: 'x' }))).toBe(true);
    }
  });
  it('display / unknown types default to ok', () => {
    expect(calcFormOk(node({ itemType: 'display' }), store({}))).toBe(true);
  });
});

// ── evalConstraints ──────────────────────────────────────────────────────────────
describe('evalConstraints', () => {
  const fpOk    = { evaluate: () => [true] };
  const fpFalse = { evaluate: () => [false] };
  const fpEmpty = { evaluate: () => [] };
  const fpThrow = { evaluate: () => { throw new Error('bad'); } };
  const qr = { resourceType: 'QuestionnaireResponse' };

  it('no constraints → true', () => {
    expect(evalConstraints({ constraint: [] }, fpOk, qr, {})).toBe(true);
    expect(evalConstraints({}, fpOk, qr, {})).toBe(true);
  });
  it('no fp or qr → true (cannot evaluate)', () => {
    expect(evalConstraints({ constraint: [{ expression: 'x', severity: 'error' }] }, null, qr, {})).toBe(true);
    expect(evalConstraints({ constraint: [{ expression: 'x', severity: 'error' }] }, fpOk, null, {})).toBe(true);
  });
  it('error-severity constraint: passes when truthy, fails when false/empty', () => {
    const c = [{ expression: 'x', severity: 'error' }];
    expect(evalConstraints({ constraint: c }, fpOk, qr, {})).toBe(true);
    expect(evalConstraints({ constraint: c }, fpFalse, qr, {})).toBe(false);
    expect(evalConstraints({ constraint: c }, fpEmpty, qr, {})).toBe(false);
  });
  it('non-error severity is ignored', () => {
    const c = [{ expression: 'x', severity: 'warning' }];
    expect(evalConstraints({ constraint: c }, fpFalse, qr, {})).toBe(true);
  });
  it('thrown expression → false', () => {
    const c = [{ expression: 'x', severity: 'error' }];
    expect(evalConstraints({ constraint: c }, fpThrow, qr, {})).toBe(false);
  });
});

// ── calcFormOk — path scoping for repeating groups ────────────────────────────
describe('calcFormOk — path-scoped store', () => {
  it('wraps store.get with path argument when path is provided', () => {
    // store.get(id, path) returns valid url for path[0]=0, invalid for path[0]=1
    const mockStore = {
      get: (id, pathArg) => (pathArg && pathArg[0] === 0) ? 'https://valid.example' : 'not-a-url',
    };
    const n = node({ itemType: 'url' });
    expect(calcFormOk(n, mockStore, [0])).toBe(true);
    expect(calcFormOk(n, mockStore, [1])).toBe(false);
  });

  it('empty path array skips path-scoping', () => {
    const mockStore = { get: () => '' };
    const n = node({ itemType: 'url', mandatory: false });
    expect(calcFormOk(n, mockStore, [])).toBe(true);
  });
});
