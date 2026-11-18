// Albumin-corrected calcium gallery pattern — see ../gallery/index.js for the shape.
// Modified Payne form: 0.8 mg/dL per g/dL. Payne 1973 itself uses 1.0; published coefficients range 0.75-1.0 (Besarab & Caro 1978).
export const correctedCalcium = {
  id: 'corrected-calcium',
  name: 'Corrected calcium (albumin)',
  description: 'Total calcium adjusted for low albumin, in mg/dL: Ca + 0.8 × (4.0 − albumin). The 0.8 is a modified Payne coefficient, within the published 0.75 to 1.0 range; Payne\'s 1973 original uses 1.0.',
  source: 'Ca + 0.8 × (4.0 − albumin), a modified Payne form (Payne et al. 1973, BMJ 4:643, uses 1.0, and 0.75 to 1.0 is the published range per Besarab & Caro 1978, J Clin Pathol 31:1369, citing Kleeman et al.)',
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
