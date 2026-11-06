import { describe, it, expect, vi, afterEach } from 'vitest';
import fhirpath from 'fhirpath';
import fhirpath_r4_model from 'fhirpath/fhir-context/r4/index.js';
import { EXPR_GALLERY, resolveGalleryPattern } from '../js/fhir/expr-builder/gallery/index.js';

function pattern(id) {
  return EXPR_GALLERY.find((p) => p.id === id);
}

describe('resolveGalleryPattern', () => {
  it('returns null when a slot is unfilled', () => {
    expect(resolveGalleryPattern(pattern('bmi'), {})).toBeNull();
    expect(resolveGalleryPattern(pattern('bmi'), { weight: { ref: '%w' } })).toBeNull();
  });

  it('substitutes plain item refs with no transform', () => {
    const expr = resolveGalleryPattern(pattern('bmi'), {
      weight: { ref: '%W', transformId: 'kg' },
      height: { ref: '%H', transformId: 'm' },
    });
    expect(expr).toBe('((%W) / ((%H) * (%H))).round(1)');
  });

  it('applies a per-slot transform before substitution', () => {
    const expr = resolveGalleryPattern(pattern('bmi'), {
      weight: { ref: '%W', transformId: 'lb' },
      height: { ref: '%H', transformId: 'cm' },
    });
    expect(expr).toBe('((%W * 0.453592) / ((%H / 100) * (%H / 100))).round(1)');
  });

  it('standalone unit-convert pattern needs no outer template wrapping beyond the transform', () => {
    const expr = resolveGalleryPattern(pattern('unit-convert'), { value: { ref: '%V', transformId: 'f-c' } });
    expect(expr).toBe('((%V - 32) / 1.8)');
  });

  it('bmi-imperial substitutes plain refs with no transform', () => {
    const expr = resolveGalleryPattern(pattern('bmi-imperial'), {
      weight: { ref: '%W', transformId: 'lb' },
      height: { ref: '%H', transformId: 'in' },
    });
    expect(expr).toBe('(((%W) * 703) / ((%H) * (%H))).round(1)');
  });

  it('applies a threshold-category chain after the template resolves', () => {
    const expr = resolveGalleryPattern(pattern('bmi-category'), {
      weight: { ref: '%W', transformId: 'kg' },
      height: { ref: '%H', transformId: 'm' },
    });
    expect(expr).toBe(
      "iif(((%W) / ((%H) * (%H))).exists(), " +
      "iif(((%W) / ((%H) * (%H))) < 18.5, 'Underweight', " +
      "iif(((%W) / ((%H) * (%H))) < 25, 'Normal weight', " +
      "iif(((%W) / ((%H) * (%H))) < 30, 'Overweight', 'Obese'))), {})"
    );
  });

  it('repeatable slot resolves to a summed expression', () => {
    const expr = resolveGalleryPattern(pattern('sum-of-items'), {
      items: [
        { ref: '%A', transformId: 'raw' },
        { ref: '%B', transformId: 'lb-kg' },
      ],
    });
    expect(expr).toBe('((%A) + (%B * 0.453592))');
  });

  it('repeatable slot returns null below its min row count', () => {
    expect(resolveGalleryPattern(pattern('sum-of-items'), { items: [{ ref: '%A' }] })).toBeNull();
    expect(resolveGalleryPattern(pattern('sum-of-items'), { items: [] })).toBeNull();
  });

  it('repeatable slot ignores rows without a picked item', () => {
    const expr = resolveGalleryPattern(pattern('sum-of-items'), {
      items: [{ ref: '%A' }, {}, { ref: '%B' }],
    });
    expect(expr).toBe('((%A) + (%B))');
  });
});

describe('resolveGalleryPattern — resolved expressions are real, correct FHIRPath', () => {
  const qr = {
    resourceType: 'QuestionnaireResponse',
    item: [
      { linkId: 'weight', answer: [{ valueDecimal: 220 }] },       // lb
      { linkId: 'height', answer: [{ valueDecimal: 180 }] },       // cm
      { linkId: 'birthdate', answer: [{ valueDate: '1990-12-25' }] }, // birthday not yet reached this year
    ],
  };
  const env = { resource: qr };
  const ref = (linkId, accessor) => `%resource.item.where(linkId='${linkId}').answer.${accessor}`;

  it('BMI with lb/cm conversion evaluates to a sane value', () => {
    const expr = resolveGalleryPattern(pattern('bmi'), {
      weight: { ref: ref('weight', 'valueDecimal'), transformId: 'lb' },
      height: { ref: ref('height', 'valueDecimal'), transformId: 'cm' },
    });
    const [result] = fhirpath.evaluate(qr, expr, env, fhirpath_r4_model);
    // 220 lb ≈ 99.79 kg, 180 cm = 1.8 m → BMI ≈ 30.8
    expect(result).toBeCloseTo(30.8, 1);
  });

  it('bmi-imperial (lb/in, no conversion) matches the real formula used in bariatric-extended.fhir.json', () => {
    const qrImperial = {
      resourceType: 'QuestionnaireResponse',
      item: [
        { linkId: 'weight', answer: [{ valueDecimal: 200 }] }, // lb
        { linkId: 'height', answer: [{ valueDecimal: 70 }] },  // in
      ],
    };
    const expr = resolveGalleryPattern(pattern('bmi-imperial'), {
      weight: { ref: ref('weight', 'valueDecimal'), transformId: 'lb' },
      height: { ref: ref('height', 'valueDecimal'), transformId: 'in' },
    });
    const [result] = fhirpath.evaluate(qrImperial, expr, { resource: qrImperial }, fhirpath_r4_model);
    expect(result).toBe(28.7);
  });

  it('age-from-birthdate correctly subtracts a year when this-year birthday has not occurred yet', () => {
    // Pin "today" — the template's correctness hinges on Sep 8 being before the Dec 25 birthday.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-08T00:00:00Z'));
    const expr = resolveGalleryPattern(pattern('age-from-birthdate'), {
      birthdate: { ref: ref('birthdate', 'valueDate') },
    });
    const [result] = fhirpath.evaluate(qr, expr, env, fhirpath_r4_model);
    expect(result).toBe(35); // born 1990, birthday Dec 25 not yet reached in Sep 2026
  });

  it('age-from-birthdate counts the year once the birthday has passed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-01-05T00:00:00Z'));
    const expr = resolveGalleryPattern(pattern('age-from-birthdate'), {
      birthdate: { ref: ref('birthdate', 'valueDate') },
    });
    const [result] = fhirpath.evaluate(qr, expr, env, fhirpath_r4_model);
    expect(result).toBe(36); // Dec 25 2026 birthday already passed by Jan 2027
  });

  afterEach(() => { vi.useRealTimers(); });
});

describe('resolveGalleryPattern — bmi-category', () => {
  const cases = [
    { weight: 50, height: 1.8, want: 'Underweight' },  // BMI ≈ 15.4
    { weight: 70, height: 1.8, want: 'Normal weight' }, // BMI ≈ 21.6
    { weight: 85, height: 1.8, want: 'Overweight' },    // BMI ≈ 26.2
    { weight: 110, height: 1.8, want: 'Obese' },        // BMI ≈ 33.9
  ];
  for (const c of cases) {
    it(`categorizes weight=${c.weight}kg height=${c.height}m as ${c.want}`, () => {
      const qr = {
        resourceType: 'QuestionnaireResponse',
        item: [
          { linkId: 'weight', answer: [{ valueDecimal: c.weight }] },
          { linkId: 'height', answer: [{ valueDecimal: c.height }] },
        ],
      };
      const ref = (linkId) => `%resource.item.where(linkId='${linkId}').answer.valueDecimal`;
      const expr = resolveGalleryPattern(pattern('bmi-category'), {
        weight: { ref: ref('weight'), transformId: 'kg' },
        height: { ref: ref('height'), transformId: 'm' },
      });
      const [result] = fhirpath.evaluate(qr, expr, { resource: qr }, fhirpath_r4_model);
      expect(result).toBe(c.want);
    });
  }
});

describe('resolveGalleryPattern — gad7-severity', () => {
  it('sums the 7 items and picks the matching severity band', () => {
    const answers = [2, 1, 2, 1, 1, 1, 1]; // sum = 9 → Mild (5-9)
    const qr = {
      resourceType: 'QuestionnaireResponse',
      item: answers.map((v, i) => ({ linkId: `q${i + 1}`, answer: [{ valueInteger: v }] })),
    };
    const selections = {};
    for (let i = 1; i <= 7; i++) {
      selections[`q${i}`] = { ref: `%resource.item.where(linkId='q${i}').answer.valueInteger` };
    }
    const expr = resolveGalleryPattern(pattern('gad7-severity'), selections);
    const [result] = fhirpath.evaluate(qr, expr, { resource: qr }, fhirpath_r4_model);
    expect(result).toBe('Mild anxiety');
  });
});

describe('resolveGalleryPattern — cha2ds2-vasc', () => {
  it('sums weighted criteria and treats an unanswered item as not present', () => {
    // chf=true(+1), htn=false(+0), age75=true(+2), diabetes/strokeTia/vascular/age65to74 unanswered(+0), female=true(+1)
    const qr = {
      resourceType: 'QuestionnaireResponse',
      item: [
        { linkId: 'chf', answer: [{ valueBoolean: true }] },
        { linkId: 'htn', answer: [{ valueBoolean: false }] },
        { linkId: 'age75', answer: [{ valueBoolean: true }] },
        { linkId: 'female', answer: [{ valueBoolean: true }] },
      ],
    };
    const ref = (linkId) => `%resource.item.where(linkId='${linkId}').answer.valueBoolean`;
    const selections = {
      chf: { ref: ref('chf') },
      htn: { ref: ref('htn') },
      age75: { ref: ref('age75') },
      diabetes: { ref: ref('diabetes') },     // no matching item → resolves to {} at eval time
      strokeTia: { ref: ref('strokeTia') },
      vascular: { ref: ref('vascular') },
      age65to74: { ref: ref('age65to74') },
      female: { ref: ref('female') },
    };
    const expr = resolveGalleryPattern(pattern('cha2ds2-vasc'), selections);
    const [result] = fhirpath.evaluate(qr, expr, { resource: qr }, fhirpath_r4_model);
    expect(result).toBe(4); // 1 (chf) + 0 (htn) + 2 (age75) + 1 (female)
  });
});

describe('resolveGalleryPattern — charlson-comorbidity-index', () => {
  it('sums the picked conditions\u2019 weights plus the age bonus', () => {
    // metastatic malignancy (+6) + renal disease (+2), age 72 (+3 bonus) = 11
    const qr = {
      resourceType: 'QuestionnaireResponse',
      item: [
        { linkId: 'mets', answer: [{ valueBoolean: true }] },
        { linkId: 'renal', answer: [{ valueBoolean: true }] },
        { linkId: 'age', answer: [{ valueInteger: 72 }] },
      ],
    };
    const expr = resolveGalleryPattern(pattern('charlson-comorbidity-index'), {
      conditions: [
        { ref: "%resource.item.where(linkId='mets').answer.valueBoolean", transformId: 'malignancyMets' },
        { ref: "%resource.item.where(linkId='renal').answer.valueBoolean", transformId: 'renal' },
      ],
      age: { ref: "%resource.item.where(linkId='age').answer.valueInteger", transformId: 'age-bonus' },
    });
    const [result] = fhirpath.evaluate(qr, expr, { resource: qr }, fhirpath_r4_model);
    expect(result).toBe(11);
  });

  it('marks the tiers of one condition with a shared group (liver, diabetes, malignancy)', () => {
    const transforms = pattern('charlson-comorbidity-index').slots.find((sl) => sl.key === 'conditions').transforms;
    const groups = {};
    for (const t of transforms.filter((x) => x.group)) (groups[t.group] ||= []).push(t.id);
    expect(groups).toEqual({
      liver: ['liverMild', 'liverSevere'],
      diabetes: ['diabetesControlled', 'diabetesUncontrolled'],
      malignancy: ['malignancyLocal', 'malignancyMets'],
    });
  });

  it('gives no result while the age is unanswered (no +4 from an empty comparison)', () => {
    const qr = { resourceType: 'QuestionnaireResponse', item: [{ linkId: 'mi', answer: [{ valueBoolean: true }] }] };
    const expr = resolveGalleryPattern(pattern('charlson-comorbidity-index'), {
      conditions: [{ ref: "%resource.item.where(linkId='mi').answer.valueBoolean", transformId: 'mi' }],
      age: { ref: "%resource.item.where(linkId='age').answer.valueInteger", transformId: 'age-bonus' },
    });
    expect(fhirpath.evaluate(qr, expr, { resource: qr }, fhirpath_r4_model)).toEqual([]);
  });

  it('resolves with just the required condition row and no age picked yet returns null', () => {
    expect(resolveGalleryPattern(pattern('charlson-comorbidity-index'), {
      conditions: [{ ref: '%X', transformId: 'mi' }],
    })).toBeNull();
  });
});

// ── Patterns added in the second batch — each evaluated against a real QR ─────
describe('resolveGalleryPattern — second-batch patterns evaluate correctly', () => {
  const answers = (map) => ({
    resourceType: 'QuestionnaireResponse',
    item: Object.entries(map).map(([linkId, v]) => ({
      linkId,
      answer: [typeof v === 'boolean' ? { valueBoolean: v } : { valueDecimal: v }],
    })),
  });
  const run = (id, values, picks = {}) => {
    const qr = answers(values);
    const sel = {};
    for (const slot of pattern(id).slots) {
      const mk = (linkId) => ({
        ref: `%resource.item.where(linkId='${linkId}').answer.${typeof values[linkId] === 'boolean' ? 'valueBoolean' : 'valueDecimal'}`,
        transformId: picks[slot.key],
      });
      sel[slot.key] = slot.repeatable ? Object.keys(values).map(mk) : mk(slot.key);
    }
    const expr = resolveGalleryPattern(pattern(id), sel);
    return fhirpath.evaluate(qr, expr, { resource: qr }, fhirpath_r4_model)[0];
  };

  it('count-yes-answers counts only Yes rows (No is 0)', () => {
    expect(run('count-yes-answers', { a: true, b: false, c: true, d: true }, { items: 'yes' })).toBe(3);
  });

  it('percent-change: 80 → 76 is -5.0%; a zero baseline yields no answer', () => {
    expect(run('percent-change', { baseline: 80, current: 76 })).toBe(-5);
    expect(run('percent-change', { baseline: 0, current: 5 })).toBeUndefined();
  });

  it.each([[{ q1: 1, q2: 1 }, 'Negative screen'], [{ q1: 2, q2: 1 }, 'Positive screen']])(
    'phq2-screen %j → %s', (v, want) => { expect(run('phq2-screen', v)).toBe(want); });

  it.each([
    [{ eye: 1, verbal: 1, motor: 1 }, 'Severe (GCS 3–8)'],
    [{ eye: 2, verbal: 3, motor: 4 }, 'Moderate (GCS 9–12)'],
    [{ eye: 4, verbal: 5, motor: 6 }, 'Mild (GCS 13–15)'],
    [{ eye: 3, verbal: 3, motor: 3 }, 'Moderate (GCS 9–12)'],
  ])('glasgow-coma-scale %j → %s', (v, want) => { expect(run('glasgow-coma-scale', v)).toBe(want); });

  it.each([
    [{ appearance: 0, pulse: 1, grimace: 1, activity: 1, respiration: 0 }, 'Low (0–3)'],
    [{ appearance: 1, pulse: 1, grimace: 1, activity: 1, respiration: 1 }, 'Moderately abnormal (4–6)'],
    [{ appearance: 2, pulse: 2, grimace: 1, activity: 2, respiration: 2 }, 'Reassuring (7–10)'],
  ])('apgar-score %j → %s', (v, want) => { expect(run('apgar-score', v)).toBe(want); });

  it('qsofa: 1 criterion is lower risk, 2 is high risk', () => {
    expect(run('qsofa', { resp: true, mentation: false, sbp: false })).toBe('Lower risk');
    expect(run('qsofa', { resp: true, mentation: true, sbp: false })).toBe('High risk');
  });

  it('bsa-mosteller: 175 cm, 70 kg ≈ 1.84 m²; inch/lb conversions give the same body', () => {
    expect(run('bsa-mosteller', { height: 175, weight: 70 })).toBe(1.84);
    expect(run('bsa-mosteller', { height: 68.9, weight: 154.3 }, { height: 'in', weight: 'lb' })).toBe(1.84);
  });

  it('mean-arterial-pressure: 120/80 → 93.3', () => {
    expect(run('mean-arterial-pressure', { sbp: 120, dbp: 80 })).toBe(93.3);
  });

  it('a category pattern gives no result while any input is unanswered', () => {
    const qr = answers({ q1: 2 });
    const ref = (id) => `%resource.item.where(linkId='${id}').answer.valueDecimal`;
    const expr = resolveGalleryPattern(pattern('phq2-screen'), { q1: { ref: ref('q1') }, q2: { ref: ref('q2') } });
    expect(fhirpath.evaluate(qr, expr, { resource: qr }, fhirpath_r4_model)).toEqual([]);
  });

  it('missing booleans count as 0 in qsofa and count-yes-answers', () => {
    const ref = (id) => `%resource.item.where(linkId='${id}').answer.valueBoolean`;
    const qr = answers({ resp: true });
    const sel = { resp: { ref: ref('resp') }, mentation: { ref: ref('mentation') }, sbp: { ref: ref('sbp') } };
    expect(fhirpath.evaluate(qr, resolveGalleryPattern(pattern('qsofa'), sel), { resource: qr }, fhirpath_r4_model)[0]).toBe('Lower risk');
    const cy = resolveGalleryPattern(pattern('count-yes-answers'), { items: [{ ref: ref('resp'), transformId: 'yes' }, { ref: ref('gone'), transformId: 'yes' }] });
    expect(fhirpath.evaluate(qr, cy, { resource: qr }, fhirpath_r4_model)[0]).toBe(1);
  });

  it('anion-gap: Na 140, Cl 104, HCO3 24 → 12', () => {
    expect(run('anion-gap', { na: 140, cl: 104, hco3: 24 })).toBe(12);
  });
});

// ── eGFR (CKD-EPI 2021) and Cockcroft-Gault — checked against an independent JS reference ──
describe('resolveGalleryPattern — renal function patterns', () => {
  const kidneyQr = ({ scr, age, weight, sex }) => ({
    resourceType: 'QuestionnaireResponse',
    item: [
      scr != null && { linkId: 'scr', answer: [{ valueDecimal: scr }] },
      age != null && { linkId: 'age', answer: [{ valueInteger: age }] },
      weight != null && { linkId: 'wt', answer: [{ valueDecimal: weight }] },
      sex != null && { linkId: 'sex', answer: [{ valueCoding: { code: sex } }] },
    ].filter(Boolean),
  });
  const R = (id, acc) => `%resource.item.where(linkId='${id}').answer.${acc}`;
  const evalPattern = (id, values, picks, constants) => {
    const qr = kidneyQr(values);
    const sel = {
      scr: { ref: R('scr', 'valueDecimal'), transformId: picks.scr },
      age: { ref: R('age', 'valueInteger') },
      weight: { ref: R('wt', 'valueDecimal'), transformId: picks.weight },
      sex: { ref: R('sex', 'valueCoding.code') },
    };
    const expr = resolveGalleryPattern(pattern(id), sel, constants);
    return fhirpath.evaluate(qr, expr, { resource: qr }, fhirpath_r4_model)[0];
  };
  const refEgfr = (scr, age, female) => {
    const k = female ? 0.7 : 0.9, a = female ? -0.241 : -0.302, r = scr / k;
    return Math.round(142 * Math.min(r, 1) ** a * Math.max(r, 1) ** -1.2 * 0.9938 ** age * (female ? 1.012 : 1));
  };
  const refCg = (age, kg, scr, female) => Math.round(((140 - age) * kg) / (72 * scr) * (female ? 0.85 : 1));

  it.each([
    [0.9, 60, 'female', true], [1.0, 50, 'male', false], [0.5, 30, 'female', true],
    [1.8, 75, 'male', false], [0.6, 40, 'male', false], [2.4, 82, 'female', true],
  ])('egfr-ckd-epi-2021 Scr %s age %s %s matches the reference formula', (scr, age, sex, female) => {
    expect(evalPattern('egfr-ckd-epi-2021', { scr, age, sex }, { scr: 'mgdl' })).toBe(refEgfr(scr, age, female));
  });

  it('egfr: \u00b5mol/L conversion and a overridden female code give the same answer', () => {
    const want = refEgfr(1, 55, true);
    expect(evalPattern('egfr-ckd-epi-2021', { scr: 88.4, age: 55, sex: 'F' }, { scr: 'umol' }, { female: 'F' })).toBe(want);
    expect(evalPattern('egfr-ckd-epi-2021', { scr: 1, age: 55, sex: 'custom1' }, { scr: 'mgdl' }, { female: ' custom1 ' })).toBe(want);
  });

  it('egfr: without an override only the default code female counts as female', () => {
    expect(evalPattern('egfr-ckd-epi-2021', { scr: 1, age: 55, sex: 'F' }, { scr: 'mgdl' })).toBe(refEgfr(1, 55, false));
  });

  it('egfr gives no result for a zero creatinine instead of Infinity', () => {
    expect(evalPattern('egfr-ckd-epi-2021', { scr: 0, age: 55, sex: 'male' }, { scr: 'mgdl' })).toBeUndefined();
  });

  it.each([{ scr: null }, { age: null }, { sex: null }])('egfr gives no result while an input is unanswered %j', (miss) => {
    const v = { scr: 1, age: 55, sex: 'male', ...miss };
    expect(evalPattern('egfr-ckd-epi-2021', v, { scr: 'mgdl' })).toBeUndefined();
  });

  it.each([[60, 70, 1.0, 'male', false], [72, 55, 0.8, 'female', true], [45, 90, 1.5, 'female', true]])(
    'cockcroft-gault age %s %s kg Scr %s %s matches the reference formula', (age, weight, scr, sex, female) => {
      expect(evalPattern('cockcroft-gault', { scr, age, weight, sex }, { scr: 'mgdl', weight: 'kg' }))
        .toBe(refCg(age, weight, scr, female));
    });

  it('cockcroft-gault: lb and \u00b5mol/L conversions, female override; unanswered sex gives no result', () => {
    expect(evalPattern('cockcroft-gault', { scr: 88.4, age: 60, weight: 154.324, sex: 'M' }, { scr: 'umol', weight: 'lb' }))
      .toBe(refCg(60, 70, 1, false));
    expect(evalPattern('cockcroft-gault', { scr: 1, age: 60, weight: 70, sex: 'F' }, { scr: 'mgdl', weight: 'kg' }, { female: 'F' }))
      .toBe(refCg(60, 70, 1, true));
    expect(evalPattern('cockcroft-gault', { scr: 1, age: 60, weight: 70 }, { scr: 'mgdl', weight: 'kg' })).toBeUndefined();
  });
});

describe('resolveGalleryPattern — constants', () => {
  const p = { slots: [], template: '%const.a% = %const.a%', constants: [{ key: 'a', label: 'A', default: 'x' }] };
  it('uses the default when no override or a blank override is given', () => {
    expect(resolveGalleryPattern(p, {})).toBe("'x' = 'x'");
    expect(resolveGalleryPattern(p, {}, { a: '   ' })).toBe("'x' = 'x'");
  });
  it('substitutes an override as a string literal, escaping quotes and backslashes', () => {
    expect(resolveGalleryPattern(p, {}, { a: "o'k\\d" })).toBe("'o\\'k\\\\d' = 'o\\'k\\\\d'");
  });
  it('never rescans a constant value for placeholders', () => {
    const q2 = { slots: [{ key: 's', label: 'S', transforms: [] }], template: '%s% %const.a%', constants: [{ key: 'a', label: 'A', default: 'x' }] };
    expect(resolveGalleryPattern(q2, { s: { ref: '%R' } }, { a: '%s% %const.a%' })).toBe("(%R) '%s% %const.a%'");
  });
  it('patterns without constants are unaffected', () => {
    expect(resolveGalleryPattern(pattern('unit-convert'), { value: { ref: '%A', transformId: 'lb-kg' } }, { a: 'z' })).toBe(
      resolveGalleryPattern(pattern('unit-convert'), { value: { ref: '%A', transformId: 'lb-kg' } }));
  });
});

// ── Date and lab/clinical formula patterns — checked against independent JS references ──
describe('resolveGalleryPattern — date and lab patterns', () => {
  const ACC = { d: 'valueDate', n: 'valueDecimal', c: 'valueCoding.code' };
  // spec: { slotKey: [kind 'd'|'n'|'c', value, transformId?] }; absent key = unanswered item
  const calc = (id, spec, constants) => {
    const qr = { resourceType: 'QuestionnaireResponse', item: [] };
    const sel = {};
    for (const slot of pattern(id).slots) {
      const [kind, value, transformId] = spec[slot.key] || ['n'];
      if (value != null) {
        const ans = kind === 'd' ? { valueDate: value } : kind === 'c' ? { valueCoding: { code: value } } : { valueDecimal: value };
        qr.item.push({ linkId: slot.key, answer: [ans] });
      }
      sel[slot.key] = { ref: `%resource.item.where(linkId='${slot.key}').answer.${ACC[kind]}`, transformId };
    }
    const expr = resolveGalleryPattern(pattern(id), sel, constants);
    return fhirpath.evaluate(qr, expr, { resource: qr }, fhirpath_r4_model)[0];
  };
  const days = (iso, n) => new Date(Date.parse(iso) + n * 86400000).toISOString().slice(0, 10);
  const refYears = (b, at) => {
    const [by, bm, bd] = b.split('-').map(Number), [ay, am, ad] = at.split('-').map(Number);
    return ay - by - (am * 100 + ad < bm * 100 + bd ? 1 : 0);
  };
  const refMonths = (b, at) => {
    const [by, bm, bd] = b.split('-').map(Number), [ay, am, ad] = at.split('-').map(Number);
    return (ay - by) * 12 + (am - bm) - (ad < bd ? 1 : 0);
  };

  it.each(['2026-01-01', '2025-12-31', '2024-02-29', '2026-06-15'])('due-date-naegele %s = LMP + 280 days', (lmp) => {
    expect(calc('due-date-naegele', { lmp: ['d', lmp] })).toBe(days(lmp, 280));
  });

  it.each([
    ['1w', '2026-01-31', '2026-02-07'], ['2w', '2026-01-31', '2026-02-14'], ['4w', '2026-01-31', '2026-02-28'],
    ['1m', '2026-01-31', '2026-02-28'], ['3m', '2026-01-15', '2026-04-15'], ['6m', '2026-08-31', '2027-02-28'],
    ['1y', '2026-03-01', '2027-03-01'],
  ])('date-plus-interval %s on %s = %s', (tid, from, want) => {
    expect(calc('date-plus-interval', { date: ['d', from, tid] })).toBe(want);
  });

  it.each([
    ['1990-12-25', '2026-06-01'], ['1990-06-01', '2026-06-01'], ['1990-06-02', '2026-06-01'], ['2020-02-29', '2024-02-28'], ['2020-02-29', '2024-02-29'],
  ])('age-at-date %s at %s', (b, at) => {
    expect(calc('age-at-date', { birth: ['d', b], at: ['d', at] })).toBe(refYears(b, at));
  });

  it.each([
    ['2025-03-15', '2026-03-14'], ['2025-03-15', '2026-03-15'], ['2025-12-20', '2026-01-10'], ['2026-01-31', '2026-02-28'], ['2020-05-05', '2020-05-05'],
  ])('age-in-months %s at %s', (b, at) => {
    expect(calc('age-in-months', { birth: ['d', b], at: ['d', at] })).toBe(refMonths(b, at));
  });

  it('days-between-dates matches real calendar days across leap years and century boundaries', () => {
    const starts = ['1900-02-27', '1999-12-30', '2000-02-27', '2023-12-30', '2024-02-27', '2099-12-30', '2100-02-27', '2026-11-04'];
    let checked = 0;
    for (const start of starts) {
      for (let off = -3; off <= 800; off += 37) {
        const end = days(start, off);
        expect(calc('days-between-dates', { start: ['d', start], end: ['d', end] }), `${start} -> ${end}`).toBe(off);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(150);
  }, 30000);

  it('days-between-dates: exact edge cases and negative spans', () => {
    const d = (start, end) => calc('days-between-dates', { start: ['d', start], end: ['d', end] });
    expect(d('2024-02-28', '2024-03-01')).toBe(2);
    expect(d('2023-02-28', '2023-03-01')).toBe(1);
    expect(d('2000-01-01', '2000-12-31')).toBe(365);
    expect(d('2026-01-01', '2025-12-31')).toBe(-1);
    expect(d('2026-05-05', '2026-05-05')).toBe(0);
  });

  it.each([['2026-01-01', '2026-01-07', 0], ['2026-01-01', '2026-01-08', 1], ['2025-12-01', '2026-03-01', 12], ['2024-02-01', '2024-11-07', 40]])(
    'gestational-age-weeks LMP %s at %s = %s completed weeks', (lmp, at, weeks) => {
      expect(calc('gestational-age-weeks', { lmp: ['d', lmp], at: ['d', at] })).toBe(weeks);
    });

  it('gestational-age-weeks gives no result when the visit is before the LMP; cockcroft-gault none for age over 140', () => {
    expect(calc('gestational-age-weeks', { lmp: ['d', '2026-03-01'], at: ['d', '2026-02-20'] })).toBeUndefined();
    expect(calc('cockcroft-gault', { age: ['n', 150], weight: ['n', 70, 'kg'], scr: ['n', 1, 'mgdl'], sex: ['c', 'male'] })).toBeUndefined();
  });

  it('date patterns give no result while a date is unanswered', () => {
    expect(calc('age-at-date', { birth: ['d', '1990-01-01'], at: ['d', null] })).toBeUndefined();
    expect(calc('due-date-naegele', { lmp: ['d', null] })).toBeUndefined();
    expect(calc('days-between-dates', { start: ['d', '2026-01-01'], end: ['d', null] })).toBeUndefined();
  });

  it('corrected-calcium: Ca + 0.8 x (4 - albumin), with unit conversions', () => {
    expect(calc('corrected-calcium', { ca: ['n', 8, 'mgdl'], alb: ['n', 2.5, 'gdl'] })).toBe(9.2);
    expect(calc('corrected-calcium', { ca: ['n', 2, 'mmol'], alb: ['n', 25, 'gl'] })).toBe(9.2);
    expect(calc('corrected-calcium', { ca: ['n', 9.5, 'mgdl'], alb: ['n', 4, 'gdl'] })).toBe(9.5);
  });

  it('ldl-friedewald: TC - HDL - TG/5; no result at TG >= 400; mmol/L conversion', () => {
    expect(calc('ldl-friedewald', { tc: ['n', 200, 'mgdl'], hdl: ['n', 50, 'mgdl'], tg: ['n', 150, 'mgdl'] })).toBe(120);
    expect(calc('ldl-friedewald', { tc: ['n', 200, 'mgdl'], hdl: ['n', 50, 'mgdl'], tg: ['n', 400, 'mgdl'] })).toBeUndefined();
    expect(calc('ldl-friedewald', { tc: ['n', 200, 'mgdl'], hdl: ['n', 50, 'mgdl'], tg: ['n', 399, 'mgdl'] })).toBe(Math.round(200 - 50 - 399 / 5));
    const mm = calc('ldl-friedewald', { tc: ['n', 5.17, 'mmol'], hdl: ['n', 1.29, 'mmol'], tg: ['n', 1.69, 'mmol'] });
    expect(mm).toBe(Math.round(5.17 * 38.67 - 1.29 * 38.67 - (1.69 * 88.57) / 5));
  });

  it('homa-ir: glucose x insulin / 405, mmol/L converts at 18', () => {
    expect(calc('homa-ir', { glucose: ['n', 90, 'mgdl'], insulin: ['n', 10] })).toBe(2.22);
    expect(calc('homa-ir', { glucose: ['n', 5, 'mmol'], insulin: ['n', 10] })).toBe(2.22);
  });

  it.each([
    [{ age: 30, ast: 20, alt: 36, plt: 250 }, 'Low risk (< 1.3)'],
    [{ age: 50, ast: 40, alt: 25, plt: 200 }, 'Indeterminate (1.3\u20132.67)'],
    [{ age: 60, ast: 100, alt: 25, plt: 100 }, 'High risk (> 2.67)'],
  ])('fib4 %j -> %s', (v, want) => {
    const spec = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, ['n', x]]));
    expect(calc('fib4', spec)).toBe(want);
  });

  it.each([[400, 75], [380, 60], [450, 110]])('qtc-bazett and qtc-fridericia for QT %s ms, HR %s', (qt, hr) => {
    const rr = 60 / hr;
    expect(calc('qtc-bazett', { qt: ['n', qt], hr: ['n', hr] })).toBe(Math.round(qt / Math.sqrt(rr)));
    expect(calc('qtc-fridericia', { qt: ['n', qt], hr: ['n', hr] })).toBe(Math.round(qt / Math.cbrt(rr)));
  });

  it('ideal-body-weight: Devine by sex, cm conversion, overridable female code; no sex = no result', () => {
    expect(calc('ideal-body-weight', { height: ['n', 70, 'in'], sex: ['c', 'male'] })).toBe(73);
    expect(calc('ideal-body-weight', { height: ['n', 170.18, 'cm'], sex: ['c', 'female'] })).toBe(61.6);
    expect(calc('ideal-body-weight', { height: ['n', 67, 'in'], sex: ['c', 'F'] }, { female: 'F' })).toBe(61.6);
    expect(calc('ideal-body-weight', { height: ['n', 67, 'in'], sex: ['c', 'F'] })).toBe(50 + 2.3 * 7);
    expect(calc('ideal-body-weight', { height: ['n', 67, 'in'], sex: ['c', null] })).toBeUndefined();
  });

  it('waist-hip-ratio rounds to 2 decimals', () => {
    expect(calc('waist-hip-ratio', { waist: ['n', 80], hip: ['n', 100] })).toBe(0.8);
    expect(calc('waist-hip-ratio', { waist: ['n', 91], hip: ['n', 107] })).toBe(0.85);
  });
});

