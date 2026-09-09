// Gallery of named FHIRPath calculation templates (issue #122) — assembles one
// pattern per file in this folder into EXPR_GALLERY, plus the pure resolver.
// No DOM; consumed by ExpressionGalleryModal. Adding a pattern = new file here
// + one line below, never edit an existing pattern's file.
import { bmi } from './bmi.js';
import { bmiImperial } from './bmi-imperial.js';
import { bmiCategory } from './bmi-category.js';
import { ageFromBirthdate } from './age-from-birthdate.js';
import { unitConvert } from './unit-convert.js';
import { gad7Severity } from './gad7-severity.js';
import { phq9Severity } from './phq9-severity.js';
import { cha2ds2Vasc } from './cha2ds2-vasc.js';
import { sumOfItems } from './sum-of-items.js';

export const EXPR_GALLERY = [
  bmi, bmiImperial, bmiCategory, ageFromBirthdate, unitConvert,
  gad7Severity, phq9Severity, cha2ds2Vasc, sumOfItems,
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
// catch-all (no lessThan). Builds a nested iif() chain, evaluated on numExpr.
function applyCategories(numExpr, categories) {
  let out = `'${categories[categories.length - 1].label}'`;
  for (let i = categories.length - 2; i >= 0; i--) {
    out = `iif(${numExpr} < ${categories[i].lessThan}, '${categories[i].label}', ${out})`;
  }
  return out;
}

// selections: { [slotKey]: fixed-slot object, or an array for a repeatable slot }
// Returns null if any slot is unfilled (or a repeatable slot is under its min).
export function resolveGalleryPattern(pattern, selections) {
  let result = pattern.template;
  for (const slot of pattern.slots) {
    const value = slot.repeatable
      ? resolveRepeatableSlot(slot, selections[slot.key])
      : resolveFixedSlot(slot, selections[slot.key]);
    if (value == null) return null;
    result = result.split(`%${slot.key}%`).join(value);
  }
  if (pattern.categories) result = applyCategories(result, pattern.categories);
  return result;
}
