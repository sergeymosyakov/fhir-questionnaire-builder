// Imperial BMI gallery pattern — see ../gallery/index.js for the shape.
// Real-world evidence: sampledata/bariatric-extended.fhir.json computes BMI
// this way (weight in lb, height in inches, x703 constant) rather than
// converting to metric first.
export const bmiImperial = {
  id: 'bmi-imperial',
  name: 'BMI (imperial: lb, inches)',
  description: 'weight(lb) \u00d7 703 \u00f7 height(in)\u00b2 — the standard US imperial BMI formula.',
  itemTypes: ['integer', 'decimal', 'quantity'],
  slots: [
    {
      key: 'weight',
      label: 'Weight item',
      transforms: [
        { id: 'lb', label: 'Already in lb', template: '%value%' },
        { id: 'kg', label: 'Convert from kg', template: '(%value% * 2.20462)' },
      ],
    },
    {
      key: 'height',
      label: 'Height item',
      transforms: [
        { id: 'in', label: 'Already in inches', template: '%value%' },
        { id: 'cm', label: 'Convert from cm', template: '(%value% / 2.54)' },
      ],
    },
  ],
  template: '((%weight% * 703) / (%height% * %height%)).round(1)',
};
