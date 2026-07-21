// ── Unit tests: REDCap → FHIR and FHIR → REDCap conversion ───────────────────
import { describe, it, expect } from 'vitest';
import { parseCSV } from '../js/fhir/converters/redcap/parse-csv.js';
import { toFHIR }   from '../js/fhir/converters/redcap/to-fhir.js';
import { fromFHIR } from '../js/fhir/converters/redcap/from-fhir.js';
import { FHIR } from '../js/fhir/urls/fhir.js';
import { APP_URL } from '../js/fhir/urls/app.js';

// ── Minimal CSV builder ───────────────────────────────────────────────────────
const H = 'Variable / Field Name,Form Name,Section Header,Field Type,Field Label,"Choices, Calculations, OR Slider Labels",Field Note,Text Validation Type OR Show Slider Number,Text Validation Min,Text Validation Max,Identifier?,Branching Logic (Show field only if...),Required Field?,Custom Alignment,Question Number (surveys only),Matrix Group Name,Matrix Ranking?,Field Annotation';

function mkrow(variable, form, fieldType, fieldLabel, choices = '', opts = {}) {
  const o = {
    sec: '', note: '', valid: '', vmin: '', vmax: '', ident: '',
    branch: '', req: '', align: '', qnum: '', matrix: '', mrank: '', ann: '',
    ...opts,
  };
  const cell = v => (String(v).includes(',') || String(v).includes('"'))
    ? '"' + String(v).replace(/"/g, '""') + '"'
    : String(v);
  return [variable, form, o.sec, fieldType, fieldLabel, cell(choices),
    o.note, o.valid, o.vmin, o.vmax, o.ident, o.branch, o.req,
    o.align, o.qnum, o.matrix, o.mrank, o.ann].join(',');
}

function make(rows) {
  return toFHIR(parseCSV([H, ...rows].join('\n')));
}

// ── toFHIR ────────────────────────────────────────────────────────────────────

describe('toFHIR', () => {
  it('produces a valid Questionnaire resource', () => {
    const q = make([mkrow('age', 'demo', 'text', 'Age')]);
    expect(q.resourceType).toBe('Questionnaire');
    expect(q.status).toBe('draft');
    expect(Array.isArray(q.item)).toBe(true);
  });

  it('wraps form fields in a group item', () => {
    const q = make([mkrow('age', 'demographics', 'text', 'Age')]);
    const group = q.item[0];
    expect(group.type).toBe('group');
    expect(group.text).toBe('demographics');
    expect(group.item[0].linkId).toBe('age');
  });

  it('maps text → string type', () => {
    const q = make([mkrow('name', 'f', 'text', 'Name')]);
    expect(q.item[0].item[0].type).toBe('string');
  });

  it('maps notes → text type', () => {
    const q = make([mkrow('desc', 'f', 'notes', 'Description')]);
    expect(q.item[0].item[0].type).toBe('text');
  });

  it('maps radio → choice with answerOption', () => {
    const q = make([mkrow('gender', 'f', 'radio', 'Gender', '1, Male | 2, Female')]);
    const item = q.item[0].item[0];
    expect(item.type).toBe('choice');
    expect(item.repeats).toBeUndefined();
    expect(item.answerOption).toHaveLength(2);
    expect(item.answerOption[0].valueCoding.code).toBe('1');
    expect(item.answerOption[0].valueCoding.display).toBe('Male');
  });

  it('maps checkbox → choice with repeats:true', () => {
    const q = make([mkrow('symptoms', 'f', 'checkbox', 'Symptoms', '1, Fever | 2, Cough')]);
    const item = q.item[0].item[0];
    expect(item.type).toBe('choice');
    expect(item.repeats).toBe(true);
  });

  it('maps yesno → boolean', () => {
    const q = make([mkrow('consent', 'f', 'yesno', 'Consent')]);
    expect(q.item[0].item[0].type).toBe('boolean');
  });

  it('maps slider → integer with itemControl extension', () => {
    const q = make([mkrow('pain', 'f', 'slider', 'Pain Scale')]);
    const item = q.item[0].item[0];
    expect(item.type).toBe('integer');
    const ctrl = item.extension?.find(e =>
      e.url === FHIR.itemControl);
    expect(ctrl?.valueCodeableConcept?.coding?.[0]?.code).toBe('slider');
  });

  it('maps file → attachment', () => {
    const q = make([mkrow('doc', 'f', 'file', 'Document')]);
    expect(q.item[0].item[0].type).toBe('attachment');
  });

  it('maps descriptive → display', () => {
    const q = make([mkrow('intro', 'f', 'descriptive', 'Introduction text')]);
    expect(q.item[0].item[0].type).toBe('display');
  });

  it('maps calc → decimal with calc-expression extension', () => {
    const q = make([mkrow('total', 'f', 'calc', 'Total', '[a] + [b]')]);
    const item = q.item[0].item[0];
    expect(item.type).toBe('decimal');
    const ext = item.extension?.find(e => e.url === APP_URL.redcapNs + 'calc-expression');
    expect(ext?.valueString).toBe('[a] + [b]');
  });

  it('sets required: true when required = y', () => {
    const q = make([mkrow('age', 'f', 'text', 'Age', '', { req: 'y' })]);
    expect(q.item[0].item[0].required).toBe(true);
  });

  it('converts branching logic to enableWhen', () => {
    const q = make([mkrow('q2', 'f', 'text', 'Q2', '', { branch: "[q1] = '1'" })]);
    const item = q.item[0].item[0];
    expect(item.enableWhen).toHaveLength(1);
    expect(item.enableWhen[0].question).toBe('q1');
  });

  it('stores unconvertible branching logic as extension', () => {
    // Mixed AND/OR is too complex to convert
    const q = make([mkrow('q2', 'f', 'text', 'Q2', '', { branch: "[a] = '1' AND [b] = '2' OR [c] = '3'" })]);
    const item = q.item[0].item[0];
    const ext = item.extension?.find(e => e.url === APP_URL.redcapNs + 'branching-logic');
    expect(ext?.valueString).toContain('AND');
  });

  it('maps text validation integer → integer FHIR type', () => {
    const q = make([mkrow('age', 'f', 'text', 'Age', '', { valid: 'integer' })]);
    expect(q.item[0].item[0].type).toBe('integer');
  });

  it('maps text validation date_ymd → date FHIR type', () => {
    const q = make([mkrow('dob', 'f', 'text', 'DOB', '', { valid: 'date_ymd' })]);
    expect(q.item[0].item[0].type).toBe('date');
  });

  it('sets min/max value extensions', () => {
    const q = make([mkrow('age', 'f', 'text', 'Age', '', { valid: 'integer', vmin: '0', vmax: '120' })]);
    const item = q.item[0].item[0];
    const minExt = item.extension?.find(e => e.url === FHIR.minValue);
    const maxExt = item.extension?.find(e => e.url === FHIR.maxValue);
    expect(minExt?.valueInteger).toBe(0);
    expect(maxExt?.valueInteger).toBe(120);
  });

  it('groups multiple forms into separate root groups', () => {
    const q = make([
      mkrow('q1', 'form_a', 'text', 'Q1'),
      mkrow('q2', 'form_b', 'text', 'Q2'),
    ]);
    expect(q.item).toHaveLength(2);
    expect(q.item[0].item[0].linkId).toBe('q1');
    expect(q.item[1].item[0].linkId).toBe('q2');
  });

  it('groups section header fields into nested group', () => {
    const rows = parseCSV([H,
      'q1,form1,My Section,text,Q1,,,,,,,,,,,,, ',
      'q2,form1,My Section,text,Q2,,,,,,,,,,,,, ',
    ].join('\n'));
    const q = toFHIR(rows);
    const form = q.item[0];
    const section = form.item[0];
    expect(section.type).toBe('group');
    expect(section.text).toBe('My Section');
    expect(section.item).toHaveLength(2);
  });

  it('stores annotation as extension', () => {
    const q = make([mkrow('q1', 'f', 'text', 'Q1', '', { ann: '@HIDDEN' })]);
    const ext = q.item[0].item[0].extension?.find(e => e.url === APP_URL.redcapNs + 'annotation');
    expect(ext?.valueString).toBe('@HIDDEN');
  });
});

// ── fromFHIR ──────────────────────────────────────────────────────────────────

describe('fromFHIR', () => {
  it('returns a string with the header row', () => {
    const csv = fromFHIR({ resourceType: 'Questionnaire', item: [] });
    expect(typeof csv).toBe('string');
    expect(csv).toContain('Variable / Field Name');
  });

  it('exports a simple questionnaire to CSV', () => {
    const q = {
      resourceType: 'Questionnaire',
      item: [{
        linkId: 'my_form', text: 'My Form', type: 'group',
        extension: [{ url: APP_URL.redcapNs + 'form-name', valueString: 'My Form' }],
        item: [{
          linkId: 'age', text: 'Age', type: 'string',
        }],
      }],
    };
    const csv = fromFHIR(q);
    expect(csv).toContain('age');
    expect(csv).toContain('My Form');
    expect(csv).toContain('text');
  });

  it('exports boolean as yesno', () => {
    const q = {
      resourceType: 'Questionnaire',
      item: [{ linkId: 'f', text: 'F', type: 'group',
        extension: [{ url: APP_URL.redcapNs + 'form-name', valueString: 'f' }],
        item: [{ linkId: 'ok', text: 'OK?', type: 'boolean' }],
      }],
    };
    const csv = fromFHIR(q);
    expect(csv).toContain('yesno');
  });

  it('exports answerOption as choices string', () => {
    const q = {
      resourceType: 'Questionnaire',
      item: [{ linkId: 'f', text: 'F', type: 'group',
        extension: [{ url: APP_URL.redcapNs + 'form-name', valueString: 'f' }],
        item: [{
          linkId: 'gender', text: 'Gender', type: 'choice',
          answerOption: [
            { valueCoding: { code: '1', display: 'Male' } },
            { valueCoding: { code: '2', display: 'Female' } },
          ],
        }],
      }],
    };
    const csv = fromFHIR(q);
    expect(csv).toContain('1, Male');
    expect(csv).toContain('2, Female');
  });

  it('exports required field with y', () => {
    const q = {
      resourceType: 'Questionnaire',
      item: [{ linkId: 'f', text: 'F', type: 'group',
        extension: [{ url: APP_URL.redcapNs + 'form-name', valueString: 'f' }],
        item: [{ linkId: 'name', text: 'Name', type: 'string', required: true }],
      }],
    };
    const csv = fromFHIR(q);
    const dataLine = csv.split('\r\n')[1];
    // Required Field? column (index 12) should be 'y'
    const cols = dataLine.split(',');
    expect(cols[12]).toBe('y');
  });
});

// ── Round-trip ────────────────────────────────────────────────────────────────

describe('round-trip: CSV → FHIR → CSV', () => {
  it('preserves variable names and field types', () => {
    const originalCsv = [H,
      mkrow('age', 'demo', 'text', 'Age', '', { valid: 'integer' }),
      mkrow('gender', 'demo', 'radio', 'Gender', '1, Male | 2, Female'),
      mkrow('consent', 'demo', 'yesno', 'Consent', '', { req: 'y' }),
    ].join('\n');

    const rows = parseCSV(originalCsv);
    const fhir = toFHIR(rows);
    const backCsv = fromFHIR(fhir);

    expect(backCsv).toContain('age');
    expect(backCsv).toContain('gender');
    expect(backCsv).toContain('consent');
    expect(backCsv).toContain('1, Male');
    expect(backCsv).toContain('2, Female');
  });

  it('preserves annotation round-trip via extension', () => {
    const originalCsv = [H,
      mkrow('q1', 'f', 'text', 'Q1', '', { ann: '@HIDDEN' }),
    ].join('\n');

    const fhir = toFHIR(parseCSV(originalCsv));
    const backCsv = fromFHIR(fhir);
    expect(backCsv).toContain('@HIDDEN');
  });

  it('preserves branching logic round-trip', () => {
    const branch = "[q1] = '1'";
    const originalCsv = [H,
      mkrow('q1', 'f', 'radio', 'Q1', '1, Yes | 2, No'),
      mkrow('q2', 'f', 'text', 'Q2', '', { branch }),
    ].join('\n');

    const fhir = toFHIR(parseCSV(originalCsv));
    const backCsv = fromFHIR(fhir);
    expect(backCsv).toContain(branch);
  });
});
