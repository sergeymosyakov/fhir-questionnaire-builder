// Integration tests: buildQR + evalConstraints pipeline.
// Tests the full chain: FHIR Questionnaire → QR → constraint evaluation.
// Uses the real fhirpath evaluator (tests/helpers/fhirpath-node.js).

import { describe, it, expect } from 'vitest';
import { buildQR as _buildQR } from '../js/fhir/qr-builder.js';

// The store represents answers as a tree { linkId: [rows] }; wrap the scalar value
// maps these tests use into single-row arrays so the produced QR stays unchanged.
const bq = (fhir, vals = {}) =>
  _buildQR(fhir, Object.fromEntries(
    Object.entries(vals).map(([k, v]) => [k, Array.isArray(v) ? v : [v]])
  ));

const { evalConstraints } = await import('../js/fhir/form-checks.js');

const { loadFhirpath } = await import('./helpers/fhirpath-node.js');
const fp = loadFhirpath();

// ── decimal constraint ────────────────────────────────────────────────────────
describe('integration — decimal item constraint', () => {
  const fhir = {
    item: [
      { linkId: '1.1', type: 'decimal' },
      { linkId: '1.2', type: 'string' },
    ],
  };

  it('passes when decimal value satisfies >= constraint', () => {
    const qr = bq(fhir, { '1.1': 5, '1.2': 'x' });
    expect(qr.item.find(i => i.linkId === '1.1').answer).toEqual([{ valueDecimal: 5 }]);
    const node = {
      constraint: [{
        key: 'min-val', severity: 'error',
        expression: "%resource.repeat(item).where(linkId='1.1').answer.valueDecimal >= 3",
      }],
    };
    expect(evalConstraints(node, fp, qr, { resource: qr })).toBe(true);
  });

  it('fails when decimal value is below threshold', () => {
    const qr = bq(fhir, { '1.1': 2, '1.2': 'x' });
    const node = {
      constraint: [{
        key: 'min-val', severity: 'error',
        expression: "%resource.repeat(item).where(linkId='1.1').answer.valueDecimal >= 3",
      }],
    };
    expect(evalConstraints(node, fp, qr, { resource: qr })).toBe(false);
  });

  it('fails when valueInteger used for decimal-type item (wrong key)', () => {
    const qr = bq(fhir, { '1.1': 5 });
    expect(qr.item[0].answer[0]).not.toHaveProperty('valueInteger');
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
    const qr = bq(fhir, { 'q-months': 6 });
    expect(qr.item[0].answer).toEqual([{ valueInteger: 6 }]);
    const node = {
      constraint: [{
        key: 'diet-months', severity: 'error',
        expression: "%resource.repeat(item).where(linkId='q-months').answer.valueInteger >= 3",
      }],
    };
    expect(evalConstraints(node, fp, qr, { resource: qr })).toBe(true);
  });

  it('fails when integer value is below threshold', () => {
    const qr = bq(fhir, { 'q-months': 1 });
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
    const qr = bq(fhir, { 'phq9': 20 }); // above warning threshold
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
    const qr = bq(fhir, { nested: 10 });
    expect(qr.item[0].item[0].answer).toEqual([{ valueDecimal: 10 }]);
    const node = {
      constraint: [{
        key: 'c', severity: 'error',
        expression: "%resource.repeat(item).where(linkId='nested').answer.valueDecimal >= 5",
      }],
    };
    expect(evalConstraints(node, fp, qr, { resource: qr })).toBe(true);
  });
});
