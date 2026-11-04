// PHQ-2 depression screen gallery pattern — see ../gallery/index.js for the shape.
// Cutoff verified against Kroenke, Spitzer & Williams 2003 (Med Care 41:1284-1292):
// total 0-6, a score of 3 or more is a positive screen.
export const phq2Screen = {
  id: 'phq2-screen',
  name: 'PHQ-2 screen',
  description: 'Sums the 2 PHQ-2 items (each scored 0–3); a total of 3 or more is a positive depression screen.',
  source: 'Kroenke, Spitzer & Williams 2003, Med Care 41:1284',
  itemTypes: ['integer', 'decimal', 'quantity'],
  slots: [
    { key: 'q1', label: 'Q1 — little interest or pleasure', transforms: [] },
    { key: 'q2', label: 'Q2 — feeling down, depressed, hopeless', transforms: [] },
  ],
  template: '(%q1% + %q2%)',
  categories: [
    { lessThan: 3, label: 'Negative screen' },
    { label: 'Positive screen' },
  ],
};
