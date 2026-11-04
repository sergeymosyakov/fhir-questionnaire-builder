// Days between two dates gallery pattern — see ../gallery/index.js for the shape.
import { dayNumber } from './date-math.js';

export const daysBetweenDates = {
  id: 'days-between-dates',
  name: 'Days between two dates',
  description: 'Whole days from a start date item to an end date item — e.g. length of stay. Negative if the end is before the start.',
  source: 'Calendar day count (Gregorian calendar, leap years included)',
  itemTypes: ['date', 'dateTime'],
  slots: [
    { key: 'start', label: 'Start date item', transforms: [] },
    { key: 'end', label: 'End date item', transforms: [] },
  ],
  template: `(${dayNumber('%end%')} - ${dayNumber('%start%')})`,
};
