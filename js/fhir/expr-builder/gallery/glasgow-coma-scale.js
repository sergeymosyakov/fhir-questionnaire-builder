// Glasgow Coma Scale gallery pattern — see ../gallery/index.js for the shape.
// Components per Teasdale & Jennett 1974 (Lancet 2:81-84): eye 1-4, verbal 1-5,
// motor 1-6, total 3-15. Bands: 13-15 mild, 9-12 moderate, 3-8 severe.
export const glasgowComaScale = {
  id: 'glasgow-coma-scale',
  name: 'Glasgow Coma Scale',
  description: 'Adds the eye (1–4), verbal (1–5) and motor (1–6) responses and maps the total (3–15) to its severity band.',
  itemTypes: ['integer', 'decimal', 'quantity'],
  slots: [
    { key: 'eye', label: 'Eye response (1–4)', transforms: [] },
    { key: 'verbal', label: 'Verbal response (1–5)', transforms: [] },
    { key: 'motor', label: 'Motor response (1–6)', transforms: [] },
  ],
  template: '(%eye% + %verbal% + %motor%)',
  categories: [
    { lessThan: 9, label: 'Severe (GCS 3–8)' },
    { lessThan: 13, label: 'Moderate (GCS 9–12)' },
    { label: 'Mild (GCS 13–15)' },
  ],
};
