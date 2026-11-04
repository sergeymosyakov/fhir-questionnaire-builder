// Expected delivery date (Naegele) gallery pattern — see ../gallery/index.js for the shape.
// LMP + 280 days (40 weeks), assuming a regular 28-day cycle.
export const dueDateNaegele = {
  id: 'due-date-naegele',
  name: 'Expected delivery date (from LMP)',
  description: 'Last menstrual period + 280 days (Naegele’s rule, regular 28-day cycle).',
  source: 'Naegele\'s rule (LMP + 280 days, regular 28-day cycle)',
  itemTypes: ['date', 'dateTime'],
  slots: [{ key: 'lmp', label: 'Last menstrual period item', transforms: [] }],
  template: '(%lmp% + 280 days)',
};
