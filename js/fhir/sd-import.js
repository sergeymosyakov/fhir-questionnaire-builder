// ── StructureDefinition import helper ─────────────────────────────────────────
// Shared by the file-picker (load-format-modal.js) and Library (questionnaires-menu.js)
// entry points: validates the resource, generates, and surfaces generation warnings.
import { generateQuestionnaireFromSD } from './sd-to-questionnaire.js';
import { notifyError, requestValidationReport } from '../core/ui-requests.js';

/** @returns {object|null} the generated Questionnaire, or null (error already shown) */
export function applyStructureDefinition(data, title) {
  if (data?.resourceType !== 'StructureDefinition') {
    notifyError('The selected file is not a FHIR StructureDefinition.');
    return null;
  }
  const { questionnaire, warnings } = generateQuestionnaireFromSD(data, { title });
  if (warnings.length > 0) {
    requestValidationReport('StructureDefinition Generation \u2014 Warnings', 'import', {
      extraIssues: warnings.map(message => ({ severity: 'warning', nodeId: '', message })),
    });
  }
  return questionnaire;
}
