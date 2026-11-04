// Percent change gallery pattern — see ../gallery/index.js for the shape.
// A zero baseline divides to empty (no answer) rather than erroring.
export const percentChange = {
  id: 'percent-change',
  name: 'Percent change',
  description: '(new − baseline) ÷ baseline × 100, rounded to 1 decimal — e.g. weight change since the first visit.',
  source: 'Standard relative change: (new − baseline) ÷ baseline × 100',
  itemTypes: ['integer', 'decimal', 'quantity'],
  slots: [
    { key: 'baseline', label: 'Baseline value item', transforms: [] },
    { key: 'current', label: 'New value item', transforms: [] },
  ],
  template: '(((%current% - %baseline%) / %baseline%) * 100).round(1)',
};
