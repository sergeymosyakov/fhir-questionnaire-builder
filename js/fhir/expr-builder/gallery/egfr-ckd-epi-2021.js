// eGFR (CKD-EPI 2021, race-free) gallery pattern — see ../gallery/index.js for the shape.
// Inker et al. 2021 (N Engl J Med 385:1737): 142 x min(Scr/k,1)^a x max(Scr/k,1)^-1.200
// x 0.9938^age x 1.012 if female; k = 0.7 (F) / 0.9 (M), a = -0.241 (F) / -0.302 (M).
// No result until creatinine (> 0), age and sex are all answered (an empty sex would
// otherwise silently take the male branch).
const F = '(%sex% = %const.female%)';
const R = `(%scr% / iif(${F}, 0.7, 0.9))`;

export const egfrCkdEpi2021 = {
  id: 'egfr-ckd-epi-2021',
  name: 'eGFR (CKD-EPI 2021)',
  description: 'Estimated GFR in mL/min/1.73 m\u00b2 from creatinine, age and sex \u2014 set the answer code that means female if your sex item does not use \u201cfemale\u201d.',
  source: 'Inker et al. 2021, N Engl J Med 385:1737 (race-free CKD-EPI)',
  itemTypes: ['integer', 'decimal', 'quantity'],
  constants: [{ key: 'female', label: 'Answer code for Female', default: 'female' }],
  slots: [
    {
      key: 'scr',
      label: 'Serum creatinine item',
      transforms: [
        { id: 'mgdl', label: 'Already in mg/dL', template: '%value%' },
        { id: 'umol', label: 'Convert from \u00b5mol/L', template: '(%value% / 88.4)' },
      ],
    },
    { key: 'age', label: 'Age in years item', transforms: [] },
    { key: 'sex', label: 'Sex item (single choice)', itemTypes: ['select', 'radio'], transforms: [] },
  ],
  template:
    'iif(%scr% > 0 and %age%.exists() and %sex%.exists(), ' +
    `(142 * iif(${R} < 1, ${R}, 1).power(iif(${F}, -0.241, -0.302)) ` +
    `* iif(${R} > 1, ${R}, 1).power(-1.2) ` +
    `* 0.9938.power(%age%) * iif(${F}, 1.012, 1)).round(0), {})`,
};
