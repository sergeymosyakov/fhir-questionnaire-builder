// Gallery of named FHIRPath calculation templates (issue #122) — assembles one
// pattern per file in this folder into EXPR_GALLERY, plus the pure resolver.
// No DOM; consumed by ExpressionGalleryModal. Adding a pattern = new file here
// + one line below, never edit an existing pattern's file.
import { q } from '../emit.js';
import { bmi } from './bmi.js';
import { bmiImperial } from './bmi-imperial.js';
import { bmiCategory } from './bmi-category.js';
import { ageFromBirthdate } from './age-from-birthdate.js';
import { unitConvert } from './unit-convert.js';
import { gad7Severity } from './gad7-severity.js';
import { phq9Severity } from './phq9-severity.js';
import { cha2ds2Vasc } from './cha2ds2-vasc.js';
import { sumOfItems } from './sum-of-items.js';
import { charlsonComorbidityIndex } from './charlson-comorbidity-index.js';
import { countYesAnswers } from './count-yes-answers.js';
import { percentChange } from './percent-change.js';
import { phq2Screen } from './phq2-screen.js';
import { glasgowComaScale } from './glasgow-coma-scale.js';
import { apgarScore } from './apgar-score.js';
import { qsofa } from './qsofa.js';
import { bsaMosteller } from './bsa-mosteller.js';
import { meanArterialPressure } from './mean-arterial-pressure.js';
import { anionGap } from './anion-gap.js';
import { egfrCkdEpi2021 } from './egfr-ckd-epi-2021.js';
import { cockcroftGault } from './cockcroft-gault.js';

export const EXPR_GALLERY = [
  bmi, bmiImperial, bmiCategory, ageFromBirthdate, unitConvert,
  gad7Severity, phq9Severity, cha2ds2Vasc, sumOfItems, charlsonComorbidityIndex,
  countYesAnswers, percentChange, phq2Screen, glasgowComaScale, apgarScore, qsofa,
  bsaMosteller, meanArterialPressure, anionGap, egfrCkdEpi2021, cockcroftGault,
];

// Applies a slot's transform (if any) and wraps the result in parens, unless
// it's already wrapped. Shared by fixed and repeatable slot resolution.
function applyTransform(ref, transforms, transformId) {
  let value = ref;
  const transform = transforms?.find((t) => t.id === transformId);
  if (transform) value = transform.template.replace(/%value%/g, value);
  return value.startsWith('(') && value.endsWith(')') ? value : `(${value})`;
}

// Fixed slot: selections[slot.key] = { ref, transformId? }.
function resolveFixedSlot(slot, sel) {
  if (!sel?.ref) return null;
  return applyTransform(sel.ref, slot.transforms, sel.transformId);
}

// Repeatable slot: selections[slot.key] = [{ ref, transformId? }, ...]. Summed.
function resolveRepeatableSlot(slot, rows) {
  const filled = (rows || []).filter((r) => r?.ref);
  if (filled.length < (slot.min ?? 1)) return null;
  const parts = filled.map((r) => applyTransform(r.ref, slot.transforms, r.transformId));
  return `(${parts.join(' + ')})`;
}

// pattern.categories: [{ lessThan, label }, ..., { label }] — last entry is the
// catch-all (no lessThan). Builds a nested iif() chain, evaluated on numExpr;
// an unanswered input gives no result instead of falling into the catch-all band.
function applyCategories(numExpr, categories) {
  let out = `'${categories[categories.length - 1].label}'`;
  for (let i = categories.length - 2; i >= 0; i--) {
    out = `iif(${numExpr} < ${categories[i].lessThan}, '${categories[i].label}', ${out})`;
  }
  return `iif(${numExpr}.exists(), ${out}, {})`;
}

// pattern.constants: [{ key, label, default }] — the template references each as
// %const.key%, replaced by a FHIRPath string literal of the author's override
// (blank/absent falls back to the default).
function constantLiterals(constants, overrides) {
  return (constants || []).map((c) => [
    `%const.${c.key}%`,
    q(String(overrides?.[c.key] ?? '').trim() || c.default),
  ]);
}

// selections: { [slotKey]: fixed-slot object, or an array for a repeatable slot }
// constants: { [constKey]: string } overrides for pattern.constants (optional).
// Returns null if any slot is unfilled (or a repeatable slot is under its min).
// One substitution pass, so inserted text (item refs, constant values) is never rescanned.
export function resolveGalleryPattern(pattern, selections, constants) {
  const values = new Map(constantLiterals(pattern.constants, constants));
  for (const slot of pattern.slots) {
    const value = slot.repeatable
      ? resolveRepeatableSlot(slot, selections[slot.key])
      : resolveFixedSlot(slot, selections[slot.key]);
    if (value == null) return null;
    values.set(`%${slot.key}%`, value);
  }
  let result = pattern.template.replace(/%(?:const\.)?\w+%/g, (m) => values.get(m) ?? m);
  if (pattern.categories) result = applyCategories(result, pattern.categories);
  return result;
}
