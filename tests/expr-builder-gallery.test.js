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
