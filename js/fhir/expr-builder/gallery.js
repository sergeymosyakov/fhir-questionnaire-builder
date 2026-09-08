// Gallery of named FHIRPath calculation templates (issue #122) — pure data +
// a pure resolver. No DOM; consumed by ExpressionGalleryModal.
// Slot macros in `template` (e.g. %weight%) are replaced by the picked item's
// FHIRPath reference, optionally passed through a per-slot transform first.

export const EXPR_GALLERY = [
  {
    id: 'bmi',
    name: 'BMI (Body Mass Index)',
    description: 'weight ÷ height² — pick the weight and height items, with optional unit conversion.',
    itemTypes: ['integer', 'decimal', 'quantity'],
    slots: [
      {
        key: 'weight',
        label: 'Weight item',
        transforms: [
          { id: 'kg', label: 'Already in kg', template: '%value%' },
          { id: 'lb', label: 'Convert from lb', template: '(%value% * 0.453592)' },
        ],
      },
      {
        key: 'height',
        label: 'Height item',
        transforms: [
          { id: 'm', label: 'Already in m', template: '%value%' },
          { id: 'cm', label: 'Convert from cm', template: '(%value% / 100)' },
        ],
      },
    ],
    template: '(%weight% / (%height% * %height%)).round(1)',
  },
  {
    id: 'age-from-birthdate',
    name: 'Age from birthdate (whole years)',
    description: 'Whole years since a birthdate item — correctly handles a birthday not yet reached this year.',
    itemTypes: ['date', 'dateTime'],
    slots: [
      { key: 'birthdate', label: 'Birthdate item', transforms: [] },
    ],
    // Verified against fhirpath.js directly (date - date has no direct year-diff
    // operator) — year-substring diff, minus 1 if this year's month/day hasn't
    // been reached yet.
    template: "(today().toString().substring(0,4).toInteger() - %birthdate%.toString().substring(0,4).toInteger()) - iif(today().toString().substring(5,10) < %birthdate%.toString().substring(5,10), 1, 0)",
  },
  {
    id: 'unit-convert',
    name: 'Unit conversion',
    description: 'Convert a single numeric item between common clinical units.',
    itemTypes: ['integer', 'decimal', 'quantity'],
    slots: [
      {
        key: 'value',
        label: 'Item to convert',
        transforms: [
          { id: 'lb-kg', label: 'lb \u2192 kg', template: '(%value% * 0.453592)' },
          { id: 'kg-lb', label: 'kg \u2192 lb', template: '(%value% / 0.453592)' },
          { id: 'cm-m', label: 'cm \u2192 m', template: '(%value% / 100)' },
          { id: 'm-cm', label: 'm \u2192 cm', template: '(%value% * 100)' },
          { id: 'f-c', label: '\u00b0F \u2192 \u00b0C', template: '((%value% - 32) / 1.8)' },
          { id: 'c-f', label: '\u00b0C \u2192 \u00b0F', template: '((%value% * 1.8) + 32)' },
        ],
      },
    ],
    template: '%value%',
  },
];

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
