// ── FHIR R4 Questionnaire → REDCap Data Dictionary CSV ───────────────────────
//
// fromFHIR(questJson) → CSV text string (ready for download / file write)
//
// Strategy:
//   1. If item has extension[redcap/*] — use original REDCap values (exact round-trip).
//   2. Otherwise — best-effort conversion from FHIR semantics.
//
// Flat structure:
//   - Group items → form name (top-level group) or section header (nested group)
//   - Item items → data dictionary rows
//   - Groups nested deeper than 2 levels → flattened with a warning comment in fieldLabel

import { enableWhenToBranching } from './branching-logic.js';
import { FHIR } from '../../urls/fhir.js';
import { APP_URL } from '../../urls/app.js';

const RC         = APP_URL.redcapNs;
const ITEM_CTRL  = FHIR.itemControl;
const MIN_VAL    = FHIR.minValue;
const MAX_VAL    = FHIR.maxValue;
const CALC_EXPR  = FHIR.calculatedExpression;

// CSV column headers (standard REDCap order)
const HEADERS = [
  'Variable / Field Name',
  'Form Name',
  'Section Header',
  'Field Type',
  'Field Label',
  'Choices, Calculations, OR Slider Labels',
  'Field Note',
  'Text Validation Type OR Show Slider Number',
  'Text Validation Min',
  'Text Validation Max',
  'Identifier?',
  'Branching Logic (Show field only if...)',
  'Required Field?',
  'Custom Alignment',
  'Question Number (surveys only)',
  'Matrix Group Name',
  'Matrix Ranking?',
  'Field Annotation',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Find first extension value by URL suffix (redcap namespace). */
function rcExt(extensions, key) {
  if (!extensions) return undefined;
  const url = RC + key;
  const found = extensions.find(e => e.url === url);
  if (!found) return undefined;
  // Return first value* property
  for (const k of Object.keys(found)) {
    if (k.startsWith('value')) return found[k];
  }
  return undefined;
}

/** Find extension by full URL. */
function getExt(extensions, url) {
  return (extensions || []).find(e => e.url === url);
}

/** Escape a CSV cell — wrap in quotes if it contains comma, quote, or newline. */
function csvCell(val) {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/** Serialise one Row dict to a CSV line. */
function rowToLine(r) {
  return HEADERS.map(h => csvCell(r[h] ?? '')).join(',');
}

/** Convert FHIR item type + context to REDCap field type. */
function fhirTypeToRedcap(item) {
  // Check itemControl for dropdown / slider
  const ctrl = getExt(item.extension, ITEM_CTRL);
  const ctrlCode = ctrl?.valueCodeableConcept?.coding?.[0]?.code;
  if (ctrlCode === 'drop-down') return 'dropdown';
  if (ctrlCode === 'slider')    return 'slider';

  // Check calc expression
  if (getExt(item.extension, CALC_EXPR)) return 'calc';

  switch (item.type) {
    case 'string':     return 'text';
    case 'text':       return 'notes';
    case 'integer':    return 'text';   // with text validation = integer
    case 'decimal':    return 'text';   // with text validation = number
    case 'date':       return 'text';   // with text validation = date_ymd
    case 'dateTime':   return 'text';
    case 'time':       return 'text';
    case 'boolean':    return 'yesno';
    case 'choice':     return item.repeats ? 'checkbox' : 'radio';
    case 'attachment': return 'file';
    case 'display':    return 'descriptive';
    default:           return 'text';
  }
}

/** Map FHIR item type to REDCap text validation type. */
function fhirTypeToValidation(item) {
  switch (item.type) {
    case 'integer':  return 'integer';
    case 'decimal':  return 'number';
    case 'date':     return 'date_ymd';
    case 'dateTime': return 'datetime_ymd';
    case 'time':     return 'time';
    default:         return '';
  }
}

/** Serialise answerOption[] → "code, display | code, display" */
function choicesToRedcap(answerOption) {
  if (!answerOption || answerOption.length === 0) return '';
  return answerOption.map(o => {
    if (o.valueCoding) {
      const code    = o.valueCoding.code    || '';
      const display = o.valueCoding.display || o.valueCoding.code || '';
      return `${code}, ${display}`;
    }
    if (o.valueString !== undefined) return `${o.valueString}, ${o.valueString}`;
    if (o.valueInteger !== undefined) return `${o.valueInteger}, ${o.valueInteger}`;
    return '';
  }).filter(Boolean).join(' | ');
}

/** Get numeric extension value (minValue / maxValue). */
function numExt(extensions, url) {
  const e = getExt(extensions, url);
  if (!e) return '';
  for (const k of Object.keys(e)) {
    if (k.startsWith('value')) return String(e[k]);
  }
  return '';
}

/**
 * Flatten a FHIR item tree into REDCap row dicts.
 *
 * @param {Array}  items       FHIR item array.
 * @param {string} formName    Current form name.
 * @param {string} sectionHdr  Current section header.
 * @param {Array}  out         Accumulator.
 * @param {number} depth       Nesting depth (0 = root call).
 */
function flattenItems(items, formName, sectionHdr, out, depth = 0) {
  for (const item of items || []) {
    if (item.type === 'group') {
      // Top-level group → form name
      // Nested group → section header
      // Deeper → flatten with label prefix
      const rcFormName   = rcExt(item.extension, 'form-name')    || item.text || item.linkId;
      const rcSectionHdr = rcExt(item.extension, 'section-header') || '';

      if (depth === 0) {
        flattenItems(item.item, rcFormName, '', out, depth + 1);
      } else if (depth === 1) {
        const newSection = rcSectionHdr || (rcFormName !== formName ? item.text : '');
        flattenItems(item.item, formName, newSection, out, depth + 1);
      } else {
        // Deep nesting — flatten without creating a new form/section
        flattenItems(item.item, formName, sectionHdr, out, depth + 1);
      }
      continue;
    }

    // Determine if this item has REDCap round-trip data
    const hasRcExts = (item.extension || []).some(e => e.url.startsWith(RC));

    // ── Field type ─────────────────────────────────────────────────────────
    let fieldType;
    if (hasRcExts) {
      // Try to reconstruct original type from extensions
      const calcExpr = rcExt(item.extension, 'calc-expression');
      const sqlQuery = rcExt(item.extension, 'sql-query');
      if (calcExpr !== undefined)     fieldType = 'calc';
      else if (sqlQuery !== undefined) fieldType = 'sql';
      else                            fieldType = fhirTypeToRedcap(item);
    } else {
      fieldType = fhirTypeToRedcap(item);
    }

    // ── Choices / formula ──────────────────────────────────────────────────
    let choices;
    if (hasRcExts) {
      const calcExpr = rcExt(item.extension, 'calc-expression');
      const sqlQuery = rcExt(item.extension, 'sql-query');
      const sliderLbl = rcExt(item.extension, 'slider-labels');
      if (calcExpr !== undefined)      choices = calcExpr;
      else if (sqlQuery !== undefined)  choices = sqlQuery;
      else if (sliderLbl !== undefined) choices = sliderLbl;
      else                              choices = choicesToRedcap(item.answerOption);
    } else {
      // Best-effort
      const calcExtObj = getExt(item.extension, CALC_EXPR);
      if (calcExtObj?.valueExpression?.expression) {
        choices = calcExtObj.valueExpression.expression;
      } else {
        choices = choicesToRedcap(item.answerOption);
      }
    }

    // ── Branching logic ────────────────────────────────────────────────────
    let branchingLogic = '';
    if (hasRcExts) {
      branchingLogic = rcExt(item.extension, 'branching-logic') || '';
    } else if (item.enableWhen && item.enableWhen.length > 0) {
      branchingLogic = enableWhenToBranching(item.enableWhen, item.enableBehavior || 'all');
    }

    // ── Text validation ────────────────────────────────────────────────────
    const textValidation = hasRcExts ? '' : fhirTypeToValidation(item);
    const validationMin  = numExt(item.extension, MIN_VAL);
    const validationMax  = numExt(item.extension, MAX_VAL);

    // ── Other RC fields ────────────────────────────────────────────────────
    const annotation   = rcExt(item.extension, 'annotation')       ?? '';
    const matrixGroup  = rcExt(item.extension, 'matrix-group')      ?? '';
    const alignment    = rcExt(item.extension, 'alignment')         ?? '';
    const identFlag    = rcExt(item.extension, 'identifier')        ?? false;
    const fieldNote    = rcExt(item.extension, 'field-note')        ?? '';
    const qNum         = rcExt(item.extension, 'question-number')   ?? '';
    const matrixRanking = rcExt(item.extension, 'matrix-ranking')   ?? false;

    out.push({
      'Variable / Field Name':    item.linkId,
      'Form Name':                formName,
      'Section Header':           sectionHdr,
      'Field Type':               fieldType,
      'Field Label':              item.text || item.linkId,
      'Choices, Calculations, OR Slider Labels': choices,
      'Field Note':               fieldNote,
      'Text Validation Type OR Show Slider Number': textValidation,
      'Text Validation Min':      validationMin,
      'Text Validation Max':      validationMax,
      'Identifier?':              identFlag ? 'y' : '',
      'Branching Logic (Show field only if...)': branchingLogic,
      'Required Field?':          item.required ? 'y' : '',
      'Custom Alignment':         alignment,
      'Question Number (surveys only)': qNum,
      'Matrix Group Name':        matrixGroup,
      'Matrix Ranking?':          matrixRanking ? 'y' : '',
      'Field Annotation':         annotation,
    });
  }
}

/**
 * Convert a FHIR R4 Questionnaire JSON to a REDCap Data Dictionary CSV string.
 *
 * @param {object} questJson  FHIR Questionnaire resource.
 * @returns {string}          CSV text (UTF-8, CRLF line endings per REDCap convention).
 */
export function fromFHIR(questJson) {
  const rows = [];
  flattenItems(questJson.item || [], 'my_form', '', rows, 0);

  const lines = [HEADERS.map(csvCell).join(',')];
  for (const row of rows) lines.push(rowToLine(row));

  return lines.join('\r\n') + '\r\n';
}
