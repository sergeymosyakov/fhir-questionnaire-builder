// GAD-7 total + severity gallery pattern — see ../gallery/index.js for the shape.
// Cutoffs verified against Spitzer et al. 2006 (Arch Intern Med 166:1092-1097):
// 0-4 minimal, 5-9 mild, 10-14 moderate, 15-21 severe.
export const gad7Severity = {
  id: 'gad7-severity',
  name: 'GAD-7 total + severity',
  description: 'Sums the 7 GAD-7 items (each scored 0\u20133) and maps the total to its anxiety severity band.',
  itemTypes: ['integer', 'decimal', 'quantity'],
  slots: [
    { key: 'q1', label: 'Q1 \u2014 feeling nervous, anxious, on edge', transforms: [] },
    { key: 'q2', label: 'Q2 \u2014 unable to stop/control worrying', transforms: [] },
    { key: 'q3', label: 'Q3 \u2014 worrying too much', transforms: [] },
    { key: 'q4', label: 'Q4 \u2014 trouble relaxing', transforms: [] },
    { key: 'q5', label: 'Q5 \u2014 restless', transforms: [] },
    { key: 'q6', label: 'Q6 \u2014 easily annoyed/irritable', transforms: [] },
    { key: 'q7', label: 'Q7 \u2014 feeling afraid something awful might happen', transforms: [] },
  ],
  template: '(%q1% + %q2% + %q3% + %q4% + %q5% + %q6% + %q7%)',
  categories: [
    { lessThan: 5, label: 'Minimal anxiety' },
    { lessThan: 10, label: 'Mild anxiety' },
    { lessThan: 15, label: 'Moderate anxiety' },
    { label: 'Severe anxiety' },
  ],
};
