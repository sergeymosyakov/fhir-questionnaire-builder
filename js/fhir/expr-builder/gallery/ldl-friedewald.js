// LDL cholesterol (Friedewald) gallery pattern — see ../gallery/index.js for the shape.
// Friedewald et al. 1972 (Clin Chem 18:499): LDL = TC - HDL - TG/5 (mg/dL), valid only
// for triglycerides < 400 mg/dL — above that there is no result.
const CHOL = [
  { id: 'mgdl', label: 'Already in mg/dL', template: '%value%' },
  { id: 'mmol', label: 'Convert from mmol/L', template: '(%value% * 38.67)' },
];

export const ldlFriedewald = {
  id: 'ldl-friedewald',
  name: 'LDL cholesterol (Friedewald)',
  description: 'Total − HDL − triglycerides ÷ 5, in mg/dL; no result when triglycerides are 400 mg/dL or more.',
  source: 'Friedewald et al. 1972, Clin Chem 18:499',
  itemTypes: ['integer', 'decimal', 'quantity'],
  slots: [
    { key: 'tc', label: 'Total cholesterol item', transforms: CHOL },
    { key: 'hdl', label: 'HDL cholesterol item', transforms: CHOL },
    {
      key: 'tg',
      label: 'Triglycerides item',
      transforms: [
        { id: 'mgdl', label: 'Already in mg/dL', template: '%value%' },
        { id: 'mmol', label: 'Convert from mmol/L', template: '(%value% * 88.57)' },
      ],
    },
  ],
  template: 'iif(%tg% < 400, (%tc% - %hdl% - (%tg% / 5)).round(0), {})',
};
