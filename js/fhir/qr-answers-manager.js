// ── QR Answers Manager ────────────────────────────────────────────────────────
// Orchestrates QuestionnaireResponse import: calls pure import logic, dispatches
// events, builds validation issues, and triggers UI feedback.
import { importQRAnswers } from './qr-import.js';
import { showError } from '../ui/toast.js';
import * as validateModal from '../ui/modals/validate-modal.js';
import { AppEvents } from '../events.js';

export class QRAnswersManager {
  /** @param {{ values, tree, rawFhir }} deps — state references */
  constructor({ values, tree, rawFhir }) {
    this._values   = values;
    this._tree     = tree;
    this._rawFhir  = rawFhir;
  }

  apply(qr) {
    const result = importQRAnswers(qr, this._values, this._tree);
    if (!result.ok) { showError('Cannot load answers: ' + result.error); return; }

    document.dispatchEvent(new CustomEvent(AppEvents.QR_LOADED, { detail: {
      status:  result.meta.status,
      subject: result.meta.subject,
      author:  result.meta.author,
    } }));

    const raw = this._rawFhir.value;
    const currentUrl = (raw && (raw.url || raw.id)) || '';
    const issues = [];

    if (result.questionnaire && currentUrl && result.questionnaire !== currentUrl) {
      issues.push({
        severity: 'warning', nodeId: null,
        message: 'QR questionnaire "' + result.questionnaire +
                 '" does not match loaded questionnaire "' + currentUrl + '"',
      });
    }

    if (result.unmatched.length > 0) {
      const preview = result.unmatched.slice(0, 5).join(', ') +
                      (result.unmatched.length > 5 ? '\u2026' : '');
      issues.push({
        severity: 'warning', nodeId: null,
        message: result.unmatched.length +
                 ' answer(s) in response not found in questionnaire: ' + preview,
      });
    }

    document.dispatchEvent(new CustomEvent(AppEvents.RESPONSE_CHANGED));

    if (issues.length > 0) {
      validateModal.show('Load Answers \u2014 ' + result.loaded + ' loaded', issues, 'import');
    }
  }
}
