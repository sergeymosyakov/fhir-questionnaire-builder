// Ideal body weight (Devine) gallery pattern — see ../gallery/index.js for the shape.
// Devine 1974 (Drug Intell Clin Pharm 8:650): male 50 kg, female 45.5 kg, + 2.3 kg per inch
// over 5 feet. Defined for height >= 60 in; shorter gives a lower value, not an error.
export const idealBodyWeight = {
  id: 'ideal-body-weight',
  name: 'Ideal body weight (Devine)',
  description: 'Male 50 kg / female 45.5 kg + 2.3 kg per inch over 5 feet — set the answer code that means female if your sex item does not use “female”.',
  source: 'Devine 1974, Drug Intell Clin Pharm 8:650',
  itemTypes: ['integer', 'decimal', 'quantity'],
  constants: [{ key: 'female', label: 'Answer code for Female', default: 'female' }],
  slots: [
    {
      key: 'height',
      label: 'Height item',
      transforms: [
        { id: 'in', label: 'Already in inches', template: '%value%' },
        { id: 'cm', label: 'Convert from cm', template: '(%value% / 2.54)' },
      ],
    },
    { key: 'sex', label: 'Sex item (single choice)', itemTypes: ['select', 'radio'], transforms: [] },
  ],
  template: 'iif(%sex%.exists(), (iif(%sex% = %const.female%, 45.5, 50) + (2.3 * (%height% - 60))).round(1), {})',
};
