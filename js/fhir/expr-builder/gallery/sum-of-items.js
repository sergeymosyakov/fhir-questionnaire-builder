// Sum of items gallery pattern — see ../gallery/index.js for the shape.
// Demonstrates a repeatable slot: add as many rows as needed, each picking its
// own item + optional unit conversion; resolves to their sum. Transform
// vocabulary mirrors unit-convert.js (same ids/labels) rather than assuming
// any one domain — a generic sum shouldn't bake in e.g. weight-only units.
export const sumOfItems = {
  id: 'sum-of-items',
  name: 'Sum of items',
  description: 'Add as many numeric items as you need \u2014 their values (with optional unit conversion) are added together.',
  itemTypes: ['integer', 'decimal', 'quantity'],
  slots: [
    {
      key: 'items',
      label: 'Item to include',
      repeatable: true,
      min: 2,
      transforms: [
        { id: 'raw', label: 'As-is', template: '%value%' },
        { id: 'lb-kg', label: 'lb \u2192 kg', template: '(%value% * 0.453592)' },
        { id: 'kg-lb', label: 'kg \u2192 lb', template: '(%value% / 0.453592)' },
        { id: 'cm-m', label: 'cm \u2192 m', template: '(%value% / 100)' },
        { id: 'm-cm', label: 'm \u2192 cm', template: '(%value% * 100)' },
        { id: 'f-c', label: '\u00b0F \u2192 \u00b0C', template: '((%value% - 32) / 1.8)' },
        { id: 'c-f', label: '\u00b0C \u2192 \u00b0F', template: '((%value% * 1.8) + 32)' },
      ],
    },
  ],
  template: '%items%',
};
