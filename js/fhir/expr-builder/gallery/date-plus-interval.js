// Date plus interval gallery pattern — see ../gallery/index.js for the shape.
// Calendar arithmetic is done by FHIRPath itself (month-end days clamp, e.g. Jan 31 + 1 month = Feb 28).
const plus = (id, label, qty) => ({ id, label, template: `(%value% + ${qty})` });

export const datePlusInterval = {
  id: 'date-plus-interval',
  name: 'Date plus interval',
  description: 'A date item plus a fixed interval — e.g. a follow-up or next-due date.',
  itemTypes: ['date', 'dateTime'],
  slots: [
    {
      key: 'date',
      label: 'Start date item',
      transforms: [
        plus('1w', '+ 1 week', '1 week'),
        plus('2w', '+ 2 weeks', '2 weeks'),
        plus('4w', '+ 4 weeks', '4 weeks'),
        plus('1m', '+ 1 month', '1 month'),
        plus('3m', '+ 3 months', '3 months'),
        plus('6m', '+ 6 months', '6 months'),
        plus('1y', '+ 1 year', '1 year'),
      ],
    },
  ],
  template: '%date%',
};
