// Comparing an edited form with a reference file: a moved threshold, a removed question, an option that is gone, an unchanged form.
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadFhirpath } from './helpers/fhirpath-node.js';

const _listeners = {};
globalThis.document = {
  dispatchEvent(e) { (_listeners[e.type] || []).forEach((fn) => fn(e)); },
  addEventListener(type, fn) { (_listeners[type] = _listeners[type] || []).push(fn); },
  removeEventListener(type, fn) { _listeners[type] = (_listeners[type] || []).filter((f) => f !== fn); },
};
vi.mock('../js/ui/toast.js', () => ({ showError: vi.fn(), showWarn: vi.fn(), showInfo: vi.fn() }));
vi.mock('../js/builder/index.js', () => ({ renderTree: vi.fn() }));
const { runCheck } = await import('../js/fhir/check/run-check.js');
const { buildReferenceBundle } = await import('../js/fhir/check/reference-bundle.js');
const { compareToReference, sameValue } = await import('../js/fhir/check/compare.js');
const { readReference } = await import('../js/fhir/check/reference.js');

const fp = loadFhirpath();
const phq9 = fs.readFileSync(path.resolve('templates/phq-9.template.json'), 'utf8');
const reference = buildReferenceBundle(await runCheck(phq9, { fp }));
const compare = (current, opts = {}) => compareToReference({ reference, current, fp, ...opts });
const calc = (r, id) => r.calcs.find((c) => c.id === id);

describe('compare with a reference file', () => {
  it('an unchanged form changes nothing', async () => {
    const r = await compare(phq9);
    expect(r.calcs.map((c) => c.status)).toEqual(['same', 'same']);
    expect(r.calcs.every((c) => c.changed === 0 && !c.formulaChanged)).toBe(true);
    expect(r.fromReference).toBeGreaterThan(10);
    expect(r.scenarios).toBeGreaterThanOrEqual(r.fromReference);
    expect(r.removedQuestions).toEqual([]);
    expect(r.invalidAnswers).toEqual([]);
  });

  it('by default only the answer sets in the file are run; the generated ones are added on request', async () => {
    const q = JSON.parse(phq9);
    const extra = (items) => items.forEach((i) => {
      if (i.linkId === 'phq9-q1') i.answerOption.push({ valueCoding: { system: 'http://loinc.org', code: 'LA-NEW', display: 'A new answer' } }); // an answer the saved sets never used
      if (i.item) extra(i.item);
    });
    extra(q.item);
    const edited = JSON.stringify(q);
    const own = await compare(edited);
    const more = await compare(edited, { tryGenerated: true });
    expect(own.scenarios).toBe(own.fromReference);
    expect(more.scenarios).toBeGreaterThan(own.scenarios);
    expect(more.generated).toBe(true);
  });

  it('a single saved response is a single check, with the expected value taken from the file', async () => {
    const one = JSON.parse(JSON.stringify(reference));
    const total = (e) => e.resource.item?.[0]?.item?.find((i) => i.linkId === 'phq9-total');
    const target = one.entry.slice(1).find((e) => total(e)?.answer?.[0]?.valueDecimal > 0 || total(e)?.answer?.[0]?.valueInteger > 0);
    one.entry = [one.entry[0], target];
    const mistaken = JSON.parse(JSON.stringify(one));
    const t = total(mistaken.entry[1]);
    t.answer = [{ valueInteger: 999 }]; // the file expects a total the form cannot give
    const ok = await compareToReference({ reference: one, current: phq9, fp });
    expect(ok.scenarios).toBe(1);
    expect(calc(ok, 'phq9-total').status).toBe('same');
    const bad = await compareToReference({ reference: mistaken, current: phq9, fp });
    expect(bad.scenarios).toBe(1);
    expect(calc(bad, 'phq9-total').status).toBe('changed');
    expect(calc(bad, 'phq9-total').examples[0]).toMatchObject({ expected: '999' });
  });

  describe('what the file records', () => {
    const edit = (change) => {
      const copy = JSON.parse(JSON.stringify(reference));
      change(copy);
      return copy;
    };
    const findItem = (e, id) => e.resource.item?.[0]?.item?.find((i) => i.linkId === id);
    const withSeverity = (b) => b.entry.slice(1).find((e) => findItem(e, 'phq9-severity')?.answer?.length);

    it('a result the file records is what the form is expected to give, and the disagreement with today is noted', async () => {
      const wrong = edit((b) => { findItem(withSeverity(b), 'phq9-severity').answer = [{ valueString: 'Recorded by hand' }]; });
      const r = await compareToReference({ reference: wrong, current: phq9, fp });
      const sev = calc(r, 'phq9-severity');
      expect(sev.status).toBe('changed');
      expect(sev.changed).toBe(1);
      expect(sev.drift).toBe(1);
      expect(sev.examples[0].expected).toBe('Recorded by hand');
    });

    it('in a file saved by the check a calculation missing from a response means "no result"', async () => {
      const empty = edit((b) => { const e = withSeverity(b); e.resource.item[0].item = e.resource.item[0].item.filter((i) => i.linkId !== 'phq9-severity'); });
      const sev = calc(await compareToReference({ reference: empty, current: phq9, fp }), 'phq9-severity');
      expect(sev.changed).toBe(1);
      expect(sev.examples[0].expected).toBeNull();
    });

    it('a hand-made file says nothing about a calculation it lacks: the saved form is run today instead', async () => {
      const hand = edit((b) => {
        delete b.meta;
        b.entry.slice(1).forEach((e) => { e.resource.item[0].item = e.resource.item[0].item.filter((i) => !/^phq9-(total|severity)$/.test(i.linkId)); });
      });
      const r = await compareToReference({ reference: hand, current: phq9, fp });
      expect(r.calcs.map((c) => [c.status, c.drift])).toEqual([['same', 0], ['same', 0]]);
    });
  });

  it('a moved threshold changes the band, with the answers that show it', async () => {
    const r = await compare(phq9.replace('< 15', '< 10'));
    const sev = calc(r, 'phq9-severity');
    expect(sev.status).toBe('changed');
    expect(sev.changed).toBeGreaterThan(0);
    expect(sev.formulaChanged).toBe(true);
    expect(sev.examples[0]).toMatchObject({ expected: 'Moderate depression' });
    expect(sev.examples[0].actual).not.toBe('Moderate depression');
    expect(sev.examples[0].answers.length).toBeGreaterThan(0);
    expect(calc(r, 'phq9-total').status).toBe('same');
  });

  it('a formula written differently with the same results is flagged but not changed', async () => {
    const edited = phq9.replace('.valueDecimal.sum()', '.valueDecimal.sum() + 0');
    expect(edited).not.toBe(phq9);
    const total = calc(await compare(edited), 'phq9-total');
    expect(total.status).toBe('same');
    expect(total.formulaChanged).toBe(true);
  });

  it('a removed question is reported, and the calculation that read it changes', async () => {
    const q = JSON.parse(phq9);
    const strip = (items) => items.filter((i) => i.linkId !== 'phq9-q3').map((i) => (i.item ? { ...i, item: strip(i.item) } : i));
    q.item = strip(q.item);
    const r = await compare(JSON.stringify(q));
    expect(r.removedQuestions.map((x) => x.id)).toContain('phq9-q3');
    expect(calc(r, 'phq9-total').changed).toBeGreaterThan(0);
  });

  it('an answer option that is gone is reported', async () => {
    const q = JSON.parse(phq9);
    const drop = (items) => items.forEach((i) => {
      if (i.linkId === 'phq9-q1') i.answerOption = i.answerOption.slice(0, 3);
      if (i.item) drop(i.item);
    });
    drop(q.item);
    const r = await compare(JSON.stringify(q));
    expect(r.invalidAnswers.map((x) => x.id)).toContain('phq9-q1');
  });

  it('a question that exists only in the current form is not reported as no longer asked', async () => {
    const q = JSON.parse(phq9);
    q.item[0].item.push({ linkId: 'phq9-new', type: 'integer', text: 'A new question' }, { linkId: 'phq9-new-hidden', type: 'integer', text: 'Shown only for a big answer', enableWhen: [{ question: 'phq9-new', operator: '>', answerInteger: 5 }] });
    const r = await compare(JSON.stringify(q));
    expect(r.showWhen.noLongerAsked).toEqual([]);
  });

  it('a Show When rule that now hides a question is reported', async () => {
    const q = JSON.parse(phq9);
    const hide = (items) => items.forEach((i) => {
      if (i.linkId === 'phq9-q9') i.enableWhen = [{ question: 'phq9-q1', operator: '=', answerCoding: { system: 'http://loinc.org', code: 'LA6568-5' } }];
      if (i.item) hide(i.item);
    });
    hide(q.item);
    const r = await compare(JSON.stringify(q));
    expect(r.showWhen.noLongerAsked.map((x) => x.id)).toContain('phq9-q9');
  });

  it('a calculation the saved form had and the current one lacks is removed, a new one is added', async () => {
    const q = JSON.parse(phq9);
    const strip = (items) => items.map((i) => {
      if (i.linkId === 'phq9-severity') { const { extension, ...rest } = i; return { ...rest, extension: (extension || []).filter((e) => !/calculatedExpression/.test(e.url)) }; }
      return i.item ? { ...i, item: strip(i.item) } : i;
    });
    q.item = strip(q.item);
    const r = await compare(JSON.stringify(q));
    expect(calc(r, 'phq9-severity').status).toBe('removed');
  });

  it('removed-question counts are over the file\'s own answer sets, not the generated ones', async () => {
    const q = JSON.parse(phq9);
    const strip = (items) => items.filter((i) => i.linkId !== 'phq9-q3').map((i) => (i.item ? { ...i, item: strip(i.item) } : i));
    q.item = strip(q.item);
    const r = await compare(JSON.stringify(q), { tryGenerated: true });
    const removed = r.removedQuestions.find((x) => x.id === 'phq9-q3');
    expect(removed.count).toBeLessThanOrEqual(r.fromReference);
  });

  it('refuses something that is not a Questionnaire', async () => {
    await expect(compare('{"resourceType":"Patient"}')).rejects.toThrow(/Questionnaire/);
    await expect(compare('{ not json')).rejects.toThrow();
  });
});

describe('comparing values', () => {
  it('text must match exactly; only float noise between two numbers is ignored', () => {
    expect(sameValue('7', '7')).toBe(true);
    expect(sameValue('0.30000000000000004', '0.3')).toBe(true);
    expect(sameValue('1.0', '1')).toBe(false);
    expect(sameValue('007', '7')).toBe(false);
    expect(sameValue('Mild', 'mild')).toBe(false);
    expect(sameValue(null, null)).toBe(true);
    expect(sameValue(null, '0')).toBe(false);
  });
});

describe('a hand-made reference with a checklist answer', () => {
  it('keeps every selection, and does not call the selections an option that is gone', async () => {
    const form = fs.readFileSync(path.resolve('tests/fixtures/checklist-comma-code.fhir.json'), 'utf8');
    const response = { resourceType: 'QuestionnaireResponse', questionnaire: 'checklist-comma-code', status: 'completed', item: [{ linkId: 'symptoms', answer: [{ valueCoding: { code: 'cough,dry' } }, { valueCoding: { code: 'fever' } }] }] };
    const hand = { resourceType: 'Bundle', type: 'collection', entry: [{ resource: JSON.parse(form) }, { resource: response }] };
    const r = await compareToReference({ reference: hand, current: form, fp });
    expect(r.fromReference).toBe(1);
    expect(r.invalidAnswers).toEqual([]);
  });
});

describe('reading a reference file', () => {
  const qr = { resourceType: 'QuestionnaireResponse', item: [] };
  const form = { resourceType: 'Questionnaire', item: [] };
  const bundle = (...resources) => ({ resourceType: 'Bundle', type: 'collection', entry: resources.map((resource) => ({ resource })) });

  it('takes the Questionnaire and the responses in any order', () => {
    const r = readReference(bundle(qr, form, qr));
    expect(r.questionnaire).toEqual(form);
    expect(r.responses).toHaveLength(2);
  });

  it('a malformed entry list is a readable error, not a crash', () => {
    expect(() => readReference({ resourceType: 'Bundle', entry: {} })).toThrow(/exactly one Questionnaire/);
  });

  it('says what is wrong', () => {
    expect(() => readReference('{ nope')).toThrow(/not valid JSON/);
    expect(() => readReference({ resourceType: 'Questionnaire' })).toThrow(/Bundle/);
    expect(() => readReference(bundle(qr))).toThrow(/exactly one Questionnaire/);
    expect(() => readReference(bundle(form, form, qr))).toThrow(/exactly one Questionnaire/);
    expect(() => readReference(bundle(form))).toThrow(/no QuestionnaireResponse/);
  });
});
