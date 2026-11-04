// Creatinine clearance (Cockcroft-Gault) gallery pattern — see ../gallery/index.js for the shape.
// CrCl (mL/min) = (140 - age) x weight kg / (72 x Scr mg/dL), x 0.85 if female —
// Cockcroft & Gault 1976 (Nephron 16:31-41). An unanswered sex gives no result
// rather than the male branch.
export const cockcroftGault = {
  id: 'cockcroft-gault',
  name: 'Creatinine clearance (Cockcroft\u2013Gault)',
  description: '(140 \u2212 age) \u00d7 weight \u00f7 (72 \u00d7 creatinine), \u00d7 0.85 if female, in mL/min \u2014 set the answer code that means female if your sex item does not use \u201cfemale\u201d.',
  source: 'Cockcroft & Gault 1976, Nephron 16:31',
  itemTypes: ['integer', 'decimal', 'quantity'],
  constants: [{ key: 'female', label: 'Answer code for Female', default: 'female' }],
  slots: [
    { key: 'age', label: 'Age in years item', transforms: [] },
    {
      key: 'weight',
      label: 'Weight item',
      transforms: [
        { id: 'kg', label: 'Already in kg', template: '%value%' },
        { id: 'lb', label: 'Convert from lb', template: '(%value% * 0.453592)' },
      ],
    },
    {
      key: 'scr',
      label: 'Serum creatinine item',
      transforms: [
        { id: 'mgdl', label: 'Already in mg/dL', template: '%value%' },
        { id: 'umol', label: 'Convert from \u00b5mol/L', template: '(%value% / 88.4)' },
      ],
    },
    { key: 'sex', label: 'Sex item (single choice)', itemTypes: ['select', 'radio'], transforms: [] },
  ],
  template: 'iif(%sex%.exists(), ((((140 - %age%) * %weight%) / (72 * %scr%)) * iif(%sex% = %const.female%, 0.85, 1)).round(0), {})',
};
