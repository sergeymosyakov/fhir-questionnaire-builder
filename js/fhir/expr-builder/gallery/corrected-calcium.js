// Albumin-corrected calcium gallery pattern — see ../gallery/index.js for the shape.
// Payne et al. 1973 (BMJ 4:643): corrected Ca (mg/dL) = Ca + 0.8 x (4.0 - albumin g/dL).
export const correctedCalcium = {
  id: 'corrected-calcium',
  name: 'Corrected calcium (albumin)',
  description: 'Total calcium adjusted for low albumin, in mg/dL: Ca + 0.8 × (4.0 − albumin).',
  itemTypes: ['integer', 'decimal', 'quantity'],
  slots: [
    {
      key: 'ca',
      label: 'Total calcium item',
      transforms: [
        { id: 'mgdl', label: 'Already in mg/dL', template: '%value%' },
        { id: 'mmol', label: 'Convert from mmol/L', template: '(%value% * 4.008)' },
      ],
    },
    {
      key: 'alb',
      label: 'Albumin item',
      transforms: [
        { id: 'gdl', label: 'Already in g/dL', template: '%value%' },
        { id: 'gl', label: 'Convert from g/L', template: '(%value% / 10)' },
      ],
    },
  ],
  template: '(%ca% + (0.8 * (4 - %alb%))).round(1)',
};
