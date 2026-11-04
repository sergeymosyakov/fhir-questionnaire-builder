// Age in whole months gallery pattern — see ../gallery/index.js for the shape.
// Month-substring arithmetic (no date-difference operator in FHIRPath); one month
// is dropped while the day of month has not been reached.
export const ageInMonths = {
  id: 'age-in-months',
  name: 'Age in months at a date',
  description: 'Whole months between a birthdate and another date item — for infant and paediatric questionnaires.',
  itemTypes: ['date', 'dateTime'],
  slots: [
    { key: 'birth', label: 'Birthdate item', transforms: [] },
    { key: 'at', label: 'Date to measure age at', transforms: [] },
  ],
  template: "(((%at%.toString().substring(0,4).toInteger() - %birth%.toString().substring(0,4).toInteger()) * 12) + (%at%.toString().substring(5,2).toInteger() - %birth%.toString().substring(5,2).toInteger()) - iif(%at%.toString().substring(8,2).toInteger() < %birth%.toString().substring(8,2).toInteger(), 1, 0))",
};
