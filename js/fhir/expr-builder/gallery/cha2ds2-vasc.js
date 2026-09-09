// CHA2DS2-VASc stroke risk score gallery pattern — see ../gallery/index.js for
// the shape. Weights verified against Lip et al. 2010 (Chest 137:263-272):
// 1 point each for CHF/LV dysfunction, hypertension, diabetes, vascular
// disease, age 65-74, female sex; 2 points each for age >=75 and prior
// stroke/TIA/thromboembolism. Max 9. iif() on an unanswered (empty) boolean
// evaluates to the else-branch (0) — verified directly against fhirpath.js.
export const cha2ds2Vasc = {
  id: 'cha2ds2-vasc',
  name: 'CHA\u2082DS\u2082-VASc stroke risk score',
  description: 'Stroke risk score for atrial fibrillation \u2014 pick the yes/no item for each criterion (max 9 points).',
  itemTypes: ['boolean', 'checkbox'],
  slots: [
    { key: 'chf', label: 'Congestive heart failure / LV dysfunction (+1)', transforms: [] },
    { key: 'htn', label: 'Hypertension (+1)', transforms: [] },
    { key: 'age75', label: 'Age \u226575 (+2)', transforms: [] },
    { key: 'diabetes', label: 'Diabetes mellitus (+1)', transforms: [] },
    { key: 'strokeTia', label: 'Prior stroke/TIA/thromboembolism (+2)', transforms: [] },
    { key: 'vascular', label: 'Vascular disease (+1)', transforms: [] },
    { key: 'age65to74', label: 'Age 65\u201374 (+1)', transforms: [] },
    { key: 'female', label: 'Sex category female (+1)', transforms: [] },
  ],
  template: '(iif(%chf%, 1, 0) + iif(%htn%, 1, 0) + iif(%age75%, 2, 0) + iif(%diabetes%, 1, 0) + iif(%strokeTia%, 2, 0) + iif(%vascular%, 1, 0) + iif(%age65to74%, 1, 0) + iif(%female%, 1, 0))',
};
