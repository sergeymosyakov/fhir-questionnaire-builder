// ── REDCap Data Dictionary CSV parser ─────────────────────────────────────────
// parseCSV(text) → Row[]
//
// Row shape (all fields are strings; empty string when column absent):
//   variable, form, sectionHeader, fieldType, fieldLabel, choices,
//   fieldNote, textValidation, textValidationMin, textValidationMax,
//   identifier, branchingLogic, required, alignment, questionNumber,
//   matrixGroup, matrixRanking, annotation
//
// Supports quoted fields (RFC 4180) and both \r\n / \n line endings.
// The header row is normalised before mapping — extra spaces, case, and
// non-breaking spaces are stripped so minor format variations parse cleanly.

/** Canonical column name → Row property key. */
const COLUMN_MAP = {
  'variable / field name':        'variable',
  'variable/field name':          'variable',
  'form name':                    'form',
  'section header':               'sectionHeader',
  'field type':                   'fieldType',
  'field label':                  'fieldLabel',
  'choices, calculations, or slider labels': 'choices',
  'choices':                      'choices',
  'field note':                   'fieldNote',
  'text validation type or show slider number': 'textValidation',
  'text validation type':         'textValidation',
  'text validation min':          'textValidationMin',
  'text validation max':          'textValidationMax',
  'identifier?':                  'identifier',
  'identifier':                   'identifier',
  'branching logic (show field only if...)': 'branchingLogic',
  'branching logic':              'branchingLogic',
  'required field?':              'required',
  'required':                     'required',
  'custom alignment':             'alignment',
  'question number (surveys only)': 'questionNumber',
  'question number':              'questionNumber',
  'matrix group name':            'matrixGroup',
  'matrix ranking?':              'matrixRanking',
  'matrix ranking':               'matrixRanking',
  'field annotation':             'annotation',
};

/** Parse a single RFC-4180 CSV line into an array of cell strings. */
function parseLine(line) {
  const cells = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } // escaped quote
        else inQuote = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuote = true;
      } else if (ch === ',') {
        cells.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
  }
  cells.push(cur);
  return cells;
}

/** Normalise a header cell string for lookup in COLUMN_MAP. */
function normaliseHeader(h) {
  return h
    .replace(/\u00a0/g, ' ')   // non-breaking space → regular space
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Parse REDCap Data Dictionary CSV text into an array of row objects.
 *
 * @param {string} text  Raw CSV file contents (UTF-8).
 * @returns {Array<object>} Row objects; unknown columns preserved as-is.
 */
export function parseCSV(text) {
  // Normalise line endings
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  // Skip completely blank lines at the top
  let start = 0;
  while (start < lines.length && lines[start].trim() === '') start++;
  if (start >= lines.length) return [];

  const headerCells = parseLine(lines[start]);
  const colIndex = {}; // property key → column index

  headerCells.forEach((h, i) => {
    const key = COLUMN_MAP[normaliseHeader(h)];
    if (key) colIndex[key] = i;
  });

  const rows = [];
  for (let li = start + 1; li < lines.length; li++) {
    const line = lines[li];
    if (line.trim() === '') continue;
    const cells = parseLine(line);

    const row = {
      variable:          '',
      form:              '',
      sectionHeader:     '',
      fieldType:         '',
      fieldLabel:        '',
      choices:           '',
      fieldNote:         '',
      textValidation:    '',
      textValidationMin: '',
      textValidationMax: '',
      identifier:        '',
      branchingLogic:    '',
      required:          '',
      alignment:         '',
      questionNumber:    '',
      matrixGroup:       '',
      matrixRanking:     '',
      annotation:        '',
    };

    for (const [key, idx] of Object.entries(colIndex)) {
      row[key] = (cells[idx] ?? '').trim();
    }

    // Skip rows without a variable name (e.g. trailing blank rows)
    if (row.variable) rows.push(row);
  }

  return rows;
}
