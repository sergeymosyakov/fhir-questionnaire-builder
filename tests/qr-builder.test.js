// Tests for buildQR / buildQRItem in js/fhir/qr-builder.js.
// Both functions are pure (no state imports) — no mocking needed.

import { describe, it, expect } from 'vitest';
import { buildQR } from '../js/fhir/qr-builder.js';

// ── buildQR — top-level structure ─────────────────────────────────────────────
describe('buildQR — structure', () => {
  it('returns a QuestionnaireResponse resource', () => {
    const qr = buildQR({ item: [] }, {});
    expect(qr.resourceType).toBe('QuestionnaireResponse');
    expect(qr.status).toBe('in-progress');
  });

  it('uses questionnaire url when present', () => {
    const qr = buildQR({ url: 'http://example.org/q1', item: [] }, {});
    expect(qr.questionnaire).toBe('http://example.org/q1');
  });

  it('falls back to id when no url', () => {
    const qr = buildQR({ id: 'q-001', item: [] }, {});
    expect(qr.questionnaire).toBe('q-001');
  });

  it('returns empty item array for empty questionnaire', () => {
    const qr = buildQR({ item: [] }, {});
    expect(qr.item).toEqual([]);
  });
});

// ── group items ───────────────────────────────────────────────────────────────
describe('buildQR — group items', () => {
  it('group children go directly under item[], no answer', () => {
    const fhir = {
      item: [{
        linkId: 'g1', type: 'group',
        item: [{ linkId: 'q1', type: 'string' }],
      }],
    };
    const qr = buildQR(fhir, { q1: 'hello' });
    const g = qr.item[0];
    expect(g.linkId).toBe('g1');
    expect(g.answer).toBeUndefined();
    expect(g.item[0].linkId).toBe('q1');
    expect(g.item[0].answer[0].valueString).toBe('hello');
  });

  it('group with no children produces no item array', () => {
    const fhir = { item: [{ linkId: 'g1', type: 'group', item: [] }] };
    const qr = buildQR(fhir, {});
    expect(qr.item[0].item).toBeUndefined();
  });
});

// ── leaf questions — answer types ─────────────────────────────────────────────
describe('buildQR — leaf answer types', () => {
  const mkFhir = (linkId, type) => ({ item: [{ linkId, type }] });

  it('boolean true', () => {
    const qr = buildQR(mkFhir('q', 'boolean'), { q: true });
    expect(qr.item[0].answer[0].valueBoolean).toBe(true);
  });

  it('boolean false', () => {
    const qr = buildQR(mkFhir('q', 'boolean'), { q: false });
    expect(qr.item[0].answer[0].valueBoolean).toBe(false);
  });

  it('string value', () => {
    const qr = buildQR(mkFhir('q', 'string'), { q: 'hello' });
    expect(qr.item[0].answer[0].valueString).toBe('hello');
  });

  it('text value', () => {
    const qr = buildQR(mkFhir('q', 'text'), { q: 'my text' });
    expect(qr.item[0].answer[0].valueString).toBe('my text');
  });

  it('decimal value', () => {
    const qr = buildQR(mkFhir('q', 'decimal'), { q: 3.14 });
    expect(qr.item[0].answer[0].valueDecimal).toBe(3.14);
  });

  it('integer value', () => {
    const qr = buildQR(mkFhir('q', 'integer'), { q: 42 });
    expect(qr.item[0].answer[0].valueInteger).toBe(42);
  });

  it('choice → valueCoding', () => {
    const qr = buildQR(mkFhir('q', 'choice'), { q: 'opt1' });
    expect(qr.item[0].answer[0].valueCoding).toEqual({ code: 'opt1' });
  });

  it('open-choice → valueCoding', () => {
    const qr = buildQR(mkFhir('q', 'open-choice'), { q: 'custom' });
    expect(qr.item[0].answer[0].valueCoding).toEqual({ code: 'custom' });
  });

  it('quantity → valueDecimal', () => {
    const qr = buildQR(mkFhir('q', 'quantity'), { q: 75 });
    expect(qr.item[0].answer[0].valueDecimal).toBe(75);
  });

  it('unknown type falls back to valueString', () => {
    const qr = buildQR(mkFhir('q', 'url'), { q: 'https://example.org' });
    expect(qr.item[0].answer[0].valueString).toBe('https://example.org');
  });
});

// ── unanswered items ──────────────────────────────────────────────────────────
describe('buildQR — unanswered items', () => {
  it('no answer node when question not in values', () => {
    const fhir = { item: [{ linkId: 'q1', type: 'string' }] };
    const qr = buildQR(fhir, {});
    expect(qr.item[0].answer).toBeUndefined();
  });

  it('boolean with undefined value → no answer', () => {
    const fhir = { item: [{ linkId: 'q1', type: 'boolean' }] };
    const qr = buildQR(fhir, {});
    expect(qr.item[0].answer).toBeUndefined();
  });

  it('preserves linkId on unanswered item', () => {
    const fhir = { item: [{ linkId: 'q1', type: 'string' }] };
    const qr = buildQR(fhir, {});
    expect(qr.item[0].linkId).toBe('q1');
  });
});

// ── non-group question with sub-items ─────────────────────────────────────────
describe('buildQR — question with nested sub-items', () => {
  it('answer contains value + nested item', () => {
    const fhir = {
      item: [{
        linkId: 'parent', type: 'boolean',
        item: [{ linkId: 'child', type: 'string' }],
      }],
    };
    const qr = buildQR(fhir, { parent: true, child: 'detail' });
    const ans = qr.item[0].answer[0];
    expect(ans.valueBoolean).toBe(true);
    expect(ans.item[0].answer[0].valueString).toBe('detail');
  });

  it('string parent with sub-items includes valueString', () => {
    const fhir = {
      item: [{
        linkId: 'p', type: 'string',
        item: [{ linkId: 'c', type: 'string' }],
      }],
    };
    const qr = buildQR(fhir, { p: 'yes', c: 'note' });
    expect(qr.item[0].answer[0].valueString).toBe('yes');
  });
});

// ── deep nesting ──────────────────────────────────────────────────────────────
describe('buildQR — deep nesting', () => {
  it('3-level group nesting', () => {
    const fhir = {
      item: [{
        linkId: 'g1', type: 'group',
        item: [{
          linkId: 'g2', type: 'group',
          item: [{ linkId: 'leaf', type: 'string' }],
        }],
      }],
    };
    const qr = buildQR(fhir, { leaf: 'deep value' });
    const leaf = qr.item[0].item[0].item[0];
    expect(leaf.linkId).toBe('leaf');
    expect(leaf.answer[0].valueString).toBe('deep value');
  });
});

// ── multiple root items ───────────────────────────────────────────────────────
describe('buildQR — multiple items', () => {
  it('all root items included', () => {
    const fhir = {
      item: [
        { linkId: 'a', type: 'string' },
        { linkId: 'b', type: 'boolean' },
        { linkId: 'c', type: 'decimal' },
      ],
    };
    const qr = buildQR(fhir, { a: 'hello', b: true, c: 1.5 });
    expect(qr.item).toHaveLength(3);
    expect(qr.item[1].answer[0].valueBoolean).toBe(true);
  });
});

// ── type → value[x] mapping (regression: correct key for FHIRPath expressions) ──
describe('buildQR — type to value[x] mapping', () => {
  it('decimal type → valueDecimal (use .answer.valueDecimal in FHIRPath)', () => {
    const qr = buildQR({ item: [{ linkId: 'q', type: 'decimal' }] }, { q: 3.5 });
    expect(qr.item[0].answer[0].valueDecimal).toBe(3.5);
    expect(qr.item[0].answer[0].valueInteger).toBeUndefined();
  });

  it('integer type → valueInteger (use .answer.valueInteger in FHIRPath)', () => {
    const qr = buildQR({ item: [{ linkId: 'q', type: 'integer' }] }, { q: 5 });
    expect(qr.item[0].answer[0].valueInteger).toBe(5);
    expect(qr.item[0].answer[0].valueDecimal).toBeUndefined();
  });

  it('integer parses string input', () => {
    const qr = buildQR({ item: [{ linkId: 'q', type: 'integer' }] }, { q: '7' });
    expect(qr.item[0].answer[0].valueInteger).toBe(7);
  });

  it('decimal parses string input', () => {
    const qr = buildQR({ item: [{ linkId: 'q', type: 'decimal' }] }, { q: '2.5' });
    expect(qr.item[0].answer[0].valueDecimal).toBe(2.5);
  });

  it('string type → valueString', () => {
    const qr = buildQR({ item: [{ linkId: 'q', type: 'string' }] }, { q: 'hello' });
    expect(qr.item[0].answer[0].valueString).toBe('hello');
  });

  it('boolean type → valueBoolean', () => {
    const qr = buildQR({ item: [{ linkId: 'q', type: 'boolean' }] }, { q: true });
    expect(qr.item[0].answer[0].valueBoolean).toBe(true);
  });

  it('quantity type → valueDecimal (use .answer.valueDecimal in FHIRPath)', () => {
    const qr = buildQR({ item: [{ linkId: 'q', type: 'quantity' }] }, { q: 75 });
    expect(qr.item[0].answer[0].valueDecimal).toBe(75);
  });

  it('choice type → valueCoding (use .answer.valueCoding.code in FHIRPath)', () => {
    const qr = buildQR({ item: [{ linkId: 'q', type: 'choice' }] }, { q: 'opt1' });
    expect(qr.item[0].answer[0].valueCoding.code).toBe('opt1');
  });
});

