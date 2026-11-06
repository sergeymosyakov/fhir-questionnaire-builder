// Builds the calculator templates (templates/*.template.json + their library.json entries); formulas come from the Expression Gallery.
import { itemRef } from '../js/fhir/expr-builder/model.js';
import { emit } from '../js/fhir/expr-builder/emit.js';
import { valueAccessor } from '../js/fhir/expr-builder/value-paths.js';
import { EXPR_GALLERY, resolveGalleryPattern } from '../js/fhir/expr-builder/gallery/index.js';

const CALC = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-calculatedExpression';
const UNIT = 'http://hl7.org/fhir/StructureDefinition/questionnaire-unit';
const ITEM_CONTROL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl';
const SEX = { code: '76689-9', answers: [['LA3-6', 'Female'], ['LA2-8', 'Male']], female: 'LA3-6' };
const LICENSE = 'Original wording written for this builder; covered by the project license (non-commercial use with attribution; commercial use needs written permission). Formulas are published methods; see the source.';
const LICENSE_URL = 'https://github.com/sergeymosyakov/fhir-questionnaire-builder/blob/master/LICENSE';

// out.round wraps a pattern that has no rounding of its own.
// q: [key, text, builder type, {code, unit: [ucum, display]}]; out: slots map slot -> [question key, transform id].
const num = (key, text, type, code, unit) => [key, text, type, { code, unit }];
export const DEFS = [
  {
    id: 'body-measurements', group: 'body', name: 'Body Measurements',
    description: 'Height, weight, sex and waist/hip with BMI (and its WHO category), body surface area, ideal body weight and waist-to-hip ratio.',
    keywords: ['bmi', 'body mass index', 'height', 'weight', 'body surface area', 'waist', 'hip', 'anthropometrics'],
    questions: [
      num('height', 'Height (cm)', 'decimal', '8302-2', ['cm', 'cm']),
      num('weight', 'Weight (kg)', 'decimal', '29463-7', ['kg', 'kg']),
      ['sex', 'Sex assigned at birth (used by the ideal body weight formula)', 'radio', { code: SEX.code, sex: true }],
      num('waist', 'Waist circumference (cm)', 'decimal', null, ['cm', 'cm']),
      num('hip', 'Hip circumference (cm)', 'decimal', null, ['cm', 'cm']),
    ],
    outputs: [
      { key: 'bmi', text: 'Body mass index (kg/m²)', type: 'decimal', code: '39156-5', unit: ['kg/m2', 'kg/m²'], pattern: 'bmi', slots: { weight: ['weight', 'kg'], height: ['height', 'cm'] } },
      { key: 'bmi-category', text: 'BMI category (WHO)', type: 'string', pattern: 'bmi-category', slots: { weight: ['weight', 'kg'], height: ['height', 'cm'] } },
      { key: 'bsa', text: 'Body surface area (m², Mosteller)', type: 'decimal', code: '8277-6', unit: ['m2', 'm²'], pattern: 'bsa-mosteller', slots: { height: ['height', 'cm'], weight: ['weight', 'kg'] } },
      { key: 'ibw', text: 'Ideal body weight (kg, Devine)', type: 'decimal', unit: ['kg', 'kg'], pattern: 'ideal-body-weight', slots: { height: ['height', 'cm'], sex: ['sex'] } },
      { key: 'whr', text: 'Waist-to-hip ratio', type: 'decimal', pattern: 'waist-hip-ratio', slots: { waist: ['waist'], hip: ['hip'] } },
    ],
  },
  {
    id: 'kidney-function', group: 'kidney', name: 'Kidney Function',
    description: 'Creatinine, age, sex and weight with eGFR (CKD-EPI 2021) and creatinine clearance (Cockcroft–Gault).',
    keywords: ['kidney', 'renal', 'egfr', 'creatinine', 'clearance', 'ckd', 'nephrology'],
    questions: [
      num('age', 'Age (years)', 'integer', '30525-0', ['a', 'years']),
      ['sex', 'Sex assigned at birth (used by both formulas)', 'radio', { code: SEX.code, sex: true }],
      num('weight', 'Weight (kg)', 'decimal', '29463-7', ['kg', 'kg']),
      num('creatinine', 'Serum creatinine (mg/dL)', 'decimal', '2160-0', ['mg/dL', 'mg/dL']),
    ],
    outputs: [
      { key: 'egfr', text: 'eGFR (mL/min/1.73 m², CKD-EPI 2021)', type: 'decimal', code: '98979-8', pattern: 'egfr-ckd-epi-2021', slots: { scr: ['creatinine', 'mgdl'], age: ['age'], sex: ['sex'] } },
      { key: 'crcl', text: 'Creatinine clearance (mL/min, Cockcroft–Gault)', type: 'decimal', code: '35591-7', pattern: 'cockcroft-gault', slots: { age: ['age'], weight: ['weight', 'kg'], scr: ['creatinine', 'mgdl'], sex: ['sex'] } },
    ],
  },
  {
    id: 'cardiac-measurements', group: 'cardiac', name: 'Cardiac Measurements',
    description: 'Blood pressure, QT interval and heart rate with mean arterial pressure and corrected QT (Bazett and Fridericia).',
    keywords: ['blood pressure', 'map', 'qtc', 'qt', 'ecg', 'heart rate', 'cardiology'],
    questions: [
      num('sbp', 'Systolic blood pressure (mmHg)', 'decimal', '8480-6', ['mm[Hg]', 'mmHg']),
      num('dbp', 'Diastolic blood pressure (mmHg)', 'decimal', '8462-4', ['mm[Hg]', 'mmHg']),
      num('qt', 'QT interval (ms)', 'decimal', '8634-8', ['ms', 'ms']),
      num('hr', 'Heart rate (beats per minute)', 'decimal', '8867-4', ['/min', '/min']),
    ],
    outputs: [
      { key: 'map', text: 'Mean arterial pressure (mmHg)', type: 'decimal', code: '8478-0', pattern: 'mean-arterial-pressure', slots: { sbp: ['sbp'], dbp: ['dbp'] } },
      { key: 'qtc-bazett', text: 'QTc, Bazett (ms)', type: 'decimal', pattern: 'qtc-bazett', slots: { qt: ['qt'], hr: ['hr'] } },
      { key: 'qtc-fridericia', text: 'QTc, Fridericia (ms)', type: 'decimal', pattern: 'qtc-fridericia', slots: { qt: ['qt'], hr: ['hr'] } },
    ],
  },
  {
    id: 'lipid-panel', group: 'lipid', name: 'Lipid Panel',
    description: 'Total cholesterol, HDL and triglycerides with calculated LDL cholesterol (Friedewald).',
    keywords: ['lipid', 'cholesterol', 'ldl', 'hdl', 'triglycerides', 'cardiology'],
    questions: [
      num('tc', 'Total cholesterol (mg/dL)', 'decimal', '2093-3', ['mg/dL', 'mg/dL']),
      num('hdl', 'HDL cholesterol (mg/dL)', 'decimal', '2085-9', ['mg/dL', 'mg/dL']),
      num('tg', 'Triglycerides (mg/dL)', 'decimal', '2571-8', ['mg/dL', 'mg/dL']),
    ],
    outputs: [
      { key: 'ldl', text: 'LDL cholesterol, calculated (mg/dL; blank when triglycerides are 400 or more)', type: 'decimal', code: '13457-7', pattern: 'ldl-friedewald', slots: { tc: ['tc', 'mgdl'], hdl: ['hdl', 'mgdl'], tg: ['tg', 'mgdl'] } },
    ],
  },
  {
    id: 'chemistry-calculations', group: 'chem', name: 'Chemistry Calculations',
    description: 'Electrolytes, calcium, albumin, glucose and insulin with anion gap, albumin-corrected calcium and HOMA-IR.',
    keywords: ['anion gap', 'calcium', 'albumin', 'homa', 'insulin resistance', 'electrolytes', 'laboratory'],
    questions: [
      num('na', 'Sodium (mmol/L)', 'decimal', '2951-2', ['mmol/L', 'mmol/L']),
      num('cl', 'Chloride (mmol/L)', 'decimal', '2075-0', ['mmol/L', 'mmol/L']),
      num('hco3', 'Bicarbonate (mmol/L)', 'decimal', '1963-8', ['mmol/L', 'mmol/L']),
      num('ca', 'Total calcium (mg/dL)', 'decimal', '17861-6', ['mg/dL', 'mg/dL']),
      num('alb', 'Albumin (g/dL)', 'decimal', '1751-7', ['g/dL', 'g/dL']),
      num('glucose', 'Fasting glucose (mg/dL)', 'decimal', '1558-6', ['mg/dL', 'mg/dL']),
      num('insulin', 'Fasting insulin (µU/mL)', 'decimal', '20448-7', ['u[IU]/mL', 'µU/mL']),
    ],
    outputs: [
      { key: 'anion-gap', text: 'Anion gap (mmol/L)', type: 'decimal', code: '33037-3', pattern: 'anion-gap', slots: { na: ['na'], cl: ['cl'], hco3: ['hco3'] } },
      { key: 'corrected-ca', text: 'Albumin-corrected calcium (mg/dL)', type: 'decimal', pattern: 'corrected-calcium', slots: { ca: ['ca', 'mgdl'], alb: ['alb', 'gdl'] } },
      { key: 'homa-ir', text: 'HOMA-IR', type: 'decimal', pattern: 'homa-ir', slots: { glucose: ['glucose', 'mgdl'], insulin: ['insulin'] } },
    ],
  },
  {
    id: 'fib4', group: 'fib4', name: 'FIB-4 Liver Fibrosis Index',
    description: 'Age, AST, ALT and platelets with the FIB-4 index and its fibrosis-risk category.',
    keywords: ['fib-4', 'fib4', 'liver', 'fibrosis', 'hepatology', 'ast', 'alt', 'platelets'],
    questions: [
      num('age', 'Age (years)', 'integer', '30525-0', ['a', 'years']),
      num('ast', 'AST (U/L)', 'decimal', '1920-8', ['U/L', 'U/L']),
      num('alt', 'ALT (U/L)', 'decimal', '1742-6', ['U/L', 'U/L']),
      num('plt', 'Platelets (×10⁹/L)', 'decimal', '777-3', ['10*9/L', '×10⁹/L']),
    ],
    outputs: [
      { key: 'index', text: 'FIB-4 index', type: 'decimal', pattern: 'fib4', noCategories: true, round: 2, slots: { age: ['age'], ast: ['ast'], alt: ['alt'], plt: ['plt'] } },
      { key: 'category', text: 'FIB-4 category', type: 'string', pattern: 'fib4', slots: { age: ['age'], ast: ['ast'], alt: ['alt'], plt: ['plt'] } },
    ],
  },
  {
    id: 'pregnancy-dating', group: 'preg', name: 'Pregnancy Dating',
    description: 'Last menstrual period and visit date with the expected delivery date (Naegele) and gestational age in weeks.',
    keywords: ['pregnancy', 'gestational age', 'due date', 'edd', 'lmp', 'obstetrics', 'prenatal'],
    questions: [
      ['lmp', 'First day of last menstrual period', 'date', { code: '8665-2' }],
      ['visit', 'Visit date', 'date', {}],
    ],
    outputs: [
      { key: 'edd', text: 'Expected delivery date', type: 'date', code: '11778-8', pattern: 'due-date-naegele', slots: { lmp: ['lmp'] } },
      { key: 'ga', text: 'Gestational age (completed weeks)', type: 'integer', code: '11884-4', pattern: 'gestational-age-weeks', slots: { lmp: ['lmp'], at: ['visit'] } },
    ],
  },
];

const BUILDER_TYPE = { radio: 'radio', decimal: 'decimal', integer: 'integer', date: 'date' };
const loinc = code => [{ system: 'http://loinc.org', code }];
const unitExt = ([code, display]) => ({ url: UNIT, valueCoding: { system: 'http://unitsofmeasure.org', code, display } });
const calcExt = expression => ({ url: CALC, valueExpression: { language: 'text/fhirpath', expression } });

function questionItem(def, [key, text, type, opts]) {
  const item = { linkId: `${def.group}-${key}`, ...(opts.code ? { code: loinc(opts.code) } : {}), text };
  if (opts.sex) {
    return {
      ...item, type: 'choice',
      extension: [{ url: ITEM_CONTROL, valueCodeableConcept: { coding: [{ system: 'http://hl7.org/fhir/questionnaire-item-control', code: 'radio-button' }] } }],
      answerOption: SEX.answers.map(([code, display]) => ({ valueCoding: { system: 'http://loinc.org', code, display } })),
    };
  }
  return { ...item, type, ...(opts.unit ? { extension: [unitExt(opts.unit)] } : {}) };
}

function outputItem(def, out) {
  const typeOf = key => def.questions.find(q => q[0] === key)[2];
  const refOf = key => emit(itemRef([def.group, `${def.group}-${key}`], valueAccessor(BUILDER_TYPE[typeOf(key)]), []));
  const base = EXPR_GALLERY.find(p => p.id === out.pattern);
  const pattern = out.noCategories ? { ...base, categories: undefined } : base;
  const selections = Object.fromEntries(Object.entries(out.slots).map(([slot, [key, transformId]]) => [slot, { ref: refOf(key), transformId }]));
  const resolved = resolveGalleryPattern(pattern, selections, { female: SEX.female });
  const expression = out.round ? `(${resolved}).round(${out.round})` : resolved;
  return {
    linkId: `${def.group}-${out.key}`, ...(out.code ? { code: loinc(out.code) } : {}), text: out.text, type: out.type, readOnly: true,
    extension: [...(out.unit ? [unitExt(out.unit)] : []), calcExt(expression)],
  };
}

export function buildTemplate(def) {
  return {
    resourceType: 'Questionnaire', status: 'active',
    item: [{ linkId: def.group, text: def.name, type: 'group', item: [...def.questions.map(q => questionItem(def, q)), ...def.outputs.map(o => outputItem(def, o))] }],
  };
}

export function libraryEntry(def) {
  const sources = [...new Set(def.outputs.map(o => EXPR_GALLERY.find(p => p.id === o.pattern).source))];
  return {
    id: def.id, name: def.name, description: def.description, category: 'calculators',
    scoring: 'Calculated values only; each result stays empty until all of its inputs are answered.',
    keywords: def.keywords,
    source: `${sources.join('; ')}. Codes: LOINC.`,
    license: LICENSE, licenseUrl: LICENSE_URL, file: `${def.id}.template.json`,
  };
}

export const calculatorFiles = () => DEFS.map(def => ({ file: `${def.id}.template.json`, template: buildTemplate(def), entry: libraryEntry(def) }));
