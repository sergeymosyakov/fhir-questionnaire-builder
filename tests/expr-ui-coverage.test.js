// @vitest-environment jsdom
// How much of the shipped calculations (templates + gallery) the visual value editor can show as blocks.
// The list below is exact on purpose: a calculation that stops being editable fails the test, and a newly editable one
// must be added here, so progress and regressions are both visible in review.
import { describe, it, expect } from 'vitest';
import { measureValueEditor } from './helpers/ui-coverage.js';

const RESHAPED = [];
const EDITABLE = [
  'gallery:bmi',
  'gallery:bmi-imperial',
  'gallery:bmi-category',
  'gallery:unit-convert',
  'gallery:gad7-severity',
  'gallery:phq9-severity',
  'gallery:cha2ds2-vasc',
  'gallery:percent-change',
  'gallery:phq2-screen',
  'gallery:glasgow-coma-scale',
  'gallery:apgar-score',
  'gallery:qsofa',
  'gallery:mean-arterial-pressure',
  'gallery:anion-gap',
  'gallery:corrected-calcium',
  'gallery:ldl-friedewald',
  'gallery:homa-ir',
  'gallery:ideal-body-weight',
  'gallery:waist-hip-ratio',
  'template:apgar-score#1',
  'template:apgar-score#2',
  'template:apgar-score#3',
  'template:apgar-score#4',
  'template:asq#1',
  'template:audit-c#1',
  'template:body-measurements#1',
  'template:body-measurements#2',
  'template:body-measurements#4',
  'template:body-measurements#5',
  'template:cardiac-measurements#1',
  'template:cha2ds2-vasc#1',
  'template:charlson-comorbidity-index#1',
  'template:chemistry-calculations#1',
  'template:chemistry-calculations#2',
  'template:chemistry-calculations#3',
  'template:gad-2#1',
  'template:gad-2#2',
  'template:gad-7#1',
  'template:gad-7#2',
  'template:gds-15#1',
  'template:gds-15#2',
  'template:glasgow-coma-scale#1',
  'template:glasgow-coma-scale#2',
  'template:lipid-panel#1',
  'template:pc-ptsd-5#1',
  'template:pc-ptsd-5#2',
  'template:phq-2#1',
  'template:phq-2#2',
  'template:phq-9#1',
  'template:phq-9#2',
  'template:qsofa#1',
  'template:qsofa#2',
];

describe('value editor coverage of the shipped calculations', () => {
  const m = measureValueEditor();

  it('every calculation that opens as blocks calculates the same when written back', () => {
    expect(m.changed).toEqual([]);
  });

  it('never opens a calculation as blocks that then cannot be written back', () => {
    expect(m.inconsistent).toEqual([]);
  });

  it('writes back the same text as the plain parse, except for these (same meaning, different shape)', () => {
    expect(m.reshaped).toEqual(RESHAPED);
  });

  it('opens exactly the expected calculations as blocks', () => {
    expect(m.editable.join('\n')).toBe(EDITABLE.join('\n'));
  });
});
