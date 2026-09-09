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
      "iif(((%W) / ((%H) * (%H))) < 18.5, 'Underweight', " +
      "iif(((%W) / ((%H) * (%H))) < 25, 'Normal weight', " +
      "iif(((%W) / ((%H) * (%H))) < 30, 'Overweight', 'Obese')))"
    );
  });

  it('repeatable slot resolves to a summed expression', () => {
    const expr = resolveGalleryPattern(pattern('sum-of-items'), {
      items: [
        { ref: '%A', transformId: 'raw' },
        { ref: '%B', transformId: 'lb-to-kg' },
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
