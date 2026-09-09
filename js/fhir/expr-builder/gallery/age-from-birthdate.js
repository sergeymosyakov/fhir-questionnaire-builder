// Age-from-birthdate gallery pattern — see ../gallery/index.js for the shape.
export const ageFromBirthdate = {
  id: 'age-from-birthdate',
  name: 'Age from birthdate (whole years)',
  description: 'Whole years since a birthdate item — correctly handles a birthday not yet reached this year.',
  itemTypes: ['date', 'dateTime'],
  slots: [
    { key: 'birthdate', label: 'Birthdate item', transforms: [] },
  ],
  // Verified against fhirpath.js directly (date - date has no direct year-diff
  // operator) — year-substring diff, minus 1 if this year's month/day hasn't
  // been reached yet.
  template: "(today().toString().substring(0,4).toInteger() - %birthdate%.toString().substring(0,4).toInteger()) - iif(today().toString().substring(5,10) < %birthdate%.toString().substring(5,10), 1, 0)",
};
