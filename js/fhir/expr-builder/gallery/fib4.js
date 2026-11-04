// FIB-4 liver fibrosis index gallery pattern — see ../gallery/index.js for the shape.
// age x AST / (platelets x sqrt(ALT)); cut-offs 1.3 / 2.67 per Shah et al. 2009
// (Clin Gastroenterol Hepatol 7:1104). Unrounded so a borderline value is categorised
// exactly; the age >= 65 adjusted cut-off (2.0) is not applied.
export const fib4 = {
  id: 'fib4',
  name: 'FIB-4 liver fibrosis index',
  description: 'Age × AST ÷ (platelets × √ALT), mapped to low / indeterminate / high risk of advanced fibrosis (cut-offs 1.3 and 2.67).',
  itemTypes: ['integer', 'decimal', 'quantity'],
  slots: [
    { key: 'age', label: 'Age in years item', transforms: [] },
    { key: 'ast', label: 'AST item (U/L)', transforms: [] },
    { key: 'alt', label: 'ALT item (U/L)', transforms: [] },
    { key: 'plt', label: 'Platelets item (×10⁹/L)', transforms: [] },
  ],
  template: '((%age% * %ast%) / (%plt% * %alt%.sqrt()))',
  categories: [
    { lessThan: 1.3, label: 'Low risk (< 1.3)' },
    { lessThan: 2.67, label: 'Indeterminate (1.3–2.67)' },
    { label: 'High risk (> 2.67)' },
  ],
};
