import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import fhirpath from 'fhirpath';
import fhirpath_r4_model from 'fhirpath/fhir-context/r4/index.js';
import { templateGroupFrom } from '../js/fhir/templates.js';
import { remapSubtree, collectLinkIds, linkIdRefsIn } from '../js/fhir/linkid-remap.js';

const DIR = path.resolve('templates');
const ORD = 'http://hl7.org/fhir/StructureDefinition/ordinalValue';
const CALC = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-calculatedExpression';
const library = JSON.parse(fs.readFileSync(path.join(DIR, 'library.json'), 'utf8'));
const load = id => {
  const entry = library.find(e => e.id === id);
  return templateGroupFrom(JSON.parse(fs.readFileSync(path.join(DIR, entry.file), 'utf8')));
};
const SCORED = ['phq-9', 'phq-2', 'gad-7', 'gad-2', 'audit-c', 'glasgow-coma-scale', 'apgar-score', 'gds-15', 'pc-ptsd-5'];
const walk = (items, fn) => items.forEach(i => { fn(i); walk(i.item ?? [], fn); });

describe('template library catalog', () => {
  it('has unique ids and complete, link-safe metadata', () => {
    expect(new Set(library.map(e => e.id)).size).toBe(library.length);
    for (const e of library) {
      for (const k of ['id', 'name', 'description', 'scoring', 'source', 'license', 'file']) expect(e[k], `${e.id}.${k}`).toBeTruthy();
      expect(Array.isArray(e.keywords) && e.keywords.length > 0, `${e.id}.keywords`).toBe(true);
      for (const k of ['sourceUrl', 'licenseUrl']) if (e[k]) expect(e[k]).toMatch(/^https:\/\//);
      expect(fs.existsSync(path.join(DIR, e.file)), e.file).toBe(true);
    }
  });
});

describe.each(library.map(e => e.id))('template %s', id => {
  const group = load(id);

  it('is one wrapper group with unique linkIds sharing the group prefix', () => {
    const ids = [];
    walk([group], i => ids.push(i.linkId));
    expect(new Set(ids).size).toBe(ids.length);
    expect(group.text).toBeTruthy();
  });

  it('codes items with LOINC and gives every choice item at least two options', () => {
    walk(group.item, i => {
      if (i.code) for (const c of i.code) expect(c).toMatchObject({ system: 'http://loinc.org', code: expect.stringMatching(/^\d+-\d$/) });
      if (i.type === 'choice') expect(i.answerOption.length, i.linkId).toBeGreaterThanOrEqual(2);
    });
  });

  it.runIf(SCORED.includes(id))('gives every choice item of a scored scale LOINC-coded, scored options', () => {
    walk(group.item, i => {
      if (i.type !== 'choice') return;
      for (const o of i.answerOption) {
        expect(o.valueCoding.code, i.linkId).toMatch(/^LA\d+-\d$/);
        expect(o.extension.find(e => e.url === ORD)?.valueDecimal, i.linkId).toBeTypeOf('number');
      }
    });
  });
});

// QR with every scored choice item answered by option index `pick(i)`; items missing from `answered` are left blank.
function qrFor(group, answeredIds, pick) {
  const item = [];
  walk(group.item, i => {
    if (i.type !== 'choice' || !answeredIds.includes(i.linkId)) return;
    const o = i.answerOption[Math.min(pick(i), i.answerOption.length - 1)];
    const ord = o.extension.find(e => e.url === ORD).valueDecimal;
    item.push({ linkId: i.linkId, answer: [{ valueCoding: { ...o.valueCoding, extension: [{ url: ORD, valueDecimal: ord }] } }] });
  });
  return { resourceType: 'QuestionnaireResponse', status: 'in-progress', item };
}
const exprOf = (group, linkId) => {
  let e;
  walk(group.item, i => { if (i.linkId === linkId) e = i.extension.find(x => x.url === CALC).valueExpression.expression; });
  return e;
};
const evalIn = (qr, expr) => fhirpath.evaluate(qr, expr, { resource: qr }, fhirpath_r4_model);
const withTotal = (qr, linkId, v) => ({ ...qr, item: [...qr.item, { linkId, answer: [{ valueDecimal: v }] }] });

describe('template scoring', () => {
  const cases = [
    { id: 'phq-9', total: 'phq9-total', sev: 'phq9-severity', n: 9,
      bands: [[0, 'Minimal depression'], [4, 'Minimal depression'], [5, 'Mild depression'], [9, 'Mild depression'], [10, 'Moderate depression'], [14, 'Moderate depression'], [15, 'Moderately severe depression'], [19, 'Moderately severe depression'], [20, 'Severe depression'], [27, 'Severe depression']] },
    { id: 'phq-2', total: 'phq2-total', sev: 'phq2-result', n: 2,
      bands: [[0, 'Negative screen'], [2, 'Negative screen'], [3, 'Positive screen — follow up with the PHQ-9'], [6, 'Positive screen — follow up with the PHQ-9']] },
    { id: 'gad-2', total: 'gad2-total', sev: 'gad2-result', n: 2,
      bands: [[0, 'Negative screen'], [2, 'Negative screen'], [3, 'Positive screen — follow up with the GAD-7'], [6, 'Positive screen — follow up with the GAD-7']] },
    { id: 'gad-7', total: 'gad7-total', sev: 'gad7-severity', n: 7,
      bands: [[0, 'Minimal anxiety'], [4, 'Minimal anxiety'], [5, 'Mild anxiety'], [9, 'Mild anxiety'], [10, 'Moderate anxiety'], [14, 'Moderate anxiety'], [15, 'Severe anxiety'], [21, 'Severe anxiety']] },
    { id: 'audit-c', total: 'auditc-total', n: 3 },
    { id: 'glasgow-coma-scale', total: 'gcs-total', sev: 'gcs-severity', n: 3,
      bands: [[3, 'Severe (GCS 3–8)'], [8, 'Severe (GCS 3–8)'], [9, 'Moderate (GCS 9–12)'], [12, 'Moderate (GCS 9–12)'], [13, 'Mild (GCS 13–15)'], [15, 'Mild (GCS 13–15)']] },
    { id: 'gds-15', total: 'gds15-total', sev: 'gds15-result', n: 15,
      bands: [[0, 'Within normal range (0–5)'], [5, 'Within normal range (0–5)'], [6, 'Suggests depression (6–15) — follow up with a clinical assessment'], [15, 'Suggests depression (6–15) — follow up with a clinical assessment']] },
    ...['apgar1', 'apgar5'].map(p => ({
      id: 'apgar-score', prefix: p + '-', total: p + '-total', sev: p + '-band', n: 5,
      bands: [[0, 'Low (0–3)'], [3, 'Low (0–3)'], [4, 'Moderately abnormal (4–6)'], [6, 'Moderately abnormal (4–6)'], [7, 'Reassuring (7–10)'], [10, 'Reassuring (7–10)']],
    })),
  ];

  describe.each(cases)('$total', ({ id, prefix = '', total, sev, n, bands }) => {
    const group = load(id);
    const scored = [];
    walk(group.item, i => { if (i.type === 'choice' && i.required && i.linkId.startsWith(prefix)) scored.push(i.linkId); });

    it('has the expected number of scored questions', () => expect(scored).toHaveLength(n));

    it('sums the option scores: lowest, highest and a mix', () => {
      const ordAt = (i, idx) => i.answerOption[Math.min(idx, i.answerOption.length - 1)].extension.find(e => e.url === ORD).valueDecimal;
      const items = {}; walk(group.item, i => { items[i.linkId] = i; });
      const sumAt = pickIdx => scored.reduce((sum, l, k) => sum + ordAt(items[l], pickIdx(k, items[l])), 0);
      expect(evalIn(qrFor(group, scored, () => 0), exprOf(group, total))).toEqual([sumAt(() => 0)]);
      expect(evalIn(qrFor(group, scored, i => i.answerOption.length - 1), exprOf(group, total))).toEqual([sumAt((k, i) => i.answerOption.length - 1)]);
      expect(evalIn(qrFor(group, scored, i => scored.indexOf(i.linkId) % 3), exprOf(group, total))).toEqual([sumAt(k => k % 3)]);
    });

    it('gives no score until every scored question is answered', () => {
      expect(evalIn(qrFor(group, scored.slice(1), () => 1), exprOf(group, total))).toEqual([]);
    });

    if (sev) {
      it.each(bands)('score %i falls in "%s"', (score, label) => {
        const qr = withTotal({ resourceType: 'QuestionnaireResponse', item: [] }, total, score);
        expect(evalIn(qr, exprOf(group, sev))).toEqual([label]);
      });
      it('shows no severity before a score exists', () => {
        expect(evalIn({ resourceType: 'QuestionnaireResponse', item: [] }, exprOf(group, sev))).toEqual([]);
      });
    }
  });
});

describe('PC-PTSD-5', () => {
  const group = load('pc-ptsd-5');
  const total = exprOf(group, 'pcptsd5-total');
  const followUps = [1, 2, 3, 4, 5].map(n => `pcptsd5-q${n}`);
  const qr = (exposure, yesCount, answered = 5) => ({
    resourceType: 'QuestionnaireResponse', status: 'in-progress',
    item: [
      ...(exposure ? [{ linkId: 'pcptsd5-exposure', answer: [{ valueCoding: { system: 'http://loinc.org', code: exposure } }] }] : []),
      ...followUps.slice(0, answered).map((linkId, k) => ({ linkId, answer: [{ valueCoding: { system: 'http://loinc.org', code: 'x', extension: [{ url: ORD, valueDecimal: k < yesCount ? 1 : 0 }] } }] })),
    ],
  });

  it('scores 0 without asking the follow-ups when no traumatic event is reported', () => {
    expect(evalIn(qr('LA32-8', 0, 0), total)).toEqual([0]);
  });
  it('ignores stale follow-up answers when the event is then answered No', () => {
    expect(evalIn(qr('LA32-8', 5), total)).toEqual([0]);
  });
  it('counts the Yes answers once an event is reported', () => {
    expect(evalIn(qr('LA33-6', 0), total)).toEqual([0]);
    expect(evalIn(qr('LA33-6', 3), total)).toEqual([3]);
    expect(evalIn(qr('LA33-6', 5), total)).toEqual([5]);
  });
  it('gives no score while a follow-up is unanswered or the event question is blank', () => {
    expect(evalIn(qr('LA33-6', 2, 4), total)).toEqual([]);
    expect(evalIn(qr(null, 0, 0), total)).toEqual([]);
  });
  it.each([[0, 'Negative screen'], [3, 'Negative screen'], [4, 'Positive screen — further assessment recommended'], [5, 'Positive screen — further assessment recommended']])('score %i is "%s"', (score, label) => {
    expect(evalIn(withTotal({ resourceType: 'QuestionnaireResponse', item: [] }, 'pcptsd5-total', score), exprOf(group, 'pcptsd5-result'))).toEqual([label]);
  });
  it('asks the follow-ups only after an event is reported', () => {
    const asked = [];
    walk(group.item, i => { if (i.enableWhen) asked.push(i.linkId); });
    expect(asked).toEqual(['pcptsd5-leadin', ...followUps]);
    walk(group.item, i => { if (i.enableWhen) expect(i.enableWhen[0]).toMatchObject({ question: 'pcptsd5-exposure', operator: '=', answerCoding: { code: 'LA33-6' } }); });
  });
});

describe('published option scores', () => {
  const scores = (group, linkId) => {
    let out;
    walk(group.item, i => { if (i.linkId === linkId) out = i.answerOption.map(o => o.extension.find(e => e.url === ORD).valueDecimal); });
    return out;
  };
  it('Glasgow Coma Scale: eye 1–4, verbal 1–5, motor 1–6', () => {
    const g = load('glasgow-coma-scale');
    expect(scores(g, 'gcs-eye')).toEqual([1, 2, 3, 4]);
    expect(scores(g, 'gcs-verbal')).toEqual([1, 2, 3, 4, 5]);
    expect(scores(g, 'gcs-motor')).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it('GDS-15: No scores on questions 1, 5, 7, 11 and 13, Yes on all the others', () => {
    const g = load('gds-15');
    const noKeyed = [1, 5, 7, 11, 13];
    for (let n = 1; n <= 15; n++) {
      const yes = noKeyed.includes(n) ? 0 : 1;
      let item; walk(g.item, i => { if (i.linkId === `gds15-q${n}`) item = i; });
      expect(item.answerOption.map(o => [o.valueCoding.display, o.extension.find(e => e.url === ORD).valueDecimal]), `q${n}`).toEqual([['Yes', yes], ['No', 1 - yes]]);
    }
  });
  it.each(['apgar1', 'apgar5'])('Apgar %s: every criterion scores 0, 1 or 2', p => {
    const g = load('apgar-score');
    for (const k of ['color', 'heart-rate', 'tone', 'reflex', 'respiration']) expect(scores(g, `${p}-${k}`)).toEqual([0, 1, 2]);
  });
});

describe('inserting a template into a questionnaire that already has its ids', () => {
  it.each(SCORED)('%s: renamed copy calculates from its own answers, no old id left in expressions', id => {
    const group = load(id);
    const old = collectLinkIds(group);
    const { remapped, idMap } = remapSubtree(group, old, 'suffix');
    const renamed = new Set(collectLinkIds(remapped));
    walk(remapped.item, i => {
      const ext = i.extension?.find(x => x.url === CALC);
      if (!ext) return;
      const refs = linkIdRefsIn(ext.valueExpression.expression);
      for (const r of refs.filter(r => old.includes(r))) expect.fail(`${i.linkId} still references original id ${r}`);
      expect(refs.every(r => renamed.has(r))).toBe(true);
    });
    const answerable = g => { const ids = []; walk(g.item, i => { if (i.type === 'choice' && i.required) ids.push(i.linkId); }); return ids; };
    const totals = [];
    walk(group.item, i => { if (/-total$/.test(i.linkId)) totals.push(i.linkId); });
    expect(totals.length).toBeGreaterThan(0);
    for (const t of totals) {
      const expected = evalIn(qrFor(group, answerable(group), () => 1), exprOf(group, t));
      expect(expected).toHaveLength(1);
      expect(evalIn(qrFor(remapped, answerable(remapped), () => 1), exprOf(remapped, idMap.get(t)))).toEqual(expected);
    }
  });
});

describe('enableWhen in intake fragments survives a rename', () => {
  it.each([['allergies', 'allergy-none', 'allergy-entry'], ['medications', 'meds-none', 'meds-entry']])('%s', (id, noneId, entryId) => {
    const group = load(id);
    const { remapped, idMap } = remapSubtree(group, collectLinkIds(group), 'suffix');
    let entry;
    walk(remapped.item, i => { if (i.linkId === idMap.get(entryId)) entry = i; });
    expect(idMap.get(noneId)).not.toBe(noneId);
    expect(entry.enableWhen[0].question).toBe(idMap.get(noneId));
  });
});
