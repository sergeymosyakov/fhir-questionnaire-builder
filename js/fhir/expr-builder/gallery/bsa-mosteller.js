// Body surface area (Mosteller) gallery pattern — see ../gallery/index.js for the shape.
// BSA (m²) = √(height cm × weight kg ÷ 3600) — Mosteller 1987 (N Engl J Med 317:1098).
export const bsaMosteller = {
  id: 'bsa-mosteller',
  name: 'Body surface area (Mosteller)',
  description: '√(height cm × weight kg ÷ 3600), in m² — pick the height and weight items, with optional unit conversion.',
  source: 'Mosteller 1987, N Engl J Med 317:1098',
  itemTypes: ['integer', 'decimal', 'quantity'],
  slots: [
    {
      key: 'height',
      label: 'Height item',
      transforms: [
        { id: 'cm', label: 'Already in cm', template: '%value%' },
        { id: 'in', label: 'Convert from inches', template: '(%value% * 2.54)' },
        { id: 'm', label: 'Convert from m', template: '(%value% * 100)' },
      ],
    },
    {
      key: 'weight',
      label: 'Weight item',
      transforms: [
        { id: 'kg', label: 'Already in kg', template: '%value%' },
        { id: 'lb', label: 'Convert from lb', template: '(%value% * 0.453592)' },
      ],
    },
  ],
  template: '((%height% * %weight%) / 3600).sqrt().round(2)',
};
