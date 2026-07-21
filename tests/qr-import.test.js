// Unit tests for importQRAnswers in js/fhir/qr-import.js.
// qr-import.js has no external imports — no mocking needed.

import { describe, it, expect } from 'vitest';
import { importQRAnswers } from '../js/fhir/qr-import.js';
import { FHIR } from '../js/fhir/urls/fhir.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeTree(...ids) {
  return ids.map(id => ({ id, children: [] }));
}

function makeQR(items, questionnaire = '') {
  return { resourceType: 'QuestionnaireResponse', questionnaire, item: items };
}

// ── input validation ──────────────────────────────────────────────────────────

describe('importQRAnswers — input validation', () => {
  it('rejects null input', () => {
    const r = importQRAnswers(null, {}, []);
    expect(r.ok).toBe(false);
    expect(r.error).toBeDefined();
  });

  it('rejects undefined input', () => {
    const r = importQRAnswers(undefined, {}, []);
    expect(r.ok).toBe(false);
  });

  it('rejects wrong resourceType — Questionnaire', () => {
    const r = importQRAnswers({ resourceType: 'Questionnaire' }, {}, []);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Not a QuestionnaireResponse/);
    expect(r.error).toContain('Questionnaire');
  });

  it('rejects wrong resourceType — Patient', () => {
    const r = importQRAnswers({ resourceType: 'Patient' }, {}, []);
    expect(r.ok).toBe(false);
    expect(r.error).toContain('Patient');
  });

  it('rejects missing resourceType', () => {
    const r = importQRAnswers({}, {}, []);
    expect(r.ok).toBe(false);
  });

  it('accepts valid QR', () => {
    const r = importQRAnswers(makeQR([]), {}, []);
    expect(r.ok).toBe(true);
  });
});

// ── basic value loading ───────────────────────────────────────────────────────

describe('importQRAnswers — basic loading', () => {
  const tree = makeTree('q1', 'q2');

  it('returns ok: true on success', () => {
    const r = importQRAnswers(makeQR([
      { linkId: 'q1', answer: [{ valueString: 'hello' }] },
    ]), {}, tree);
    expect(r.ok).toBe(true);
  });

  it('loads a string value', () => {
    const values = {};
    importQRAnswers(makeQR([{ linkId: 'q1', answer: [{ valueString: 'hello' }] }]), values, tree);
    expect(values.q1).toEqual(['hello']);
  });

  it('loads a boolean value', () => {
    const values = {};
    importQRAnswers(makeQR([{ linkId: 'q1', answer: [{ valueBoolean: false }] }]), values, tree);
    expect(values.q1).toEqual([false]);
  });

  it('loads an integer value', () => {
    const values = {};
    importQRAnswers(makeQR([{ linkId: 'q1', answer: [{ valueInteger: 42 }] }]), values, tree);
    expect(values.q1).toEqual([42]);
  });

  it('loads a decimal value', () => {
    const values = {};
    importQRAnswers(makeQR([{ linkId: 'q1', answer: [{ valueDecimal: 3.14 }] }]), values, tree);
    expect(values.q1).toEqual([3.14]);
  });

  it('loads a date value', () => {
    const values = {};
    importQRAnswers(makeQR([{ linkId: 'q1', answer: [{ valueDate: '2025-06-01' }] }]), values, tree);
    expect(values.q1).toEqual(['2025-06-01']);
  });

  it('loads a dateTime value', () => {
    const values = {};
    importQRAnswers(makeQR([{ linkId: 'q1', answer: [{ valueDateTime: '2025-06-01T10:00:00Z' }] }]), values, tree);
    expect(values.q1).toEqual(['2025-06-01T10:00:00Z']);
  });

  it('loads a valueCoding code', () => {
    const values = {};
    importQRAnswers(makeQR([{ linkId: 'q1', answer: [{ valueCoding: { code: 'LA1', display: 'Option 1' } }] }]), values, tree);
    expect(values.q1).toEqual(['LA1']);
  });

  it('reports correct loaded count', () => {
    const r = importQRAnswers(makeQR([
      { linkId: 'q1', answer: [{ valueString: 'a' }] },
      { linkId: 'q2', answer: [{ valueString: 'b' }] },
    ]), {}, tree);
    expect(r.loaded).toBe(2);
  });

  it('captures the questionnaire reference', () => {
    const r = importQRAnswers(
      makeQR([], 'https://example.org/q1'),
      {}, []
    );
    expect(r.questionnaire).toBe('https://example.org/q1');
  });

  it('returns empty string questionnaire when not set', () => {
    const qr = { resourceType: 'QuestionnaireResponse', item: [] };
    const r = importQRAnswers(qr, {}, []);
    expect(r.questionnaire).toBe('');
  });
});

// ── all value types in one pass ───────────────────────────────────────────────

describe('importQRAnswers — all value types', () => {
  const tree = makeTree('q-str', 'q-bool', 'q-int', 'q-dec', 'q-date', 'q-dt', 'q-code');
  const qr = makeQR([
    { linkId: 'q-str',  answer: [{ valueString: 'text' }] },
    { linkId: 'q-bool', answer: [{ valueBoolean: true }] },
    { linkId: 'q-int',  answer: [{ valueInteger: 99 }] },
    { linkId: 'q-dec',  answer: [{ valueDecimal: 1.5 }] },
    { linkId: 'q-date', answer: [{ valueDate: '2026-01-15' }] },
    { linkId: 'q-dt',   answer: [{ valueDateTime: '2026-01-15T08:30:00Z' }] },
    { linkId: 'q-code', answer: [{ valueCoding: { code: 'C001', display: 'Choice 1' } }] },
  ]);

  it('loads all seven value types correctly in one pass', () => {
    const values = {};
    importQRAnswers(qr, values, tree);
    expect(values['q-str']).toEqual(['text']);
    expect(values['q-bool']).toEqual([true]);
    expect(values['q-int']).toEqual([99]);
    expect(values['q-dec']).toEqual([1.5]);
    expect(values['q-date']).toEqual(['2026-01-15']);
    expect(values['q-dt']).toEqual(['2026-01-15T08:30:00Z']);
    expect(values['q-code']).toEqual(['C001']);
  });
});

// ── time and reference value types ───────────────────────────────────────────

describe('importQRAnswers — time and reference types', () => {
  const tree = makeTree('q-time', 'q-ref');

  it('loads a valueTime string', () => {
    const values = {};
    importQRAnswers(makeQR([{ linkId: 'q-time', answer: [{ valueTime: '14:30:00' }] }]), values, tree);
    expect(values['q-time']).toEqual(['14:30:00']);
  });

  it('loads a valueReference as { reference } object', () => {
    const values = {};
    importQRAnswers(makeQR([{ linkId: 'q-ref', answer: [{ valueReference: { reference: 'Practitioner/456' } }] }]), values, tree);
    expect(values['q-ref']).toEqual([{ reference: 'Practitioner/456' }]);
  });

  it('loads a valueQuantity as { value, unit } object', () => {
    const values = {};
    importQRAnswers(makeQR([{ linkId: 'q-time', answer: [{ valueQuantity: { value: 70, unit: 'kg' } }] }]), values, tree);
    expect(values['q-time']).toEqual([{ value: 70, unit: 'kg' }]);
  });

  it('loads a valueUri as string', () => {
    const values = {};
    importQRAnswers(makeQR([{ linkId: 'q-ref', answer: [{ valueUri: 'https://example.org' }] }]), values, tree);
    expect(values['q-ref']).toEqual(['https://example.org']);
  });

  it('ignores answer entries with no recognised value type', () => {
    const values = {};
    importQRAnswers(makeQR([{ linkId: 'q-ref', answer: [{}] }]), values, tree);
    expect(values['q-ref']).toBeUndefined();
  });
});

// ── unmatched linkIds ─────────────────────────────────────────────────────────

describe('importQRAnswers — unmatched linkIds', () => {
  const tree = makeTree('q-known');

  it('reports unmatched linkId in result', () => {
    const r = importQRAnswers(makeQR([
      { linkId: 'q-known',   answer: [{ valueString: 'yes' }] },
      { linkId: 'q-unknown', answer: [{ valueString: 'no' }] },
    ]), {}, tree);
    expect(r.unmatched).toContain('q-unknown');
  });

  it('does not load value for unmatched linkId', () => {
    const values = {};
    importQRAnswers(makeQR([
      { linkId: 'q-unknown', answer: [{ valueString: 'no' }] },
    ]), values, tree);
    expect(values['q-unknown']).toBeUndefined();
  });

  it('still loads matched answer alongside unmatched', () => {
    const values = {};
    importQRAnswers(makeQR([
      { linkId: 'q-known',   answer: [{ valueString: 'yes' }] },
      { linkId: 'q-unknown', answer: [{ valueString: 'no' }] },
    ]), values, tree);
    expect(values['q-known']).toEqual(['yes']);
  });

  it('does not count unmatched in loaded count', () => {
    const r = importQRAnswers(makeQR([
      { linkId: 'q-known',   answer: [{ valueString: 'yes' }] },
      { linkId: 'q-unknown', answer: [{ valueString: 'no' }] },
    ]), {}, tree);
    expect(r.loaded).toBe(1);
  });

  it('returns empty unmatched array when all match', () => {
    const r = importQRAnswers(makeQR([
      { linkId: 'q-known', answer: [{ valueString: 'yes' }] },
    ]), {}, tree);
    expect(r.unmatched).toEqual([]);
  });
});

// ── nested group items ────────────────────────────────────────────────────────

describe('importQRAnswers — nested groups', () => {
  const tree = [{
    id: 'group1',
    children: [
      { id: 'q1', children: [] },
      { id: 'q2', children: [] },
    ],
  }];

  it('loads answers from nested group children', () => {
    const values = {};
    importQRAnswers(makeQR([{
      linkId: 'group1',
      item: [
        { linkId: 'q1', answer: [{ valueString: 'alpha' }] },
        { linkId: 'q2', answer: [{ valueInteger: 7 }] },
      ],
    }]), values, tree);
    expect(values.q1).toEqual(['alpha']);
    expect(values.q2).toEqual([7]);
  });

  it('handles two-level nesting', () => {
    const deepTree = [{
      id: 'outer',
      children: [{
        id: 'inner',
        children: [{ id: 'leaf', children: [] }],
      }],
    }];
    const values = {};
    importQRAnswers(makeQR([{
      linkId: 'outer',
      item: [{
        linkId: 'inner',
        item: [{ linkId: 'leaf', answer: [{ valueBoolean: true }] }],
      }],
    }]), values, deepTree);
    expect(values.leaf).toEqual([true]);
  });
});

// ── repeat rows (multiple answers) ───────────────────────────────────────────

describe('importQRAnswers — repeat rows', () => {
  const tree = makeTree('q-rep');

  it('loads first answer as the primary value', () => {
    const values = {};
    importQRAnswers(makeQR([{
      linkId: 'q-rep',
      answer: [
        { valueString: 'first' },
        { valueString: 'second' },
        { valueString: 'third' },
      ],
    }]), values, tree);
    expect(values['q-rep'][0]).toEqual('first');
  });

  it('loads all answers as array rows', () => {
    const values = {};
    importQRAnswers(makeQR([{
      linkId: 'q-rep',
      answer: [
        { valueString: 'first' },
        { valueString: 'second' },
        { valueString: 'third' },
      ],
    }]), values, tree);
    expect(values['q-rep']).toEqual(['first', 'second', 'third']);
  });

  it('row count equals the number of answers', () => {
    const values = {};
    importQRAnswers(makeQR([{
      linkId: 'q-rep',
      answer: [
        { valueString: 'a' },
        { valueString: 'b' },
        { valueString: 'c' },
      ],
    }]), values, tree);
    expect(values['q-rep']).toHaveLength(3);
  });

  it('single-answer item stores a one-row array', () => {
    const values = {};
    importQRAnswers(makeQR([{
      linkId: 'q-rep',
      answer: [{ valueString: 'only' }],
    }]), values, tree);
    expect(values['q-rep']).toEqual(['only']);
  });

  it('repeat rows count as a single loaded item', () => {
    const r = importQRAnswers(makeQR([{
      linkId: 'q-rep',
      answer: [
        { valueString: 'first' },
        { valueString: 'second' },
      ],
    }]), {}, tree);
    // Primary answer increments loaded; repeat meta-keys do not
    expect(r.loaded).toBe(1);
  });
});

// ── checklist (check-box itemControl) — multi-answer merge ──────────────────

describe('importQRAnswers — checklist merge', () => {
  const checklistTree = [{ id: 'q-cl', itemType: 'checklist', children: [] }];

  it('merges multiple answers into comma-separated value for checklist node', () => {
    const values = {};
    importQRAnswers(makeQR([{
      linkId: 'q-cl',
      answer: [
        { valueCoding: { code: 'a' } },
        { valueCoding: { code: 'b' } },
        { valueCoding: { code: 'c' } },
      ],
    }]), values, checklistTree);
    expect(values['q-cl']).toEqual(['a,b,c']);
  });

  it('single answer for checklist remains as-is', () => {
    const values = {};
    importQRAnswers(makeQR([{
      linkId: 'q-cl',
      answer: [{ valueCoding: { code: 'x' } }],
    }]), values, checklistTree);
    expect(values['q-cl']).toEqual(['x']);
  });

  it('regular (non-checklist) items are NOT merged', () => {
    const regularTree = makeTree('q-reg');
    const values = {};
    importQRAnswers(makeQR([{
      linkId: 'q-reg',
      answer: [
        { valueCoding: { code: 'a' } },
        { valueCoding: { code: 'b' } },
      ],
    }]), values, regularTree);
    expect(values['q-reg']).toEqual(['a', 'b']);
  });
});

// ── empty / missing answers ───────────────────────────────────────────────────

describe('importQRAnswers — empty/missing answers', () => {
  const tree = makeTree('q1');

  it('handles item with no answer key — ok: true, no value set', () => {
    const values = {};
    const r = importQRAnswers(makeQR([{ linkId: 'q1' }]), values, tree);
    expect(r.ok).toBe(true);
    expect(values.q1).toBeUndefined();
  });

  it('handles item with empty answer array — ok: true, no value set', () => {
    const values = {};
    const r = importQRAnswers(makeQR([{ linkId: 'q1', answer: [] }]), values, tree);
    expect(r.ok).toBe(true);
    expect(values.q1).toBeUndefined();
  });

  it('handles QR with no item array — ok: true, loaded: 0', () => {
    const r = importQRAnswers({ resourceType: 'QuestionnaireResponse' }, {}, tree);
    expect(r.ok).toBe(true);
    expect(r.loaded).toBe(0);
  });

  it('handles empty QR item array — ok: true, loaded: 0', () => {
    const r = importQRAnswers(makeQR([]), {}, tree);
    expect(r.ok).toBe(true);
    expect(r.loaded).toBe(0);
  });

  it('handles empty tree — all answers are unmatched', () => {
    const r = importQRAnswers(makeQR([
      { linkId: 'q1', answer: [{ valueString: 'hi' }] },
    ]), {}, []);
    expect(r.ok).toBe(true);
    expect(r.loaded).toBe(0);
    expect(r.unmatched).toContain('q1');
  });
});

// ── values object mutation ────────────────────────────────────────────────────

describe('importQRAnswers — values object mutation', () => {
  it('merges new keys into existing values (does not clear)', () => {
    const values = { existing: ['preserved'] };
    importQRAnswers(makeQR([
      { linkId: 'q1', answer: [{ valueString: 'new' }] },
    ]), values, makeTree('q1'));
    expect(values.existing).toEqual(['preserved']);
    expect(values.q1).toEqual(['new']);
  });

  it('overwrites existing key when same linkId present in QR', () => {
    const values = { q1: ['old'] };
    importQRAnswers(makeQR([
      { linkId: 'q1', answer: [{ valueString: 'new' }] },
    ]), values, makeTree('q1'));
    expect(values.q1).toEqual(['new']);
  });
});

// ── meta round-trip ───────────────────────────────────────────────────────────

describe('importQRAnswers — meta', () => {
  it('returns meta.status from QR', () => {
    const qr = { resourceType: 'QuestionnaireResponse', status: 'completed', item: [] };
    const r = importQRAnswers(qr, {}, []);
    expect(r.meta.status).toBe('completed');
  });

  it('defaults meta.status to in-progress when absent', () => {
    const r = importQRAnswers({ resourceType: 'QuestionnaireResponse', item: [] }, {}, []);
    expect(r.meta.status).toBe('in-progress');
  });

  it('returns meta.subject.reference when present', () => {
    const qr = { resourceType: 'QuestionnaireResponse', status: 'in-progress',
      subject: { reference: 'Patient/123' }, item: [] };
    const r = importQRAnswers(qr, {}, []);
    expect(r.meta.subject).toBe('Patient/123');
  });

  it('returns empty string for meta.subject when absent', () => {
    const r = importQRAnswers({ resourceType: 'QuestionnaireResponse', item: [] }, {}, []);
    expect(r.meta.subject).toBe('');
  });

  it('returns meta.author.reference when present', () => {
    const qr = { resourceType: 'QuestionnaireResponse', status: 'in-progress',
      author: { reference: 'Practitioner/456' }, item: [] };
    const r = importQRAnswers(qr, {}, []);
    expect(r.meta.author).toBe('Practitioner/456');
  });

  it('returns empty string for meta.author when absent', () => {
    const r = importQRAnswers({ resourceType: 'QuestionnaireResponse', item: [] }, {}, []);
    expect(r.meta.author).toBe('');
  });

  it('returns meta.id when present', () => {
    const qr = { resourceType: 'QuestionnaireResponse', id: 'resp-7', item: [] };
    const r = importQRAnswers(qr, {}, []);
    expect(r.meta.id).toBe('resp-7');
  });

  it('returns empty string for meta.id when absent', () => {
    const r = importQRAnswers({ resourceType: 'QuestionnaireResponse', item: [] }, {}, []);
    expect(r.meta.id).toBe('');
  });

  it('returns meta.language when present', () => {
    const qr = { resourceType: 'QuestionnaireResponse', language: 'de', item: [] };
    const r = importQRAnswers(qr, {}, []);
    expect(r.meta.language).toBe('de');
  });

  it('returns empty string for meta.language when absent', () => {
    const r = importQRAnswers({ resourceType: 'QuestionnaireResponse', item: [] }, {}, []);
    expect(r.meta.language).toBe('');
  });

  it('returns meta.metaVersionId when present', () => {
    const qr = { resourceType: 'QuestionnaireResponse', meta: { versionId: '3' }, item: [] };
    const r = importQRAnswers(qr, {}, []);
    expect(r.meta.metaVersionId).toBe('3');
  });

  it('returns empty string for meta.metaVersionId when absent', () => {
    const r = importQRAnswers({ resourceType: 'QuestionnaireResponse', item: [] }, {}, []);
    expect(r.meta.metaVersionId).toBe('');
  });

  it('returns meta.metaSource when present', () => {
    const qr = { resourceType: 'QuestionnaireResponse', meta: { source: 'https://example.org' }, item: [] };
    const r = importQRAnswers(qr, {}, []);
    expect(r.meta.metaSource).toBe('https://example.org');
  });

  it('returns meta.metaProfile as array when present', () => {
    const profile = [FHIR.sd + '/MyProfile'];
    const qr = { resourceType: 'QuestionnaireResponse', meta: { profile }, item: [] };
    const r = importQRAnswers(qr, {}, []);
    expect(r.meta.metaProfile).toEqual(profile);
  });

  it('returns empty array for meta.metaProfile when absent', () => {
    const r = importQRAnswers({ resourceType: 'QuestionnaireResponse', item: [] }, {}, []);
    expect(r.meta.metaProfile).toEqual([]);
  });
});
