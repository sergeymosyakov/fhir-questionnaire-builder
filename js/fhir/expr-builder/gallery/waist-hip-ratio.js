// Waist-to-hip ratio gallery pattern — see ../gallery/index.js for the shape.
export const waistHipRatio = {
  id: 'waist-hip-ratio',
  name: 'Waist-to-hip ratio',
  description: 'Waist circumference ÷ hip circumference (same unit), rounded to 2 decimals.',
  source: 'WHO Expert Consultation 2008, Waist circumference and waist–hip ratio (Geneva)',
  itemTypes: ['integer', 'decimal', 'quantity'],
  slots: [
    { key: 'waist', label: 'Waist circumference item', transforms: [] },
    { key: 'hip', label: 'Hip circumference item', transforms: [] },
  ],
  template: '(%waist% / %hip%).round(2)',
};
