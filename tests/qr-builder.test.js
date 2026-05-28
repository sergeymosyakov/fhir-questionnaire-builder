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

  it('quantity → valueQuantity with value and unit', () => {
    const qr = buildQR(mkFhir('q', 'quantity'), { q: { value: 70, unit: 'kg' } });
    expect(qr.item[0].answer[0].valueQuantity).toEqual({ value: 70, unit: 'kg' });
    expect(qr.item[0].answer[0].valueDecimal).toBeUndefined();
  });

  it('url → valueUri', () => {
    const qr = buildQR(mkFhir('q', 'url'), { q: 'https://example.org' });
    expect(qr.item[0].answer[0].valueUri).toBe('https://example.org');
    expect(qr.item[0].answer[0].valueString).toBeUndefined();
  });

  it('unknown type falls back to valueString', () => {
    const qr = buildQR(mkFhir('q', 'string'), { q: 'text' });
    expect(qr.item[0].answer[0].valueString).toBe('text');
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

  it('quantity type \u2192 valueQuantity (value + unit preserved)', () => {
    const qr = buildQR({ item: [{ linkId: 'q', type: 'quantity' }] }, { q: { value: 75, unit: 'kg' } });
    expect(qr.item[0].answer[0].valueQuantity).toEqual({ value: 75, unit: 'kg' });
    expect(qr.item[0].answer[0].valueDecimal).toBeUndefined();
  });

  it('choice type → valueCoding (use .answer.valueCoding.code in FHIRPath)', () => {
    const qr = buildQR({ item: [{ linkId: 'q', type: 'choice' }] }, { q: 'opt1' });
    expect(qr.item[0].answer[0].valueCoding.code).toBe('opt1');
  });

  it('reference type → valueReference', () => {
    const qr = buildQR({ item: [{ linkId: 'q', type: 'reference' }] }, { q: { reference: 'Practitioner/123' } });
    expect(qr.item[0].answer[0].valueReference).toEqual({ reference: 'Practitioner/123' });
    expect(qr.item[0].answer[0].valueString).toBeUndefined();
  });
});

// ── ordinalValue in QR answers ────────────────────────────────────────────────
const ORDINAL_URL = 'http://hl7.org/fhir/StructureDefinition/ordinalValue';

describe('buildQR — ordinalValue in valueCoding answers', () => {
  const mkChoiceFhir = answerOption => ({
    item: [{ linkId: 'q', type: 'choice', answerOption }],
  });

  it('no answerOption → plain valueCoding with code only', () => {
    const qr = buildQR(mkChoiceFhir([]), { q: 'opt1' });
    const vc = qr.item[0].answer[0].valueCoding;
    expect(vc.code).toBe('opt1');
    expect(vc.extension).toBeUndefined();
    expect(vc.system).toBeUndefined();
    expect(vc.display).toBeUndefined();
  });

  it('matching answerOption with ordinalValue on answerOption.extension', () => {
    const answerOption = [{
      extension: [{ url: ORDINAL_URL, valueDecimal: 3 }],
      valueCoding: { code: 'opt1', display: 'Option 1', system: 'http://example.org' },
    }];
    const qr = buildQR(mkChoiceFhir(answerOption), { q: 'opt1' });
    const vc = qr.item[0].answer[0].valueCoding;
    expect(vc.code).toBe('opt1');
    expect(vc.extension).toEqual([{ url: ORDINAL_URL, valueDecimal: 3 }]);
    expect(vc.display).toBe('Option 1');
    expect(vc.system).toBe('http://example.org');
  });

  it('matching answerOption with ordinalValue on valueCoding.extension (fallback)', () => {
    const answerOption = [{
      valueCoding: {
        code: 'opt2', display: 'Option 2',
        extension: [{ url: ORDINAL_URL, valueDecimal: 7 }],
      },
    }];
    const qr = buildQR(mkChoiceFhir(answerOption), { q: 'opt2' });
    const vc = qr.item[0].answer[0].valueCoding;
    expect(vc.code).toBe('opt2');
    expect(vc.extension).toEqual([{ url: ORDINAL_URL, valueDecimal: 7 }]);
  });

  it('answerOption with no ordinalValue → no extension on valueCoding', () => {
    const answerOption = [{ valueCoding: { code: 'opt1', display: 'Option 1' } }];
    const qr = buildQR(mkChoiceFhir(answerOption), { q: 'opt1' });
    const vc = qr.item[0].answer[0].valueCoding;
    expect(vc.code).toBe('opt1');
    expect(vc.display).toBe('Option 1');
    expect(vc.extension).toBeUndefined();
  });

  it('non-matching code → no enrichment (no system/display/extension)', () => {
    const answerOption = [{
      extension: [{ url: ORDINAL_URL, valueDecimal: 5 }],
      valueCoding: { code: 'other', display: 'Other', system: 'http://example.org' },
    }];
    const qr = buildQR(mkChoiceFhir(answerOption), { q: 'unknown' });
    const vc = qr.item[0].answer[0].valueCoding;
    expect(vc.code).toBe('unknown');
    expect(vc.extension).toBeUndefined();
    expect(vc.system).toBeUndefined();
  });

  it('open-choice also enriched with ordinalValue', () => {
    const answerOption = [{
      extension: [{ url: ORDINAL_URL, valueDecimal: 1 }],
      valueCoding: { code: 'la1', display: 'Not at all' },
    }];
    const fhir = { item: [{ linkId: 'q', type: 'open-choice', answerOption }] };
    const qr = buildQR(fhir, { q: 'la1' });
    const vc = qr.item[0].answer[0].valueCoding;
    expect(vc.extension).toEqual([{ url: ORDINAL_URL, valueDecimal: 1 }]);
  });

  it('multiple answers — each gets correct ordinalValue', () => {
    const answerOption = [
      { extension: [{ url: ORDINAL_URL, valueDecimal: 0 }], valueCoding: { code: 'a0', display: 'None' } },
      { extension: [{ url: ORDINAL_URL, valueDecimal: 1 }], valueCoding: { code: 'a1', display: 'Once' } },
    ];
    const fhir = { item: [{ linkId: 'q', type: 'choice', answerOption }] };
    const values = { q: 'a0', 'q$$1': 'a1', 'q$$n': 1 };
    const qr = buildQR(fhir, values);
    expect(qr.item[0].answer[0].valueCoding.extension[0].valueDecimal).toBe(0);
    expect(qr.item[0].answer[1].valueCoding.extension[0].valueDecimal).toBe(1);
  });
});

// ── buildQR — checklist (check-box itemControl) ──────────────────────────────
describe('buildQR — checklist multi-value', () => {
  it('splits comma-separated value into multiple answers for repeating choice', () => {
    const fhir = { item: [{ linkId: 'q', type: 'choice', repeats: true }] };
    const qr = buildQR(fhir, { q: 'a,b,c' });
    expect(qr.item[0].answer).toHaveLength(3);
    expect(qr.item[0].answer[0].valueCoding.code).toBe('a');
    expect(qr.item[0].answer[1].valueCoding.code).toBe('b');
    expect(qr.item[0].answer[2].valueCoding.code).toBe('c');
  });

  it('single value for repeating choice produces one answer', () => {
    const fhir = { item: [{ linkId: 'q', type: 'choice', repeats: true }] };
    const qr = buildQR(fhir, { q: 'a' });
    expect(qr.item[0].answer).toHaveLength(1);
    expect(qr.item[0].answer[0].valueCoding.code).toBe('a');
  });

  it('non-repeating choice with comma is NOT split', () => {
    const fhir = { item: [{ linkId: 'q', type: 'choice' }] };
    const qr = buildQR(fhir, { q: 'a,b' });
    expect(qr.item[0].answer).toHaveLength(1);
    expect(qr.item[0].answer[0].valueCoding.code).toBe('a,b');
  });
});

// ── buildQR — || fallback branches ────────────────────────────────────────────
describe('buildQR — fallback branches', () => {
  it('questionnaire field falls back to empty string when url and id absent', () => {
    const qr = buildQR({ item: [] }, {});
    expect(qr.questionnaire).toBe('');
  });

  it('integer answer falls back to 0 for non-numeric value', () => {
    const qr = buildQR({ item: [{ linkId: 'q', type: 'integer' }] }, { q: 'not-a-number' });
    expect(qr.item[0].answer[0].valueInteger).toBe(0);
  });

  it('decimal answer falls back to 0 for non-numeric value', () => {
    const qr = buildQR({ item: [{ linkId: 'q', type: 'decimal' }] }, { q: 'abc' });
    expect(qr.item[0].answer[0].valueDecimal).toBe(0);
  });

  it('quantity answer falls back to 0/empty for missing value/unit', () => {
    const qr = buildQR({ item: [{ linkId: 'q', type: 'quantity' }] }, { q: {} });
    expect(qr.item[0].answer[0].valueQuantity).toEqual({ value: 0, unit: '' });
  });

  it('reference answer falls back to empty string for missing reference', () => {
    const qr = buildQR({ item: [{ linkId: 'q', type: 'reference' }] }, { q: {} });
    expect(qr.item[0].answer[0].valueReference).toEqual({ reference: '' });
  });

  it('non-group boolean item with children embeds sub-items in answer', () => {
    const fhir = { item: [{
      linkId: 'q', type: 'boolean',
      item: [{ linkId: 'q.1', type: 'string' }],
    }]};
    const qr = buildQR(fhir, { q: true, 'q.1': 'follow-up' });
    expect(qr.item[0].answer[0].valueBoolean).toBe(true);
    expect(qr.item[0].answer[0].item).toHaveLength(1);
  });

  it('non-group string item with children embeds sub-items in answer', () => {
    const fhir = { item: [{
      linkId: 'q', type: 'string',
      item: [{ linkId: 'q.1', type: 'string' }],
    }]};
    const qr = buildQR(fhir, { q: 'yes', 'q.1': 'detail' });
    expect(qr.item[0].answer[0].valueString).toBe('yes');
    expect(qr.item[0].answer[0].item).toHaveLength(1);
  });
});
