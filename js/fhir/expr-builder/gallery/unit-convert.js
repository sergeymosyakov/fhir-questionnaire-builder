// Standalone unit-conversion gallery pattern — see ../gallery/index.js for the shape.
export const unitConvert = {
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
};
