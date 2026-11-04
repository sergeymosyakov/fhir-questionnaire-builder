// qSOFA gallery pattern — see ../gallery/index.js for the shape.
// Criteria per Singer et al. 2016 (JAMA 315:801-810, Sepsis-3): respiratory rate
// >=22/min, altered mentation, systolic BP <=100 mmHg; 2 or more is high risk.
// iif() on an unanswered (empty) boolean takes the else-branch (0).
export const qsofa = {
  id: 'qsofa',
  name: 'qSOFA sepsis screen',
  description: 'Counts the 3 qSOFA criteria that are present; 2 or more means high risk of poor outcome.',
  source: 'Singer et al. 2016 (Sepsis-3), JAMA 315:801',
  itemTypes: ['boolean', 'checkbox'],
  slots: [
    { key: 'resp', label: 'Respiratory rate ≥22/min', transforms: [] },
    { key: 'mentation', label: 'Altered mentation', transforms: [] },
    { key: 'sbp', label: 'Systolic BP ≤100 mmHg', transforms: [] },
  ],
  template: '(iif(%resp%, 1, 0) + iif(%mentation%, 1, 0) + iif(%sbp%, 1, 0))',
  categories: [
    { lessThan: 2, label: 'Lower risk' },
    { label: 'High risk' },
  ],
};
