// ── REDCap Data Dictionary CSV validator ──────────────────────────────────────
// validateCSV(rows) → Issue[]
//
// Issue shape (same as FHIR validators): { severity, nodeId, message }
// nodeId = variable name of the offending row (or '' for structural issues).
//
// Checks:
//   1. Required columns present in the row set (structural)
//   2. Variable name format: /^[a-z][a-z0-9_]{0,25}$/ (REDCap limit 26 chars)
//   3. fieldType is one of the known REDCap types
//   4. choices required (and parseable) for radio/checkbox/dropdown
//   5. choices must NOT be present for non-choice types (warn)
//   6. calc field should have a non-empty choices/formula cell
//   7. Duplicate variable names

/** Known REDCap field types. */
export const REDCAP_FIELD_TYPES = new Set([
  'text', 'notes', 'radio', 'checkbox', 'dropdown',
  'yesno', 'truefalse', 'slider', 'file', 'calc',
  'descriptive', 'sql',
]);

const CHOICE_TYPES = new Set(['radio', 'checkbox', 'dropdown']);

/** Regex for a valid REDCap variable name. */
const VAR_RE = /^[a-z][a-z0-9_]{0,25}$/;

/**
 * Validate an array of parsed REDCap rows.
 *
 * @param {Array<object>} rows  Output of parseCSV().
 * @returns {Array<{severity:string, nodeId:string, message:string}>}
 */
export function validateCSV(rows) {
  const issues = [];

  if (!rows || rows.length === 0) {
    issues.push({ severity: 'error', nodeId: '', message: 'CSV contains no data rows.' });
    return issues;
  }

  // ── Check required fields are present in first row ──────────────────────
  const required = ['variable', 'form', 'fieldType', 'fieldLabel'];
  const missing = required.filter(k => rows[0][k] === undefined);
  if (missing.length > 0) {
    issues.push({
      severity: 'error', nodeId: '',
      message: `Missing required CSV columns: ${missing.join(', ')}. ` +
               'Expected a standard REDCap Data Dictionary export.',
    });
    // Can't do per-row checks without these columns
    return issues;
  }

  // ── Per-row checks ───────────────────────────────────────────────────────
  const seen = new Map(); // variable → first line number (1-based)

  rows.forEach((row, i) => {
    const lineNum = i + 2; // +1 for 0-index, +1 for header row
    const id = row.variable || `(row ${lineNum})`;

    // Variable name format
    if (row.variable && !VAR_RE.test(row.variable)) {
      issues.push({
        severity: 'error', nodeId: id,
        message: `Row ${lineNum}: variable name "${row.variable}" is invalid. ` +
                 'Must start with a lowercase letter and contain only [a-z0-9_], max 26 chars.',
      });
    }

    // Duplicate variable names
    if (row.variable) {
      if (seen.has(row.variable)) {
        issues.push({
          severity: 'error', nodeId: id,
          message: `Row ${lineNum}: duplicate variable name "${row.variable}" ` +
                   `(first defined at row ${seen.get(row.variable)}).`,
        });
      } else {
        seen.set(row.variable, lineNum);
      }
    }

    // Unknown field type
    if (row.fieldType && !REDCAP_FIELD_TYPES.has(row.fieldType)) {
      issues.push({
        severity: 'warning', nodeId: id,
        message: `Row ${lineNum}: unknown field type "${row.fieldType}" — will be imported as text.`,
      });
    }

    // Choice types require non-empty choices
    if (CHOICE_TYPES.has(row.fieldType) && !row.choices.trim()) {
      issues.push({
        severity: 'error', nodeId: id,
        message: `Row ${lineNum}: field type "${row.fieldType}" requires choices but none provided.`,
      });
    }

    // Calc should have a formula
    if (row.fieldType === 'calc' && !row.choices.trim()) {
      issues.push({
        severity: 'warning', nodeId: id,
        message: `Row ${lineNum}: calc field "${row.variable}" has no formula — will be imported as a plain decimal field.`,
      });
    }

    // Choices present for non-choice type (informational)
    if (row.choices.trim() && !CHOICE_TYPES.has(row.fieldType) && row.fieldType !== 'calc' && row.fieldType !== 'slider') {
      issues.push({
        severity: 'warning', nodeId: id,
        message: `Row ${lineNum}: choices/formula column is non-empty for field type "${row.fieldType}" — value will be stored in annotation for round-trip but ignored by REDCap logic.`,
      });
    }
  });

  return issues;
}
