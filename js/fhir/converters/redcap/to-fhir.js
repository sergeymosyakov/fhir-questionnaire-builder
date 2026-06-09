// ── REDCap Data Dictionary → FHIR R4 Questionnaire ───────────────────────────
//
// toFHIR(rows, opts) → FHIR Questionnaire JSON
//
// Structure:
//   Each unique "form" becomes a group item.
//   Within a form, "section headers" become nested group items.
//   Fields become item entries within their form/section.
//
// Round-trip extensions (namespace: http://fhir-qb.app/redcap/):
//   branching-logic   valueString  — original branching logic expression
//   calc-expression   valueString  — original calc formula
//   annotation        valueString  — field annotation
//   matrix-group      valueString  — matrix group name
//   alignment         valueCode    — custom alignment code
//   identifier        valueBoolean — identifier flag
//   field-note        valueString  — field note (for fields where it's not in _description)
//   form-name         valueString  — on root group: original REDCap form name
//   section-header    valueString  — on section group: original section header text
//
// Field type mapping:
//   text        → string (with text-validation sub-type adjustments)
//   notes       → text
//   radio       → choice  (repeats: false)
//   checkbox    → choice  (repeats: true)
//   dropdown    → choice  (repeats: false, itemControl: drop-down)
//   yesno       → boolean
//   truefalse   → boolean
//   slider      → integer (itemControl: slider)
//   file        → attachment
//   calc        → decimal (calculatedExpression when transpilable; always stores redcap/calc-expression for round-trip)
//   descriptive → display
//   sql         → choice  (stored as redcap/sql-query; options empty)

import { branchingToEnableWhen } from './branching-logic.js';
import { transpileCalc, canTranspile } from './calc-transpiler.js';

// Extension URLs
const RC = 'http://fhir-qb.app/redcap/';
const ITEM_CONTROL_URL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl';
const MIN_VALUE_URL    = 'http://hl7.org/fhir/StructureDefinition/minValue';
const MAX_VALUE_URL    = 'http://hl7.org/fhir/StructureDefinition/maxValue';
const CALC_EXPR_URL    = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-calculatedExpression';

/** Build an extension object. */
function ext(url, type, value) {
  return { url, [`value${type}`]: value };
}

/** Parse REDCap choices string "1, Label A | 2, Label B" → answerOption[]. */
function parseChoices(choices) {
  if (!choices || !choices.trim()) return [];
  return choices.split('|').map(part => {
    const comma = part.indexOf(',');
    if (comma === -1) {
      const code = part.trim();
      return { valueCoding: { code, display: code } };
    }
    const code    = part.slice(0, comma).trim();
    const display = part.slice(comma + 1).trim();
    return { valueCoding: { code, display } };
  }).filter(o => o.valueCoding.code !== '');
}

/** Map REDCap text validation type to FHIR item type. */
function textValidationToFhirType(tv) {
  switch ((tv || '').toLowerCase()) {
    case 'integer':           return 'integer';
    case 'number':
    case 'number_2dp':
    case 'number_1dp':        return 'decimal';
    case 'date_ymd':
    case 'date_mdy':
    case 'date_dmy':          return 'date';
    case 'datetime_ymd':
    case 'datetime_mdy':
    case 'datetime_dmy':
    case 'datetime_seconds_ymd': return 'dateTime';
    case 'time':              return 'time';
    case 'email':             return 'string';  // format validated client-side
    case 'phone':             return 'string';
    case 'zipcode':           return 'string';
    case 'alpha_only':        return 'string';
    default:                  return 'string';
  }
}

/** Build a FHIR item from a single REDCap row. */
function buildItem(row) {
  const extensions = [];

  // ── Determine FHIR type ──────────────────────────────────────────────────
  let fhirType;
  let repeats = false;
  let answerOption;

  switch (row.fieldType) {
    case 'text':
      fhirType = textValidationToFhirType(row.textValidation);
      break;
    case 'notes':
      fhirType = 'text';
      break;
    case 'radio':
      fhirType = 'choice';
      answerOption = parseChoices(row.choices);
      break;
    case 'checkbox':
      fhirType = 'choice';
      repeats = true;
      answerOption = parseChoices(row.choices);
      break;
    case 'dropdown':
      fhirType = 'choice';
      answerOption = parseChoices(row.choices);
      extensions.push(ext(ITEM_CONTROL_URL, 'CodeableConcept', {
        coding: [{ system: 'http://hl7.org/fhir/questionnaire-item-control', code: 'drop-down' }],
      }));
      break;
    case 'yesno':
    case 'truefalse':
      fhirType = 'boolean';
      break;
    case 'slider':
      fhirType = 'integer';
      extensions.push(ext(ITEM_CONTROL_URL, 'CodeableConcept', {
        coding: [{ system: 'http://hl7.org/fhir/questionnaire-item-control', code: 'slider' }],
      }));
      // Slider labels stored in choices → store as extension for round-trip
      if (row.choices.trim()) {
        extensions.push(ext(RC + 'slider-labels', 'String', row.choices));
      }
      break;
    case 'file':
      fhirType = 'attachment';
      break;
    case 'calc': {
      fhirType = 'decimal';
      // Always store original formula for lossless round-trip
      if (row.choices.trim()) {
        extensions.push(ext(RC + 'calc-expression', 'String', row.choices));
        // Attempt to transpile REDCap formula to FHIRPath
        if (canTranspile(row.choices)) {
          const fhirpath = transpileCalc(row.choices);
          if (fhirpath) {
            extensions.push({
              url: CALC_EXPR_URL,
              valueExpression: {
                language: 'text/fhirpath',
                expression: fhirpath,
              },
            });
          }
        }
      }
      break;
    }
    case 'descriptive':
      fhirType = 'display';
      break;
    case 'sql':
      fhirType = 'choice';
      // Can't execute SQL client-side; preserve for round-trip
      if (row.choices.trim()) {
        extensions.push(ext(RC + 'sql-query', 'String', row.choices));
      }
      break;
    default:
      fhirType = 'string';
  }

  // ── Min / Max values ─────────────────────────────────────────────────────
  if (row.textValidationMin && row.textValidationMin.trim()) {
    const minNum = Number(row.textValidationMin);
    if (!isNaN(minNum)) {
      const vtype = (fhirType === 'integer') ? 'Integer' : 'Decimal';
      extensions.push(ext(MIN_VALUE_URL, vtype, minNum));
    }
  }
  if (row.textValidationMax && row.textValidationMax.trim()) {
    const maxNum = Number(row.textValidationMax);
    if (!isNaN(maxNum)) {
      const vtype = (fhirType === 'integer') ? 'Integer' : 'Decimal';
      extensions.push(ext(MAX_VALUE_URL, vtype, maxNum));
    }
  }

  // ── Round-trip extensions ────────────────────────────────────────────────
  if (row.branchingLogic.trim()) {
    extensions.push(ext(RC + 'branching-logic', 'String', row.branchingLogic));
  }
  if (row.annotation.trim()) {
    extensions.push(ext(RC + 'annotation', 'String', row.annotation));
  }
  if (row.matrixGroup.trim()) {
    extensions.push(ext(RC + 'matrix-group', 'String', row.matrixGroup));
  }
  if (row.alignment.trim()) {
    extensions.push(ext(RC + 'alignment', 'Code', row.alignment));
  }
  if (row.identifier.trim() && row.identifier !== '0') {
    extensions.push(ext(RC + 'identifier', 'Boolean', true));
  }
  if (row.fieldNote.trim()) {
    extensions.push(ext(RC + 'field-note', 'String', row.fieldNote));
  }
  if (row.questionNumber.trim()) {
    extensions.push(ext(RC + 'question-number', 'String', row.questionNumber));
  }
  if (row.matrixRanking.trim()) {
    extensions.push(ext(RC + 'matrix-ranking', 'Boolean', row.matrixRanking !== '0'));
  }

  // ── enableWhen (branching logic) ─────────────────────────────────────────
  let enableWhen;
  let enableBehavior;
  if (row.branchingLogic.trim()) {
    const parsed = branchingToEnableWhen(row.branchingLogic);
    if (parsed) {
      enableWhen    = parsed.enableWhen;
      enableBehavior = parsed.enableBehavior;
    }
    // If null → too complex; original stored in extension above
  }

  // ── Build item object ────────────────────────────────────────────────────
  const item = {
    linkId: row.variable,
    text:   row.fieldLabel || row.variable,
    type:   fhirType,
  };

  if (row.required === 'y' || row.required === '1') item.required = true;
  if (repeats) item.repeats = true;
  if (answerOption && answerOption.length > 0) item.answerOption = answerOption;
  if (enableWhen && enableWhen.length > 0) {
    item.enableWhen = enableWhen;
    if (enableBehavior) item.enableBehavior = enableBehavior;
  }
  if (extensions.length > 0) item.extension = extensions;

  // ── _description (fieldNote as item.text prefix) ─────────────────────────
  // REDCap descriptive fields use fieldLabel as the display text
  // For display items there's no separate description field in FHIR — it's all in text

  return item;
}

/**
 * Convert parsed REDCap Data Dictionary rows to a FHIR R4 Questionnaire.
 *
 * @param {Array<object>} rows         Output of parseCSV().
 * @param {{ title?: string, status?: string }} [opts]
 * @returns {object}  FHIR Questionnaire JSON.
 */
export function toFHIR(rows, opts = {}) {
  const title  = opts.title  || 'REDCap Import';
  const status = opts.status || 'draft';

  // Group rows by form, preserving form order
  const formOrder = [];
  const formMap   = new Map(); // formName → { rows: Row[], sections: Map<header, Row[]> }

  for (const row of rows) {
    const formName = row.form || 'Unknown Form';
    if (!formMap.has(formName)) {
      formMap.set(formName, { rows: [], sections: new Map() });
      formOrder.push(formName);
    }
    formMap.get(formName).rows.push(row);
  }

  // Build FHIR item tree
  const rootItems = [];

  for (const formName of formOrder) {
    const { rows: formRows } = formMap.get(formName);

    // Build section sub-groups within the form
    const sectionOrder = [];
    const sectionMap = new Map(); // sectionHeader → Row[]
    const NO_SECTION = '\x00';

    for (const row of formRows) {
      const header = row.sectionHeader.trim() || NO_SECTION;
      if (!sectionMap.has(header)) {
        sectionMap.set(header, []);
        sectionOrder.push(header);
      }
      sectionMap.get(header).push(row);
    }

    const formChildren = [];
    for (const header of sectionOrder) {
      const sectionRows = sectionMap.get(header);
      const items = sectionRows.map(buildItem);

      if (header === NO_SECTION) {
        formChildren.push(...items);
      } else {
        // Section header → nested group
        const sectionGroup = {
          linkId: `${formRows[0].form}__section__${header.replace(/\s+/g, '_').toLowerCase()}`,
          text:   header,
          type:   'group',
          item:   items,
          extension: [ext(RC + 'section-header', 'String', header)],
        };
        formChildren.push(sectionGroup);
      }
    }

    // Wrap in form group
    const formGroup = {
      linkId: formName.replace(/\s+/g, '_').toLowerCase(),
      text:   formName,
      type:   'group',
      item:   formChildren,
      extension: [ext(RC + 'form-name', 'String', formName)],
    };
    rootItems.push(formGroup);
  }

  return {
    resourceType: 'Questionnaire',
    title,
    status,
    item: rootItems,
  };
}
