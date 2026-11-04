// Age at a given date gallery pattern — see ../gallery/index.js for the shape.
// Same year-substring method as age-from-birthdate.js (FHIRPath has no date-difference
// operator), with the reference date taken from an item instead of today().
export const ageAtDate = {
  id: 'age-at-date',
  name: 'Age at a date (whole years)',
  description: 'Whole years between a birthdate and another date item — e.g. age at the visit or at diagnosis.',
  itemTypes: ['date', 'dateTime'],
  slots: [
    { key: 'birth', label: 'Birthdate item', transforms: [] },
    { key: 'at', label: 'Date to measure age at', transforms: [] },
  ],
  template: "((%at%.toString().substring(0,4).toInteger() - %birth%.toString().substring(0,4).toInteger()) - iif(%at%.toString().substring(5,5) < %birth%.toString().substring(5,5), 1, 0))",
};
