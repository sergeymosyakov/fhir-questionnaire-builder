// Mean arterial pressure gallery pattern — see ../gallery/index.js for the shape.
// MAP = (systolic + 2 × diastolic) ÷ 3, the standard estimate from a cuff reading.
export const meanArterialPressure = {
  id: 'mean-arterial-pressure',
  name: 'Mean arterial pressure',
  description: '(systolic + 2 × diastolic) ÷ 3 in mmHg, rounded to 1 decimal.',
  itemTypes: ['integer', 'decimal', 'quantity'],
  slots: [
    { key: 'sbp', label: 'Systolic BP item', transforms: [] },
    { key: 'dbp', label: 'Diastolic BP item', transforms: [] },
  ],
  template: '((%sbp% + (2 * %dbp%)) / 3).round(1)',
};
