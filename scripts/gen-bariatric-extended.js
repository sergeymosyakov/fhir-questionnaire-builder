// Generator: Bariatric Surgery Pre-Authorization — Extended Assessment
const fs = require('fs');

const RADIO = {
  url: 'http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl',
  valueCodeableConcept: { coding: [{ system: 'http://hl7.org/fhir/questionnaire-item-control', code: 'radio-button' }] }
};

const calcExpr = expr => ({
  url: 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-calculatedExpression',
  valueExpression: { language: 'text/fhirpath', expression: expr }
});

const ewBool  = (q, val) => [{ question: q, operator: '=', answerBoolean: val }];
const ewStr   = (q, val) => [{ question: q, operator: '=', answerString: val }];

const q = {
  resourceType: 'Questionnaire',
  id: 'bariatric-pre-auth-extended',
  title: 'Bariatric Surgery Pre-Authorization — Extended Assessment',
  status: 'draft',
  subjectType: ['Patient'],
  date: '2026-05-08',
  description: 'Comprehensive prior authorization questionnaire for bariatric surgery candidates. Covers patient demographics, BMI calculation, comorbidities, prior treatment attempts, psychological assessment, medical clearances, and surgical preferences.',
  item: [

    // ── GROUP 1: Patient Information ─────────────────────────────────────────
    {
      linkId: 'g-patient', type: 'group', text: 'Patient Information',
      item: [
        { linkId: 'q-name',           type: 'string',  text: 'Full Legal Name',             required: true },
        { linkId: 'q-dob',            type: 'date',    text: 'Date of Birth',                required: true },
        {
          linkId: 'q-sex', type: 'choice', text: 'Biological Sex', required: true,
          extension: [RADIO],
          answerOption: [
            { valueCoding: { code: 'male',   display: 'Male'   } },
            { valueCoding: { code: 'female', display: 'Female' } },
            { valueCoding: { code: 'other',  display: 'Other'  } }
          ]
        },
        { linkId: 'q-height', type: 'decimal', text: 'Height (inches)', required: true },
        { linkId: 'q-weight', type: 'decimal', text: 'Current Weight (lbs)', required: true },
        {
          linkId: 'q-bmi', type: 'decimal', text: 'Calculated BMI (auto)', readOnly: true,
          extension: [calcExpr(
            "(%resource.item.where(linkId='g-patient').item.where(linkId='q-weight').answer.valueDecimal * 703) / " +
            "(%resource.item.where(linkId='g-patient').item.where(linkId='q-height').answer.valueDecimal * " +
            "%resource.item.where(linkId='g-patient').item.where(linkId='q-height').answer.valueDecimal)"
          )]
        },
        { linkId: 'q-phone',        type: 'string', text: 'Phone Number',        required: true  },
        { linkId: 'q-email',        type: 'string', text: 'Email Address'                        },
        { linkId: 'q-insurance-id', type: 'string', text: 'Insurance Member ID', required: true  },
        { linkId: 'q-insurance-grp',type: 'string', text: 'Insurance Group Number'               }
      ]
    },

    // ── GROUP 2: Weight History ──────────────────────────────────────────────
    {
      linkId: 'g-weight-history', type: 'group', text: 'Weight History',
      item: [
        { linkId: 'q-max-weight',    type: 'decimal',  text: 'Maximum Lifetime Weight (lbs)',           required: true },
        { linkId: 'q-max-weight-age',type: 'integer',  text: 'Age at Maximum Weight'                                   },
        { linkId: 'q-years-obese',   type: 'integer',  text: 'Years with BMI ≥ 35',                      required: true },
        {
          linkId: 'q-weight-trend', type: 'choice', text: 'Weight Trend (past 12 months)', required: true,
          extension: [RADIO],
          answerOption: [
            { valueCoding: { code: 'gaining', display: 'Gaining'  } },
            { valueCoding: { code: 'stable',  display: 'Stable'   } },
            { valueCoding: { code: 'losing',  display: 'Losing'   } }
          ]
        },
        { linkId: 'q-family-obesity',     type: 'boolean', text: 'Family history of obesity (first-degree relative)?' },
        { linkId: 'q-family-obesity-who', type: 'string',  text: 'Which family members?', enableWhen: ewBool('q-family-obesity', true) },
        { linkId: 'q-childhood-obesity',  type: 'boolean', text: 'Were you overweight as a child?'                    }
      ]
    },

    // ── GROUP 3: Comorbidities ───────────────────────────────────────────────
    {
      linkId: 'g-comorbidities', type: 'group', text: 'Comorbidities',
      item: [
        // Diabetes
        { linkId: 'q-has-diabetes', type: 'boolean', text: 'Type 2 Diabetes or Pre-diabetes?' },
        {
          linkId: 'q-diabetes-type', type: 'choice', text: 'Diabetes Classification',
          enableWhen: ewBool('q-has-diabetes', true),
          answerOption: [
            { valueCoding: { code: 'type2', display: 'Type 2 Diabetes' } },
            { valueCoding: { code: 'pre',   display: 'Pre-diabetes'    } },
            { valueCoding: { code: 'type1', display: 'Type 1 Diabetes' } }
          ]
        },
        { linkId: 'q-diabetes-hba1c', type: 'decimal', text: 'Most Recent HbA1c (%)',       enableWhen: ewBool('q-has-diabetes', true) },
        { linkId: 'q-diabetes-meds',  type: 'string',  text: 'Current Diabetes Medications', enableWhen: ewBool('q-has-diabetes', true) },

        // Hypertension
        { linkId: 'q-has-htn', type: 'boolean', text: 'Hypertension?' },
        { linkId: 'q-htn-bp',  type: 'string',  text: 'Most Recent Blood Pressure Reading', enableWhen: ewBool('q-has-htn', true) },
        { linkId: 'q-htn-meds',type: 'string',  text: 'Blood Pressure Medications',          enableWhen: ewBool('q-has-htn', true) },

        // Sleep apnea
        { linkId: 'q-has-sleep-apnea', type: 'boolean', text: 'Obstructive Sleep Apnea?' },
        {
          linkId: 'q-sleep-apnea-severity', type: 'choice', text: 'Severity',
          enableWhen: ewBool('q-has-sleep-apnea', true), extension: [RADIO],
          answerOption: [
            { valueCoding: { code: 'mild',     display: 'Mild'     } },
            { valueCoding: { code: 'moderate', display: 'Moderate' } },
            { valueCoding: { code: 'severe',   display: 'Severe'   } }
          ]
        },
        { linkId: 'q-uses-cpap', type: 'boolean', text: 'Currently using CPAP/BiPAP?', enableWhen: ewBool('q-has-sleep-apnea', true) },

        // Others
        { linkId: 'q-has-gerd',        type: 'boolean', text: 'GERD / Acid Reflux?'                                                    },
        { linkId: 'q-has-joint-pain',  type: 'boolean', text: 'Obesity-related joint pain or osteoarthritis?'                          },
        { linkId: 'q-joint-location',  type: 'string',  text: 'Affected joints',               enableWhen: ewBool('q-has-joint-pain', true) },
        { linkId: 'q-has-nafld',       type: 'boolean', text: 'Non-Alcoholic Fatty Liver Disease (NAFLD)?'                              },
        { linkId: 'q-has-depression',  type: 'boolean', text: 'Depression or Anxiety (diagnosed)?'                                      },
        { linkId: 'q-other-conditions',type: 'text',    text: 'Other significant medical conditions'                                    }
      ]
    },

    // ── GROUP 4: Prior Weight Loss Treatment ─────────────────────────────────
    {
      linkId: 'g-prior-treatment', type: 'group', text: 'Prior Weight Loss Treatment',
      item: [
        { linkId: 'q-diet-count',  type: 'integer', text: 'Number of supervised diet attempts (past 5 years)', required: true },
        { linkId: 'q-diet-months', type: 'integer', text: 'Total months of supervised diet participation',      required: true },

        { linkId: 'q-tried-meds', type: 'boolean', text: 'Tried prescription weight loss medications?' },
        { linkId: 'q-meds-list',  type: 'string',  text: 'Medications (name and duration)',                        enableWhen: ewBool('q-tried-meds', true) },
        {
          linkId: 'q-meds-outcome', type: 'choice', text: 'Medication outcome',
          enableWhen: ewBool('q-tried-meds', true), extension: [RADIO],
          answerOption: [
            { valueCoding: { code: 'no-effect',  display: 'No significant effect'          } },
            { valueCoding: { code: 'temporary',  display: 'Temporary loss, weight regained' } },
            { valueCoding: { code: 'side-effects', display: 'Stopped due to side effects'  } }
          ]
        },

        { linkId: 'q-tried-programs', type: 'boolean', text: 'Completed a medically supervised weight loss program?' },
        { linkId: 'q-programs-detail',type: 'text',    text: 'Program name, provider, dates',                         enableWhen: ewBool('q-tried-programs', true) },

        { linkId: 'q-prior-bariatric', type: 'boolean', text: 'Previous bariatric surgery?' },
        {
          linkId: 'q-prior-surgery-type', type: 'choice', text: 'Previous procedure',
          enableWhen: ewBool('q-prior-bariatric', true),
          answerOption: [
            { valueCoding: { code: 'band',   display: 'Adjustable Gastric Band'    } },
            { valueCoding: { code: 'sleeve', display: 'Sleeve Gastrectomy'         } },
            { valueCoding: { code: 'bypass', display: 'Roux-en-Y Gastric Bypass'   } },
            { valueCoding: { code: 'other',  display: 'Other'                      } }
          ]
        },
        { linkId: 'q-prior-surgery-date',         type: 'date',    text: 'Date of previous surgery',          enableWhen: ewBool('q-prior-bariatric',           true) },
        { linkId: 'q-prior-surgery-complication', type: 'boolean', text: 'Complications from previous surgery?', enableWhen: ewBool('q-prior-bariatric',        true) },
        { linkId: 'q-complication-detail',        type: 'text',    text: 'Describe complications',             enableWhen: ewBool('q-prior-surgery-complication', true) }
      ]
    },

    // ── GROUP 5: Psychological Assessment ────────────────────────────────────
    {
      linkId: 'g-psychological', type: 'group', text: 'Psychological Assessment',
      item: [
        { linkId: 'q-psych-done', type: 'boolean', text: 'Psychological evaluation completed?', required: true },
        { linkId: 'q-psych-date', type: 'date',    text: 'Evaluation date',                      enableWhen: ewBool('q-psych-done', true) },
        {
          linkId: 'q-psych-result', type: 'choice', text: 'Evaluation outcome',
          enableWhen: ewBool('q-psych-done', true), extension: [RADIO],
          answerOption: [
            { valueCoding: { code: 'cleared',     display: 'Cleared for surgery'               } },
            { valueCoding: { code: 'conditional', display: 'Cleared with conditions'            } },
            { valueCoding: { code: 'deferred',    display: 'Surgery deferred pending treatment' } }
          ]
        },
        { linkId: 'q-psych-conditions', type: 'string', text: 'Conditions or requirements noted', enableWhen: ewStr('q-psych-result', 'conditional') },
        { linkId: 'q-psych-report-url', type: 'url',    text: 'Link to psychological report',      enableWhen: ewBool('q-psych-done', true)           },

        { linkId: 'q-eating-disorder',           type: 'boolean', text: 'History of eating disorder (binge eating, bulimia, anorexia)?'    },
        { linkId: 'q-eating-disorder-type',      type: 'string',  text: 'Describe eating disorder history', enableWhen: ewBool('q-eating-disorder', true) },
        { linkId: 'q-eating-disorder-treatment', type: 'boolean', text: 'Received treatment for eating disorder?', enableWhen: ewBool('q-eating-disorder', true) },

        { linkId: 'q-substance-history',      type: 'boolean', text: 'History of substance use disorder?'      },
        { linkId: 'q-substance-detail',       type: 'string',  text: 'Substance(s) and last use date',         enableWhen: ewBool('q-substance-history', true) },
        { linkId: 'q-substance-free-months',  type: 'integer', text: 'Months since last use',                   enableWhen: ewBool('q-substance-history', true) },

        {
          linkId: 'q-support-system', type: 'choice', text: 'Primary support system', required: true,
          extension: [RADIO],
          answerOption: [
            { valueCoding: { code: 'spouse',        display: 'Spouse / Partner'  } },
            { valueCoding: { code: 'family',        display: 'Family members'    } },
            { valueCoding: { code: 'friends',       display: 'Friends'           } },
            { valueCoding: { code: 'support-group', display: 'Support group'     } },
            { valueCoding: { code: 'none',          display: 'None identified'   } }
          ]
        }
      ]
    },

    // ── GROUP 6: Medical Clearances ──────────────────────────────────────────
    {
      linkId: 'g-clearances', type: 'group', text: 'Medical Clearances',
      item: [
        { linkId: 'q-pcp-clearance',      type: 'boolean',    text: 'Primary Care Physician clearance obtained?', required: true },
        { linkId: 'q-pcp-name',           type: 'string',     text: 'PCP Name',                enableWhen: ewBool('q-pcp-clearance', true) },
        { linkId: 'q-pcp-date',           type: 'date',       text: 'PCP clearance date',      enableWhen: ewBool('q-pcp-clearance', true) },
        { linkId: 'q-pcp-doc',            type: 'attachment', text: 'Upload PCP clearance letter', enableWhen: ewBool('q-pcp-clearance', true) },

        { linkId: 'q-cardio-clearance',   type: 'boolean',    text: 'Cardiologist clearance obtained?'              },
        { linkId: 'q-cardio-name',        type: 'string',     text: 'Cardiologist Name',       enableWhen: ewBool('q-cardio-clearance', true) },
        { linkId: 'q-cardio-date',        type: 'date',       text: 'Cardiology clearance date', enableWhen: ewBool('q-cardio-clearance', true) },
        { linkId: 'q-cardio-doc',         type: 'attachment', text: 'Upload cardiology clearance', enableWhen: ewBool('q-cardio-clearance', true) },

        { linkId: 'q-endocrine-eval',     type: 'boolean',    text: 'Endocrinology evaluation completed?'           },
        { linkId: 'q-endocrine-date',     type: 'date',       text: 'Endocrinology evaluation date', enableWhen: ewBool('q-endocrine-eval', true) },

        { linkId: 'q-labs-date',          type: 'date',       text: 'Date of most recent comprehensive labs', required: true },
        { linkId: 'q-labs-doc',           type: 'attachment', text: 'Upload lab results'                              }
      ]
    },

    // ── GROUP 7: Surgery Preference & Authorization ──────────────────────────
    {
      linkId: 'g-surgery-auth', type: 'group', text: 'Surgery Preference & Authorization',
      item: [
        {
          linkId: 'q-procedure', type: 'choice', text: 'Preferred Surgical Procedure', required: true,
          extension: [RADIO],
          answerOption: [
            { valueCoding: { code: 'sleeve',          display: 'Sleeve Gastrectomy (VSG)'                               } },
            { valueCoding: { code: 'bypass',          display: 'Roux-en-Y Gastric Bypass (RYGB)'                        } },
            { valueCoding: { code: 'band',            display: 'Adjustable Gastric Band (AGB)'                          } },
            { valueCoding: { code: 'bpd-ds',         display: 'Biliopancreatic Diversion with Duodenal Switch (BPD/DS)' } }
          ]
        },
        {
          linkId: 'q-gerd-notice', type: 'display',
          text: '⚠️ Note: Sleeve gastrectomy may worsen GERD. Consider discussing Roux-en-Y Bypass with your surgeon.',
          enableWhen: ewStr('q-procedure', 'sleeve')
        },
        { linkId: 'q-preferred-hospital', type: 'string', text: 'Preferred Hospital or Surgery Center'      },
        { linkId: 'q-preferred-surgeon',  type: 'string', text: 'Preferred Surgeon Name'                    },
        { linkId: 'q-target-date',        type: 'date',   text: 'Target Surgery Date'                        },
        { linkId: 'q-auth-number',        type: 'string', text: 'Insurance Pre-Authorization Number', required: true },
        { linkId: 'q-auth-url',           type: 'url',    text: 'Insurance Authorization Portal URL'         },
        { linkId: 'q-auth-doc',           type: 'attachment', text: 'Upload Insurance Authorization Letter', required: true },
        { linkId: 'q-referral-doc',       type: 'attachment', text: 'Upload Physician Referral',             required: true },
        {
          linkId: 'q-consent', type: 'boolean',
          text: 'I confirm all information provided is accurate and complete to the best of my knowledge.',
          required: true,
          extension: [{ url: 'http://logicbuilder.example.org/extension/successValue', valueString: 'true' }]
        },
        { linkId: 'q-consent-date', type: 'date', text: 'Date of Acknowledgment', required: true }
      ]
    }
  ]
};

const out = 'sampledata/bariatric-extended.fhir.json';
fs.writeFileSync(out, JSON.stringify(q, null, 2));

function count(items){let n=0;for(const i of items||[]){n++;if(i.item)n+=count(i.item);}return n;}
function maxD(items,d=0){let m=d;for(const i of items||[])if(i.item)m=Math.max(m,maxD(i.item,d+1));return m;}
const ewCount=(JSON.stringify(q).match(/"enableWhen"/g)||[]).length;
console.log('Written:', out);
console.log('Groups:',       q.item.length);
console.log('Total items:',  count(q.item));
console.log('Max depth:',    maxD(q.item));
console.log('enableWhen:',   ewCount);
