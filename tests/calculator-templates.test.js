import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import fhirpath from 'fhirpath';
import fhirpath_r4_model from 'fhirpath/fhir-context/r4/index.js';
import { DEFS, calculatorFiles } from '../scripts/calculator-templates.mjs';
import { templateGroupFrom } from '../js/fhir/templates.js';
import { remapSubtree, collectLinkIds } from '../js/fhir/linkid-remap.js';

const DIR = path.resolve('templates');
const CALC = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-calculatedExpression';
const readJson = f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
const library = readJson('library.json');

// Answers per question key, and the value each output should show (computed by hand from the published formulas).
const CASES = {
  'body-measurements': {
    answers: { height: 175, weight: 70, sex: 'LA2-8', waist: 80, hip: 100 },
    expect: { bmi: [22.9], 'bmi-category': ['Normal weight'], bsa: [1.84], ibw: [70.5], whr: [0.8] },
  },
  'kidney-function': {
    answers: { age: 50, sex: 'LA2-8', weight: 72, creatinine: 1.0 },
    expect: { egfr: [92], crcl: [90] },
  },
  'cardiac-measurements': {
    answers: { sbp: 120, dbp: 80, qt: 400, hr: 75 },
    expect: { map: [93.3], 'qtc-bazett': [447], 'qtc-fridericia': [431] },
  },
  'lipid-panel': {
    answers: { tc: 200, hdl: 50, tg: 150 },
    expect: { ldl: [120] },
  },
  'chemistry-calculations': {
    answers: { na: 140, cl: 104, hco3: 24, ca: 8, alb: 3, glucose: 90, insulin: 10 },
    expect: { 'anion-gap': [12], 'corrected-ca': [8.8], 'homa-ir': [2.22] },
  },
  fib4: {
    answers: { age: 50, ast: 40, alt: 40, plt: 200 },
    expect: { index: [1.58], category: ['Indeterminate (1.3–2.67)'] },
  },
  qsofa: {
    answers: { resp: true, mentation: false, sbp: true },
    expect: { score: [2], risk: ['High risk'] },
  },
  'cha2ds2-vasc': {
    answers: { chf: true, htn: true, age: 80, diabetes: false, stroke: true, vascular: false, female: true },
    expect: { score: [7] },
  },
  'charlson-comorbidity-index': {
    answers: { mi: true, chf: true, renal: true, liver: 'severe', age: 65 },
    expect: { index: [9] },
  },
  'pregnancy-dating': {
    answers: { lmp: '2026-01-01', visit: '2026-03-12' },
    expect: { edd: ['2026-10-08'], ga: [10] },
  },
};

const VALUE_KEY = { decimal: 'valueDecimal', integer: 'valueInteger', date: 'valueDate', boolean: 'valueBoolean' };
const answerFor = (def, key, v) => {
  const type = def.questions.find(q => q[0] === key)[2];
  return type === 'radio' ? { valueCoding: { code: v } } : { [VALUE_KEY[type]]: v };
};

// Nested QuestionnaireResponse for the template's own ids: the group holds one answered item per question.
function qrFor(def, answers, idOf = id => id) {
  return {
    resourceType: 'QuestionnaireResponse', status: 'in-progress',
    item: [{ linkId: idOf(def.group), item: Object.entries(answers).map(([key, v]) => ({ linkId: idOf(`${def.group}-${key}`), answer: [answerFor(def, key, v)] })) }],
  };
}
const outputsOf = (group, def, qr, idOf = id => id) => Object.fromEntries(def.outputs.map(o => {
  const item = group.item.find(i => i.linkId === idOf(`${def.group}-${o.key}`));
  const expr = item.extension.find(e => e.url === CALC).valueExpression.expression;
  return [o.key, fhirpath.evaluate(qr, expr, { resource: qr }, fhirpath_r4_model).map(String)];
}));
const asStrings = obj => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v.map(String)]));

describe('calculator templates are generated from the gallery', () => {
  it.each(calculatorFiles())('$file and its library entry are up to date (run `npm run docs:templates`)', ({ file, template, entry }) => {
    expect(readJson(file)).toEqual(template);
    expect(library.find(e => e.id === entry.id)).toEqual(entry);
  });
});

describe.each(DEFS)('calculator template $id', def => {
  const group = templateGroupFrom(readJson(`${def.id}.template.json`));
  const { answers, expect: expected } = CASES[def.id];

  it('has a case for every output', () => {
    expect(Object.keys(expected).sort()).toEqual(def.outputs.map(o => o.key).sort());
  });

  it('calculates every result from its own answers', () => {
    expect(outputsOf(group, def, qrFor(def, answers))).toEqual(asStrings(expected));
  });

  it('shows no results until the inputs are answered', () => {
    const empty = qrFor(def, {});
    for (const v of Object.values(outputsOf(group, def, empty))) expect(v).toEqual([]);
  });

  it('keeps calculating correctly after the ids are renamed on a collision', () => {
    const { remapped, idMap } = remapSubtree(group, collectLinkIds(group), 'suffix');
    const idOf = id => idMap.get(id);
    expect(outputsOf(remapped, def, qrFor(def, answers, idOf), idOf)).toEqual(asStrings(expected));
  });
});

describe('calculator templates: specific edge cases', () => {
  const lipid = DEFS.find(d => d.id === 'lipid-panel');
  const lipidGroup = templateGroupFrom(readJson('lipid-panel.template.json'));
  it('LDL stays empty at triglycerides of 400 or more', () => {
    expect(outputsOf(lipidGroup, lipid, qrFor(lipid, { tc: 250, hdl: 40, tg: 400 })).ldl).toEqual([]);
  });

  const body = DEFS.find(d => d.id === 'body-measurements');
  const bodyGroup = templateGroupFrom(readJson('body-measurements.template.json'));
  it('ideal body weight uses the female branch for the female answer code', () => {
    const out = outputsOf(bodyGroup, body, qrFor(body, { height: 175, sex: 'LA3-6' }));
    expect(out.ibw).toEqual(['66']);
  });
  it('ideal body weight stays empty without sex', () => {
    expect(outputsOf(bodyGroup, body, qrFor(body, { height: 175 })).ibw).toEqual([]);
  });
});

describe('calculator templates: more branches', () => {
  const run = (id, answers) => {
    const def = DEFS.find(d => d.id === id);
    const group = templateGroupFrom(readJson(`${id}.template.json`));
    return outputsOf(group, def, qrFor(def, answers));
  };

  it('eGFR and Cockcroft–Gault use the female branch (low and normal creatinine)', () => {
    expect(run('kidney-function', { age: 50, sex: 'LA3-6', weight: 70, creatinine: 0.6 }).egfr).toEqual(['109']);
    expect(run('kidney-function', { age: 50, sex: 'LA3-6', weight: 70, creatinine: 1.0 })).toMatchObject({ egfr: ['69'], crcl: ['74'] });
  });
  it('eGFR in a high-creatinine male', () => {
    expect(run('kidney-function', { age: 70, sex: 'LA2-8', weight: 70, creatinine: 2.0 }).egfr).toEqual(['35']);
  });
  it.each([
    [50, 'Underweight', '16.3'], [85, 'Overweight', '27.8'], [100, 'Obese', '32.7'],
  ])('BMI category for %i kg at 175 cm is %s', (weight, label, bmi) => {
    expect(run('body-measurements', { height: 175, weight })).toMatchObject({ 'bmi-category': [label], bmi: [bmi] });
  });
  it.each([
    [{ age: 30, ast: 20, alt: 20, plt: 300 }, '0.45', 'Low risk (< 1.3)'],
    [{ age: 70, ast: 80, alt: 40, plt: 120 }, '7.38', 'High risk (> 2.67)'],
  ])('FIB-4 %j', (answers, index, category) => {
    expect(run('fib4', answers)).toEqual({ index: [index], category: [category] });
  });
  it.each([
    [{ resp: false }, '0', 'Lower risk'],
    [{ resp: true, mentation: true }, '2', 'High risk'],
  ])('qSOFA %j (unanswered criteria count as No)', (answers, score, risk) => {
    expect(run('qsofa', answers)).toEqual({ score: [score], risk: [risk] });
  });
  it.each([[60, '0'], [64, '0'], [65, '1'], [74, '1'], [75, '2'], [90, '2']])('CHA₂DS₂-VASc age %i alone scores %s (the two age bands cannot add up)', (age, score) => {
    expect(run('cha2ds2-vasc', { age })).toEqual({ score: [score] });
  });
  it('CHA₂DS₂-VASc adds 2 points for previous stroke and 1 for each other criterion', () => {
    expect(run('cha2ds2-vasc', { age: 50, stroke: true })).toEqual({ score: ['2'] });
    expect(run('cha2ds2-vasc', { age: 70, chf: true, htn: true, diabetes: true, vascular: true, female: true })).toEqual({ score: ['6'] });
  });
  it('CHA₂DS₂-VASc waits for the age', () => {
    expect(run('cha2ds2-vasc', { chf: true })).toEqual({ score: [] });
  });
  it.each([[45, '1'], [49, '1'], [50, '2'], [59, '2'], [60, '3'], [69, '3'], [70, '4'], [79, '4'], [80, '5'], [95, '5']])('Charlson age %i with one point of comorbidity gives %s', (age, index) => {
    expect(run('charlson-comorbidity-index', { mi: true, age })).toEqual({ index: [index] });
  });
  it.each([
    [{ liver: 'mild' }, '1'], [{ liver: 'severe' }, '3'], [{ liver: 'none' }, '0'],
    [{ diabetes: 'uncomplicated' }, '1'], [{ diabetes: 'end-organ' }, '2'],
    [{ tumor: 'localized' }, '2'], [{ tumor: 'metastatic' }, '6'],
  ])('Charlson tiered answer %j scores %s under 50 (a tier is one choice, not two additive boxes)', (answers, index) => {
    expect(run('charlson-comorbidity-index', { ...answers, age: 40 })).toEqual({ index: [index] });
  });
  it('Charlson needs the age, and weights AIDS and leukemia', () => {
    expect(run('charlson-comorbidity-index', { mi: true })).toEqual({ index: [] });
    expect(run('charlson-comorbidity-index', { tumor: 'metastatic', aids: true, leukemia: true, age: 40 })).toEqual({ index: ['14'] });
  });
  it('results stay empty while an input is missing', () => {
    expect(run('kidney-function', { age: 50, weight: 72, creatinine: 1 })).toEqual({ egfr: [], crcl: [] });
    expect(run('lipid-panel', { tc: 200 })).toEqual({ ldl: [] });
    expect(run('pregnancy-dating', { lmp: '2026-01-01' })).toMatchObject({ edd: ['2026-10-08'], ga: [] });
  });
});

describe('calculator templates: units match the transforms used', () => {
  const UCUM = { kg: 'kg', cm: 'cm', mgdl: 'mg/dL', gdl: 'g/dL' };
  it.each(DEFS)('$id', def => {
    for (const out of def.outputs) {
      for (const [, spec] of Object.entries(out.slots)) {
        const [key, transformId] = Array.isArray(spec) ? spec : [];
        if (!UCUM[transformId]) continue;
        const question = def.questions.find(q => q[0] === key);
        expect(question[3].unit[0], `${out.key} <- ${key}`).toBe(UCUM[transformId]);
      }
    }
  });
});
