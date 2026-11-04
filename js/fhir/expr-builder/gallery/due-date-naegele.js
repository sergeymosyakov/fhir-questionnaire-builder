// Expected delivery date (Naegele) gallery pattern — see ../gallery/index.js for the shape.
// LMP + 280 days (40 weeks), assuming a regular 28-day cycle.
export const dueDateNaegele = {
  id: 'due-date-naegele',
  name: 'Expected delivery date (LMP + 280 days)',
  description: 'Last menstrual period + 280 days (40 weeks), assuming a regular 28-day cycle.',
  source: 'Naegele\'s rule, 280-day form (regular 28-day cycle)',
  itemTypes: ['date'], // a dateTime would be shifted into the viewer's time zone
  slots: [{ key: 'lmp', label: 'Last menstrual period item', transforms: [] }],
  template: '(%lmp% + 280 days)',
};
