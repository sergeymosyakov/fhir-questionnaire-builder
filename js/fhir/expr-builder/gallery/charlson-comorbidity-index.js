// Charlson Comorbidity Index gallery pattern — see ../gallery/index.js for the
// shape. Weights verified against Charlson et al. 1987 (J Chronic Dis 40:373-383)
// and the age adjustment of Charlson et al. 1994 (J Clin Epidemiol 47:1245):
// 1 point each for
// MI, CHF, peripheral vascular disease, cerebrovascular disease, dementia,
// COPD, rheumatologic disease, peptic ulcer, mild liver disease, uncomplicated
// diabetes; 2 each for hemiplegia/paraplegia, renal disease, diabetes with
// end-organ damage, localized malignancy, leukemia, lymphoma; 3 for moderate/severe
// liver disease; 6 each for metastatic solid tumor and AIDS. Age bonus:
// +1/+2/+3/+4 per decade starting at 50, capped at +4 from age 80 (verified against fhirpath.js).
//
// Uses a repeatable slot whose "transforms" are really "which condition is
// this row" (uniqueTransforms: true hides an already-used condition from
// every other row; tiers of one condition share a `group`, so only one tier
// can be picked) — see README.md "Weighted condition lists".
const CONDITIONS = [
  ['mi', 'Myocardial infarction', 1],
  ['chf', 'Congestive heart failure', 1],
  ['pvd', 'Peripheral vascular disease', 1],
  ['cvd', 'Cerebrovascular disease', 1],
  ['dementia', 'Dementia', 1],
  ['copd', 'Chronic pulmonary disease', 1],
  ['rheum', 'Rheumatologic disease', 1],
  ['ulcer', 'Peptic ulcer disease', 1],
  ['liverMild', 'Liver disease \u2014 mild', 1, 'liver'],
  ['diabetesControlled', 'Diabetes \u2014 uncomplicated', 1, 'diabetes'],
  ['hemiplegia', 'Hemiplegia or paraplegia', 2],
  ['renal', 'Renal disease', 2],
  ['diabetesUncontrolled', 'Diabetes \u2014 with end-organ damage', 2, 'diabetes'],
  ['malignancyLocal', 'Malignancy \u2014 localized', 2, 'malignancy'],
  ['leukemia', 'Leukemia', 2],
  ['lymphoma', 'Lymphoma', 2],
  ['liverSevere', 'Liver disease \u2014 moderate/severe', 3, 'liver'],
  ['malignancyMets', 'Malignancy \u2014 metastatic', 6, 'malignancy'],
  ['aids', 'AIDS', 6],
];

export const charlsonComorbidityIndex = {
  id: 'charlson-comorbidity-index',
  name: 'Charlson Comorbidity Index',
  description: 'Add one row per comorbidity the patient has \u2014 each contributes its fixed weight (1\u20136), plus an automatic age-based bonus.',
  source: 'Charlson et al. 1987, J Chronic Dis 40:373; age adjustment per Charlson et al. 1994, J Clin Epidemiol 47:1245',
  itemTypes: ['boolean', 'checkbox'],
  slots: [
    {
      key: 'conditions',
      label: 'Comorbidity present',
      repeatable: true,
      min: 1,
      uniqueTransforms: true,
      transforms: CONDITIONS.map(([id, label, weight, group]) => ({
        id,
        label: `${label} (+${weight})`,
        template: `iif(%value%, ${weight}, 0)`,
        ...(group ? { group } : {}),
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
          // No age gives no result: an empty comparison would otherwise fall through to the top band (+4).
          template: 'iif(%value%.exists(), iif(%value% < 50, 0, iif(%value% < 60, 1, iif(%value% < 70, 2, iif(%value% < 80, 3, 4)))), {})',
        },
      ],
    },
  ],
  template: '(%conditions% + %age%)',
};
