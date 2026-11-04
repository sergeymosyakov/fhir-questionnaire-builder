// HOMA-IR gallery pattern — see ../gallery/index.js for the shape.
// Matthews et al. 1985 (Diabetologia 28:412): glucose (mmol/L) x insulin (uU/mL) / 22.5,
// i.e. glucose mg/dL x insulin / 405 (1 mmol/L = 18 mg/dL).
export const homaIr = {
  id: 'homa-ir',
  name: 'HOMA-IR (insulin resistance)',
  description: 'Fasting glucose × fasting insulin ÷ 405 (glucose in mg/dL, insulin in µU/mL), rounded to 2 decimals.',
  source: 'Matthews et al. 1985, Diabetologia 28:412',
  itemTypes: ['integer', 'decimal', 'quantity'],
  slots: [
    {
      key: 'glucose',
      label: 'Fasting glucose item',
      transforms: [
        { id: 'mgdl', label: 'Already in mg/dL', template: '%value%' },
        { id: 'mmol', label: 'Convert from mmol/L', template: '(%value% * 18)' },
      ],
    },
    { key: 'insulin', label: 'Fasting insulin item (µU/mL)', transforms: [] },
  ],
  template: '((%glucose% * %insulin%) / 405).round(2)',
};
