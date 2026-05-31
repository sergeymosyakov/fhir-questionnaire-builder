// Integration tests: buildQR + evalConstraints pipeline.
// Tests the full chain: FHIR Questionnaire → QR → constraint evaluation.
// Uses a minimal real-like fhirpath mock that evaluates numeric comparisons.

import { describe, it, expect } from 'vitest';
import { buildQR } from '../js/fhir/qr-builder.js';

const { evalConstraints } = await import('../js/state.js');

// Minimal fhirpath mock: navigates QR structure and evaluates comparisons.
// Supports: %resource.repeat(item).where(linkId='X').answer.valueDecimal >= N
//           %resource.repeat(item).where(linkId='X').answer.valueInteger >= N
function makeRealFp() {
  return {
    evaluate(qr, expr, env) {
      // Resolve %resource
      const resource = env?.resource ?? qr;

      // Flatten all items recursively
      function flatItems(items) {
        const out = [];
        for (const it of (items || [])) {
          out.push(it);
          if (it.item) out.push(...flatItems(it.item));
        }
        return out;
      }

      // Pattern: *.repeat(item).where(linkId='X').answer.valueDecimal >= N
      const m = expr.match(
        /repeat\(item\)\.where\(linkId='([^']+)'\)\.answer\.(value\w+)\s*(>=|<=|>|<|=)\s*([\d.]+)/
      );
      if (m) {
        const [, linkId, valueKey, op, rawNum] = m;
        const num = parseFloat(rawNum);
        const all = flatItems(resource.item || []);
        const item = all.find(i => i.linkId === linkId);
        const val = item?.answer?.[0]?.[valueKey];
        if (val === undefined) return [false];
        if (op === '>=') return [val >= num];
        if (op === '<=') return [val <= num];
        if (op === '>')  return [val >  num];
        if (op === '<')  return [val <  num];
        if (op === '=')  return [val === num];
      }

      if (expr === 'true')  return [true];
      if (expr === 'false') return [false];
      return [];
    }
  };
}

const fp = makeRealFp();

// ── decimal constraint ────────────────────────────────────────────────────────
describe('integration — decimal item constraint', () => {
  const fhir = {
    item: [
      { linkId: '1.1', type: 'decimal' },
      { linkId: '1.2', type: 'string' },
    ],
  };

  it('passes when decimal value satisfies >= constraint', () => {
    const qr = buildQR(fhir, { '1.1': 5, '1.2': 'x' });
    const node = {
      constraint: [{
        key: 'min-val', severity: 'error',
        expression: "%resource.repeat(item).where(linkId='1.1').answer.valueDecimal >= 3",
      }],
    };
    expect(evalConstraints(node, fp, qr, { resource: qr })).toBe(true);
  });

  it('fails when decimal value is below threshold', () => {
    const qr = buildQR(fhir, { '1.1': 2, '1.2': 'x' });
    const node = {
      constraint: [{
        key: 'min-val', severity: 'error',
        expression: "%resource.repeat(item).where(linkId='1.1').answer.valueDecimal >= 3",
      }],
    };
    expect(evalConstraints(node, fp, qr, { resource: qr })).toBe(false);
  });

  it('fails when valueInteger used for decimal-type item (wrong key)', () => {
    const qr = buildQR(fhir, { '1.1': 5 });
    const node = {
      constraint: [{
        key: 'wrong-key', severity: 'error',
        expression: "%resource.repeat(item).where(linkId='1.1').answer.valueInteger >= 3",
      }],
    };
    // valueInteger is undefined for decimal-type item — constraint returns false
    expect(evalConstraints(node, fp, qr, { resource: qr })).toBe(false);
  });
});

// ── integer item constraint ───────────────────────────────────────────────────
describe('integration — integer item constraint', () => {
  const fhir = { item: [{ linkId: 'q-months', type: 'integer' }] };

  it('passes when integer value satisfies constraint', () => {
    const qr = buildQR(fhir, { 'q-months': 6 });
    const node = {
      constraint: [{
        key: 'diet-months', severity: 'error',
        expression: "%resource.repeat(item).where(linkId='q-months').answer.valueInteger >= 3",
      }],
    };
    expect(evalConstraints(node, fp, qr, { resource: qr })).toBe(true);
  });

  it('fails when integer value is below threshold', () => {
    const qr = buildQR(fhir, { 'q-months': 1 });
    const node = {
      constraint: [{
        key: 'diet-months', severity: 'error',
        expression: "%resource.repeat(item).where(linkId='q-months').answer.valueInteger >= 3",
      }],
    };
    expect(evalConstraints(node, fp, qr, { resource: qr })).toBe(false);
  });
});

// ── warning-only constraint never blocks ──────────────────────────────────────
describe('integration — warning constraint', () => {
  const fhir = { item: [{ linkId: 'phq9', type: 'integer' }] };

  it('warning constraint does not affect pass/fail', () => {
    const qr = buildQR(fhir, { 'phq9': 20 }); // above warning threshold
    const node = {
      constraint: [{
        key: 'phq9-warning', severity: 'warning',
        expression: "%resource.repeat(item).where(linkId='phq9').answer.valueInteger < 15",
      }],
    };
    // Even though 20 < 15 is false, warning does not block → returns true
    expect(evalConstraints(node, fp, qr, { resource: qr })).toBe(true);
  });
});

// ── nested items (group → item) ───────────────────────────────────────────────
describe('integration — nested item constraint', () => {
  it('repeat(item) finds items inside groups', () => {
    const fhir = {
      item: [{
        linkId: 'g1', type: 'group',
        item: [{ linkId: 'nested', type: 'decimal' }],
      }],
    };
    const qr = buildQR(fhir, { nested: 10 });
    const node = {
      constraint: [{
        key: 'c', severity: 'error',
        expression: "%resource.repeat(item).where(linkId='nested').answer.valueDecimal >= 5",
      }],
    };
    expect(evalConstraints(node, fp, qr, { resource: qr })).toBe(true);
  });
});
