// Sum of items gallery pattern — see ../gallery/index.js for the shape.
// Demonstrates a repeatable slot: add as many rows as needed, each picking its
// own item + optional unit conversion; resolves to their sum.
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
        { id: 'lb-to-kg', label: 'lb \u2192 kg', template: '(%value% * 0.453592)' },
        { id: 'cm-to-m', label: 'cm \u2192 m', template: '(%value% / 100)' },
      ],
    },
  ],
  template: '%items%',
};
