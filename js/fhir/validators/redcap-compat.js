// ── REDCap Compatibility Validator ────────────────────────────────────────────
// Checks a FHIR Questionnaire for constructs that cannot be represented in
// REDCap Data Dictionary format and reports them as warnings/errors before export.
//
// Registered in validatorRegistry with enabled = false by default.
// The REDCap export flow enables it temporarily, runs validateModal in 'export'
// mode, then disables it again.

import { Validator } from './base.js';

const _ITEM_CTRL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl';
const RC         = 'http://fhir-qb.app/redcap/';

// SDC / FHIR extensions that have no REDCap equivalent
const UNSUPPORTED_EXTS = new Set([
  'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-answerExpression',
  'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-initialExpression',
  'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-choiceColumn',
  'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-itemContext',
  'http://hl7.org/fhir/StructureDefinition/questionnaire-constraint',
  'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-variable',
]);

/** Recursively walk FHIR item array. cb(item, depth) called for each item. */
function walk(items, cb, depth = 0) {
  for (const item of items || []) {
    cb(item, depth);
    if (item.item) walk(item.item, cb, depth + 1);
  }
}

/** Check if item has a round-trip redcap extension (already converted from REDCap). */
function hasRcOrigin(item) {
  return (item.extension || []).some(e => e.url.startsWith(RC));
}

export class REDCapCompatValidator extends Validator {
  constructor() {
    super();
    this.enabled = false; // off by default — enabled only during REDCap export
  }

  get id()   { return 'redcap-compat'; }
  get name() { return 'REDCap Compatibility'; }
  get type() { return 'local'; }

  // eslint-disable-next-line no-unused-vars
  async _run(questJson, tree, values) {
    if (!questJson) return [];
    const issues = [];

    // Track max group nesting depth
    let maxGroupDepth = 0;

    walk(questJson.item, (item, depth) => {
      const id = item.linkId || '(unknown)';

      // ── Group nesting depth ───────────────────────────────────────────
      if (item.type === 'group') {
        if (depth > maxGroupDepth) maxGroupDepth = depth;
        if (depth >= 2 && !hasRcOrigin(item)) {
          issues.push({
            severity: 'warning', nodeId: id,
            message: `Group "${item.text || id}" is nested at depth ${depth + 1}. REDCap supports at most 2 levels (Form → Section). It will be flattened into its parent section.`,
          });
        }
      }

      if (item.type === 'group') return; // rest of checks for field items only

      // ── answerValueSet by URL ─────────────────────────────────────────
      if (item.answerValueSet && !hasRcOrigin(item)) {
        issues.push({
          severity: 'error', nodeId: id,
          message: `"${item.text || id}": answerValueSet by URL ("${item.answerValueSet}") cannot be represented in REDCap — choices must be inline. The field will be exported with empty choices.`,
        });
      }

      // ── item.code ─────────────────────────────────────────────────────
      if (item.code && item.code.length > 0 && !hasRcOrigin(item)) {
        issues.push({
          severity: 'warning', nodeId: id,
          message: `"${item.text || id}": item.code (FHIR Coding) has no REDCap equivalent and will be dropped.`,
        });
      }

      // ── enableWhen with FHIRPath expression ───────────────────────────
      if (item.enableWhenExpression && !hasRcOrigin(item)) {
        issues.push({
          severity: 'warning', nodeId: id,
          message: `"${item.text || id}": FHIRPath-based enableWhenExpression cannot be translated to REDCap branching logic. The branching condition will be lost.`,
        });
      }

      // ── Complex enableWhen (mixed AND/OR or unsupported operators) ────
      if (!hasRcOrigin(item) && item.enableWhen && item.enableWhen.length > 1) {
        const hasAllOp = item.enableBehavior === 'all' || !item.enableBehavior;
        const hasAnyOp = item.enableBehavior === 'any';
        if (!hasAllOp && !hasAnyOp) {
          issues.push({
            severity: 'warning', nodeId: id,
            message: `"${item.text || id}": enableBehavior "${item.enableBehavior}" is not supported in REDCap. Branching logic may be incorrect.`,
          });
        }
      }

      // ── Unsupported extensions ────────────────────────────────────────
      if (!hasRcOrigin(item)) {
        for (const e of item.extension || []) {
          if (UNSUPPORTED_EXTS.has(e.url)) {
            const shortName = e.url.split('/').pop();
            issues.push({
              severity: 'warning', nodeId: id,
              message: `"${item.text || id}": extension "${shortName}" has no REDCap equivalent and will be dropped.`,
            });
          }
        }
      }

      // ── Item types with no REDCap equivalent ──────────────────────────
      if (!hasRcOrigin(item)) {
        if (item.type === 'reference') {
          issues.push({
            severity: 'warning', nodeId: id,
            message: `"${item.text || id}": type "reference" (FHIR resource reference) has no REDCap equivalent — will be exported as a text field.`,
          });
        }
        if (item.type === 'quantity') {
          issues.push({
            severity: 'warning', nodeId: id,
            message: `"${item.text || id}": type "quantity" (value + unit) has no direct REDCap equivalent — will be exported as a text field. Consider splitting into two fields.`,
          });
        }
      }

      // ── calculatedExpression (inform, not block) ──────────────────────
      if (!hasRcOrigin(item)) {
        const calcExt = (item.extension || []).find(
          e => e.url === 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-calculatedExpression'
        );
        if (calcExt) {
          issues.push({
            severity: 'warning', nodeId: id,
            message: `"${item.text || id}": calculatedExpression uses FHIRPath — stored as a REDCap calc formula annotation. Manual adjustment in REDCap will be required.`,
          });
        }
      }
    });

    return issues;
  }
}
