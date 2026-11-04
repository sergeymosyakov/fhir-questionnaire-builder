// Count of "Yes" answers gallery pattern — see ../gallery/index.js for the shape.
// Each row's single transform turns its boolean into 1/0; unanswered counts as 0
// (iif() on an empty condition takes the else-branch).
export const countYesAnswers = {
  id: 'count-yes-answers',
  name: 'Count of Yes answers',
  description: 'How many of the picked yes/no items are answered Yes — add one row per item.',
  source: 'Plain count of the picked items answered Yes',
  itemTypes: ['boolean', 'checkbox'],
  slots: [
    {
      key: 'items',
      label: 'Yes/no item',
      repeatable: true,
      min: 2,
      transforms: [{ id: 'yes', label: 'Counts 1 when Yes', template: 'iif(%value%, 1, 0)' }],
    },
  ],
  template: '%items%',
};
