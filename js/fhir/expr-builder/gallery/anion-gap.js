// Serum anion gap gallery pattern — see ../gallery/index.js for the shape.
// AG = Na⁺ − (Cl⁻ + HCO₃⁻), all in mEq/L (the potassium-free form).
export const anionGap = {
  id: 'anion-gap',
  name: 'Serum anion gap',
  description: 'Na − (Cl + HCO₃), all in mEq/L — pick the three lab items.',
  source: 'Standard potassium-free form: Na − (Cl + HCO₃)',
  itemTypes: ['integer', 'decimal', 'quantity'],
  slots: [
    { key: 'na', label: 'Sodium item', transforms: [] },
    { key: 'cl', label: 'Chloride item', transforms: [] },
    { key: 'hco3', label: 'Bicarbonate item', transforms: [] },
  ],
  template: '(%na% - (%cl% + %hco3%))',
};
