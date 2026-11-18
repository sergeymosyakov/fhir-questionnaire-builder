// Apgar score gallery pattern — see ../gallery/index.js for the shape.
// Five criteria each scored 0-2 (Apgar 1953); total 0-10. Bands: ACOG Committee Opinion 644 (2015), defined for the
// 5-minute score in term and late-preterm infants: 7-10 reassuring, 4-6 moderately abnormal, 0-3 low.
export const apgarScore = {
  id: 'apgar-score',
  name: 'Apgar score',
  description: 'Sums the 5 Apgar criteria (each scored 0–2) and maps the total (0–10) to its band. The bands are defined for the 5-minute score.',
  source: 'Apgar 1953; bands: ACOG Committee Opinion No. 644, Obstet Gynecol 2015;126:e52 (5-minute score, term and late-preterm infants)',
  itemTypes: ['integer', 'decimal', 'quantity'],
  slots: [
    { key: 'appearance', label: 'Appearance — skin colour (0–2)', transforms: [] },
    { key: 'pulse', label: 'Pulse — heart rate (0–2)', transforms: [] },
    { key: 'grimace', label: 'Grimace — reflex irritability (0–2)', transforms: [] },
    { key: 'activity', label: 'Activity — muscle tone (0–2)', transforms: [] },
    { key: 'respiration', label: 'Respiration — breathing effort (0–2)', transforms: [] },
  ],
  template: '(%appearance% + %pulse% + %grimace% + %activity% + %respiration%)',
  categories: [
    { lessThan: 4, label: 'Low (0–3)' },
    { lessThan: 7, label: 'Moderately abnormal (4–6)' },
    { label: 'Reassuring (7–10)' },
  ],
};
