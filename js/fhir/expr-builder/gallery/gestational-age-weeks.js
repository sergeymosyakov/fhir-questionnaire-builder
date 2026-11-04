// Gestational age in weeks gallery pattern — see ../gallery/index.js for the shape.
// Completed weeks since the last menstrual period (the standard dating convention).
import { dayNumber } from './date-math.js';

export const gestationalAgeWeeks = {
  id: 'gestational-age-weeks',
  name: 'Gestational age (completed weeks)',
  description: 'Completed weeks from the last menstrual period to a visit date item.',
  source: 'Standard LMP dating (completed weeks since the first day of the last period)',
  itemTypes: ['date', 'dateTime'],
  slots: [
    { key: 'lmp', label: 'Last menstrual period item', transforms: [] },
    { key: 'at', label: 'Visit date item', transforms: [] },
  ],
  template: `((${dayNumber('%at%')} - ${dayNumber('%lmp%')}) div 7)`,
};
