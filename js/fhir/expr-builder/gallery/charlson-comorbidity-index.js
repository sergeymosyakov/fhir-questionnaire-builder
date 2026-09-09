// Charlson Comorbidity Index gallery pattern — see ../gallery/index.js for the
// shape. Weights verified against Charlson et al. 1987 (J Chronic Dis 40:373-383)
// and the widely-used age-adjustment (Charlson/Deyo variant): 1 point each for
// MI, CHF, peripheral vascular disease, cerebrovascular disease, dementia,
// COPD, rheumatologic disease, peptic ulcer, mild liver disease, controlled
// diabetes; 2 each for hemiplegia/paraplegia, renal disease, uncontrolled
// diabetes, localized malignancy, leukemia, lymphoma; 3 for moderate/severe
// liver disease; 6 each for metastatic solid tumor and AIDS. Age bonus:
// +1/+2/+3/+4 per decade starting at 50 (verified against fhirpath.js).
//
// Uses a repeatable slot whose "transforms" are really "which condition is
// this row" (uniqueTransforms: true hides an already-used condition from
// every other row) — see README.md "Weighted condition lists".
const CONDITIONS = [
  ['mi', 'Myocardial infarction', 1],
  ['chf', 'Congestive heart failure', 1],
  ['pvd', 'Peripheral vascular disease', 1],
  ['cvd', 'Cerebrovascular disease', 1],
  ['dementia', 'Dementia', 1],
  ['copd', 'Chronic pulmonary disease', 1],
  ['rheum', 'Rheumatologic disease', 1],
  ['ulcer', 'Peptic ulcer disease', 1],
  ['liverMild', 'Liver disease \u2014 mild', 1],
  ['diabetesControlled', 'Diabetes \u2014 controlled', 1],
  ['hemiplegia', 'Hemiplegia or paraplegia', 2],
  ['renal', 'Renal disease', 2],
  ['diabetesUncontrolled', 'Diabetes \u2014 uncontrolled (end-organ damage)', 2],
  ['malignancyLocal', 'Malignancy \u2014 localized', 2],
  ['leukemia', 'Leukemia', 2],
  ['lymphoma', 'Lymphoma', 2],
  ['liverSevere', 'Liver disease \u2014 moderate/severe', 3],
  ['malignancyMets', 'Malignancy \u2014 metastatic', 6],
  ['aids', 'AIDS', 6],
];

export const charlsonComorbidityIndex = {
  id: 'charlson-comorbidity-index',
  name: 'Charlson Comorbidity Index',
  description: 'Add one row per comorbidity the patient has \u2014 each contributes its fixed weight (1\u20136), plus an automatic age-based bonus.',
  itemTypes: ['boolean', 'checkbox'],
  slots: [
    {
      key: 'conditions',
      label: 'Comorbidity present',
      repeatable: true,
      min: 1,
      uniqueTransforms: true,
      transforms: CONDITIONS.map(([id, label, weight]) => ({
        id,
        label: `${label} (+${weight})`,
        template: `iif(%value%, ${weight}, 0)`,
      })),
    },
    {
      key: 'age',
      label: 'Age (years)',
      itemTypes: ['integer', 'decimal'],
      transforms: [
        {
          id: 'age-bonus',
          label: 'Age-based bonus points',
          template: 'iif(%value% < 50, 0, iif(%value% < 60, 1, iif(%value% < 70, 2, iif(%value% < 80, 3, 4))))',
        },
      ],
    },
  ],
  template: '(%conditions% + %age%)',
};
