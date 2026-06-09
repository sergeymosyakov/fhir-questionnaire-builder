// ── Unit tests: REDCap CSV parser & validator ─────────────────────────────────
import { describe, it, expect } from 'vitest';
import { parseCSV } from '../js/fhir/converters/redcap/parse-csv.js';
import { validateCSV } from '../js/fhir/converters/redcap/validate.js';

// ── Minimal CSV fixture helpers ───────────────────────────────────────────────

const HEADERS = 'Variable / Field Name,Form Name,Section Header,Field Type,Field Label,"Choices, Calculations, OR Slider Labels",Field Note,Text Validation Type OR Show Slider Number,Text Validation Min,Text Validation Max,Identifier?,Branching Logic (Show field only if...),Required Field?,Custom Alignment,Question Number (surveys only),Matrix Group Name,Matrix Ranking?,Field Annotation';

function csv(...rows) {
  return [HEADERS, ...rows].join('\n');
}

function row(variable, form, fieldType, fieldLabel, choices = '', opts = {}) {
  const o = {
    sectionHeader: '', fieldNote: '', textValidation: '', textValidationMin: '',
    textValidationMax: '', identifier: '', branchingLogic: '', required: '',
    alignment: '', questionNumber: '', matrixGroup: '', matrixRanking: '', annotation: '',
    ...opts,
  };
  // Quote any field that contains commas or double quotes
  const cell = v => (String(v).includes(',') || String(v).includes('"'))
    ? '"' + String(v).replace(/"/g, '""') + '"'
    : String(v);
  return [variable, form, o.sectionHeader, fieldType, fieldLabel, cell(choices),
    o.fieldNote, o.textValidation, o.textValidationMin, o.textValidationMax,
    o.identifier, o.branchingLogic, o.required, o.alignment, o.questionNumber,
    o.matrixGroup, o.matrixRanking, o.annotation].join(',');
}

// ── parseCSV ──────────────────────────────────────────────────────────────────

describe('parseCSV', () => {
  it('parses a minimal single-row CSV', () => {
    const rows = parseCSV(csv(row('age', 'demographics', 'text', 'Age')));
    expect(rows).toHaveLength(1);
    expect(rows[0].variable).toBe('age');
    expect(rows[0].form).toBe('demographics');
    expect(rows[0].fieldType).toBe('text');
    expect(rows[0].fieldLabel).toBe('Age');
  });

  it('parses multiple rows', () => {
    const rows = parseCSV(csv(
      row('age', 'demographics', 'text', 'Age'),
      row('gender', 'demographics', 'radio', 'Gender', '1, Male | 2, Female | 3, Other'),
    ));
    expect(rows).toHaveLength(2);
    expect(rows[1].choices).toBe('1, Male | 2, Female | 3, Other');
  });

  it('handles quoted cells with commas inside', () => {
    const rows = parseCSV(
      HEADERS + '\n' +
      'q1,form1,,radio,"Label, with comma","1, Yes | 2, No",,,,,,,,,,,'
    );
    expect(rows[0].fieldLabel).toBe('Label, with comma');
    expect(rows[0].choices).toBe('1, Yes | 2, No');
  });

  it('handles CRLF line endings', () => {
    const rows = parseCSV(HEADERS + '\r\n' + row('x', 'f', 'text', 'X') + '\r\n');
    expect(rows).toHaveLength(1);
    expect(rows[0].variable).toBe('x');
  });

  it('skips blank lines', () => {
    const rows = parseCSV(csv(row('a', 'f', 'text', 'A'), '', row('b', 'f', 'text', 'B')));
    expect(rows).toHaveLength(2);
  });

  it('returns empty array for header-only CSV', () => {
    expect(parseCSV(HEADERS)).toHaveLength(0);
  });

  it('returns empty array for empty string', () => {
    expect(parseCSV('')).toHaveLength(0);
  });

  it('parses required, branching logic, and identifier columns', () => {
    const rows = parseCSV(csv(
      row('consent', 'screening', 'yesno', 'Consent?', '', {
        required: 'y', branchingLogic: '[age] >= 18', identifier: 'y',
      })
    ));
    expect(rows[0].required).toBe('y');
    expect(rows[0].branchingLogic).toBe('[age] >= 18');
    expect(rows[0].identifier).toBe('y');
  });

  it('parses section header column', () => {
    const rows = parseCSV(
      HEADERS + '\n' +
      'q1,form1,My Section,text,Question 1,,,,,,,,,,,,,'
    );
    expect(rows[0].sectionHeader).toBe('My Section');
  });

  it('parses text validation min/max', () => {
    const rows = parseCSV(csv(
      row('age', 'demo', 'text', 'Age', '', {
        textValidation: 'integer', textValidationMin: '0', textValidationMax: '120',
      })
    ));
    expect(rows[0].textValidation).toBe('integer');
    expect(rows[0].textValidationMin).toBe('0');
    expect(rows[0].textValidationMax).toBe('120');
  });

  it('tolerates normalised header variants (extra spaces)', () => {
    const altHeaders = 'Variable / Field Name , Form Name , Section Header , Field Type , Field Label , Choices, Calculations, OR Slider Labels , Field Note , Text Validation Type OR Show Slider Number , Text Validation Min , Text Validation Max , Identifier? , Branching Logic (Show field only if...) , Required Field? , Custom Alignment , Question Number (surveys only) , Matrix Group Name , Matrix Ranking? , Field Annotation';
    const rows = parseCSV(altHeaders + '\n' + 'v1,f1,,text,Label 1,,,,,,,,,,,,, ');
    expect(rows[0].variable).toBe('v1');
  });
});

// ── validateCSV ───────────────────────────────────────────────────────────────

describe('validateCSV', () => {
  it('returns no issues for a valid row', () => {
    const rows = parseCSV(csv(row('age', 'demo', 'text', 'Age')));
    expect(validateCSV(rows)).toHaveLength(0);
  });

  it('returns error for empty rows array', () => {
    const issues = validateCSV([]);
    expect(issues[0].severity).toBe('error');
  });

  it('returns error for invalid variable name (uppercase)', () => {
    const rows = parseCSV(csv(row('Age', 'demo', 'text', 'Age')));
    const issues = validateCSV(rows);
    expect(issues.some(i => i.severity === 'error' && i.nodeId === 'Age')).toBe(true);
  });

  it('returns error for invalid variable name (starts with digit)', () => {
    const rows = parseCSV(csv(row('1age', 'demo', 'text', 'Age')));
    const issues = validateCSV(rows);
    expect(issues.some(i => i.severity === 'error')).toBe(true);
  });

  it('returns error for radio without choices', () => {
    const rows = parseCSV(csv(row('q1', 'f', 'radio', 'Q1', '')));
    const issues = validateCSV(rows);
    expect(issues.some(i => i.severity === 'error' && i.nodeId === 'q1')).toBe(true);
  });

  it('returns error for duplicate variable names', () => {
    const rows = parseCSV(csv(
      row('age', 'demo', 'text', 'Age'),
      row('age', 'demo', 'text', 'Age again'),
    ));
    const issues = validateCSV(rows);
    expect(issues.some(i => i.message.includes('duplicate'))).toBe(true);
  });

  it('returns warning for unknown field type', () => {
    const rows = parseCSV(csv(row('q1', 'f', 'unknown_type', 'Q1')));
    const issues = validateCSV(rows);
    expect(issues.some(i => i.severity === 'warning' && i.message.includes('unknown field type'))).toBe(true);
  });

  it('returns warning for calc without formula', () => {
    const rows = parseCSV(csv(row('total', 'f', 'calc', 'Total', '')));
    const issues = validateCSV(rows);
    expect(issues.some(i => i.severity === 'warning' && i.message.includes('calc'))).toBe(true);
  });

  it('accepts checkbox and dropdown with choices', () => {
    const rows = parseCSV(csv(
      row('cb', 'f', 'checkbox', 'CB', '1, A | 2, B'),
      row('dd', 'f', 'dropdown', 'DD', '1, A | 2, B'),
    ));
    expect(validateCSV(rows)).toHaveLength(0);
  });
});
