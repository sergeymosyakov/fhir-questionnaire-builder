// BMI (Body Mass Index) gallery pattern — see ../gallery/index.js for the shape.
export const bmi = {
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
};
