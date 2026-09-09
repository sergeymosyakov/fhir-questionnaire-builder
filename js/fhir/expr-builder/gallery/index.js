// Gallery of named FHIRPath calculation templates (issue #122) — assembles one
// pattern per file in this folder into EXPR_GALLERY, plus the pure resolver.
// No DOM; consumed by ExpressionGalleryModal. Adding a pattern = new file here
// + one line below, never edit an existing pattern's file.
import { bmi } from './bmi.js';
import { bmiImperial } from './bmi-imperial.js';
import { ageFromBirthdate } from './age-from-birthdate.js';
import { unitConvert } from './unit-convert.js';

export const EXPR_GALLERY = [bmi, bmiImperial, ageFromBirthdate, unitConvert];

// selections: { [slotKey]: { ref: string (raw FHIRPath item reference), transformId?: string } }
// Returns null if any slot is unfilled.
export function resolveGalleryPattern(pattern, selections) {
  let result = pattern.template;
  for (const slot of pattern.slots) {
    const sel = selections[slot.key];
    if (!sel?.ref) return null;
    let value = sel.ref;
    const transform = slot.transforms.find((t) => t.id === sel.transformId);
    if (transform) value = transform.template.replace(/%value%/g, value);
    // Every transform template is already fully parenthesized — don't wrap again.
    const wrapped = value.startsWith('(') && value.endsWith(')') ? value : `(${value})`;
    result = result.split(`%${slot.key}%`).join(wrapped);
  }
  return result;
}
