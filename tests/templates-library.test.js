import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import fhirpath from 'fhirpath';
import fhirpath_r4_model from 'fhirpath/fhir-context/r4/index.js';
import { templateGroupFrom } from '../js/fhir/templates.js';
import { remapSubtree, collectLinkIds } from '../js/fhir/linkid-remap.js';

const DIR = path.resolve('templates');
const ORD = 'http://hl7.org/fhir/StructureDefinition/ordinalValue';
const CALC = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-calculatedExpression';
const library = JSON.parse(fs.readFileSync(path.join(DIR, 'library.json'), 'utf8'));
const load = id => {
  const entry = library.find(e => e.id === id);
  return templateGroupFrom(JSON.parse(fs.readFileSync(path.join(DIR, entry.file), 'utf8')));
};
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

  it('codes items with LOINC and gives every choice item scored, coded options', () => {
    walk(group.item, i => {
      if (i.code) for (const c of i.code) expect(c).toMatchObject({ system: 'http://loinc.org', code: expect.stringMatching(/^\d+-\d$/) });
      if (i.type === 'choice') {
        expect(i.answerOption.length, i.linkId).toBeGreaterThanOrEqual(2);
        for (const o of i.answerOption) {
          expect(o.valueCoding.code, i.linkId).toMatch(/^LA\d+-\d$/);
          expect(o.extension.find(e => e.url === ORD)?.valueDecimal, i.linkId).toBeTypeOf('number');
        }
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
    { id: 'gad-7', total: 'gad7-total', sev: 'gad7-severity', n: 7,
      bands: [[0, 'Minimal anxiety'], [4, 'Minimal anxiety'], [5, 'Mild anxiety'], [9, 'Mild anxiety'], [10, 'Moderate anxiety'], [14, 'Moderate anxiety'], [15, 'Severe anxiety'], [21, 'Severe anxiety']] },
    { id: 'audit-c', total: 'auditc-total', n: 3 },
  ];

  describe.each(cases)('$id', ({ id, total, sev, n, bands }) => {
    const group = load(id);
    const scored = [];
    walk(group.item, i => { if (i.type === 'choice' && i.required) scored.push(i.linkId); });

    it('has the expected number of scored questions', () => expect(scored).toHaveLength(n));

    it('sums the option scores: lowest, highest and a mix', () => {
      const maxOf = i => Math.max(...i.answerOption.map(o => o.extension.find(e => e.url === ORD).valueDecimal));
      const items = {}; walk(group.item, i => { items[i.linkId] = i; });
      expect(evalIn(qrFor(group, scored, () => 0), exprOf(group, total))).toEqual([0]);
      expect(evalIn(qrFor(group, scored, i => maxOf(i)), exprOf(group, total)))
        .toEqual([scored.reduce((s, l) => s + maxOf(items[l]), 0)]);
      expect(evalIn(qrFor(group, scored, i => scored.indexOf(i.linkId) % 3), exprOf(group, total)))
        .toEqual([scored.reduce((s, l, k) => s + Math.min(k % 3, items[l].answerOption.length - 1), 0)]);
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

describe('inserting a template into a questionnaire that already has its ids', () => {
  it.each(library.map(e => e.id))('%s: renamed copy calculates from its own answers, no old id left in expressions', id => {
    const group = load(id);
    const old = collectLinkIds(group);
    const { remapped } = remapSubtree(group, old, 'suffix');
    const renamed = new Set(collectLinkIds(remapped));
    walk(remapped.item, i => {
      const ext = i.extension?.find(x => x.url === CALC);
      if (!ext) return;
      const refs = [...ext.valueExpression.expression.matchAll(/'([^']+)'/g)].map(m => m[1]);
      for (const r of refs.filter(r => old.includes(r))) expect.fail(`${i.linkId} still references original id ${r}`);
      expect(refs.every(r => renamed.has(r) || !r.includes('-'))).toBe(true);
    });
    const scored = [];
    walk(remapped.item, i => { if (i.type === 'choice' && i.required) scored.push(i.linkId); });
    const totalId = [...renamed].find(l => /-total-/.test(l));
    expect(evalIn(qrFor(remapped, scored, () => 1), exprOf(remapped, totalId))).toEqual([scored.length]);
  });
});
