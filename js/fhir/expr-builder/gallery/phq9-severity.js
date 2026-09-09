// PHQ-9 total + severity gallery pattern — see ../gallery/index.js for the shape.
// Cutoffs verified against Kroenke, Spitzer & Williams 2001 (J Gen Intern Med
// 16:606-613): 0-4 minimal, 5-9 mild, 10-14 moderate, 15-19 moderately severe,
// 20-27 severe.
export const phq9Severity = {
  id: 'phq9-severity',
  name: 'PHQ-9 total + severity',
  description: 'Sums the 9 PHQ-9 items (each scored 0\u20133) and maps the total to its depression severity band.',
  itemTypes: ['integer', 'decimal', 'quantity'],
  slots: [
    { key: 'q1', label: 'Q1 \u2014 little interest or pleasure', transforms: [] },
    { key: 'q2', label: 'Q2 \u2014 feeling down, depressed, hopeless', transforms: [] },
    { key: 'q3', label: 'Q3 \u2014 sleep trouble', transforms: [] },
    { key: 'q4', label: 'Q4 \u2014 tired / little energy', transforms: [] },
    { key: 'q5', label: 'Q5 \u2014 poor appetite or overeating', transforms: [] },
    { key: 'q6', label: 'Q6 \u2014 feeling bad about yourself', transforms: [] },
    { key: 'q7', label: 'Q7 \u2014 trouble concentrating', transforms: [] },
    { key: 'q8', label: 'Q8 \u2014 moving/speaking slowly, or restless', transforms: [] },
    { key: 'q9', label: 'Q9 \u2014 thoughts of self-harm', transforms: [] },
  ],
  template: '(%q1% + %q2% + %q3% + %q4% + %q5% + %q6% + %q7% + %q8% + %q9%)',
  categories: [
    { lessThan: 5, label: 'Minimal depression' },
    { lessThan: 10, label: 'Mild depression' },
    { lessThan: 15, label: 'Moderate depression' },
    { lessThan: 20, label: 'Moderately severe depression' },
    { label: 'Severe depression' },
  ],
};
