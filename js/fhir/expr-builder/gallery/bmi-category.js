// BMI Category (WHO) gallery pattern — see ../gallery/index.js for the shape.
export const bmiCategory = {
  id: 'bmi-category',
  name: 'BMI Category (WHO)',
  description: 'BMI mapped to its WHO weight category \u2014 pick the weight and height items, with optional unit conversion.',
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
  // Unrounded — categorizing a rounded BMI could flip a borderline value
  // (e.g. 24.95) across a threshold it wouldn't actually cross.
  template: '(%weight% / (%height% * %height%))',
  categories: [
    { lessThan: 18.5, label: 'Underweight' },
    { lessThan: 25, label: 'Normal weight' },
    { lessThan: 30, label: 'Overweight' },
    { label: 'Obese' },
  ],
};
