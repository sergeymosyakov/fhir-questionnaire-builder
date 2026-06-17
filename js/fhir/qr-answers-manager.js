// ── QR Answers Manager ────────────────────────────────────────────────────────
// Orchestrates QuestionnaireResponse import: calls pure import logic, dispatches
// events, builds validation issues, and triggers UI feedback.
import { importQRAnswers } from './qr-import.js';
import { showError } from '../ui/toast.js';
import * as validateModal from '../ui/modals/validate-modal.js';
import { AppEvents } from '../events.js';

export class QRAnswersManager {
  /** @param {{ questDoc, answerStore, shouldValidate? }} deps — state references */
  constructor({ questDoc, answerStore, shouldValidate }) {
    this._answerStore     = answerStore;
    this._tree            = questDoc.tree;
    this._questDoc        = questDoc;
    this._shouldValidate  = shouldValidate || (() => true);

    // Listen for QR_ANSWERS_REQUESTED so no external caller needs a reference.
    if (typeof document !== 'undefined') {
      document.addEventListener(AppEvents.QR_ANSWERS_REQUESTED, e => {
        this.apply(e.detail.data);
      });
    }
  }

  apply(qr) {
    const result = importQRAnswers(qr, this._answerStore.data, this._tree);
    if (!result.ok) { showError('Cannot load answers: ' + result.error); return; }

    document.dispatchEvent(new CustomEvent(AppEvents.QR_LOADED, { detail: {
      status:        result.meta.status,
      subject:       result.meta.subject,
      author:        result.meta.author,
      id:            result.meta.id,
      language:      result.meta.language,
      metaVersionId: result.meta.metaVersionId,
      metaSource:    result.meta.metaSource,
      metaProfile:   result.meta.metaProfile,
      metaTag:       result.meta.metaTag,
      metaSecurity:  result.meta.metaSecurity,
    } }));

    const raw = this._questDoc?.rawFhir;
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

    if (issues.length > 0 && this._shouldValidate()) {
      validateModal.show('Load Answers \u2014 ' + result.loaded + ' loaded', 'import', { tree: this._tree, values: this._answerStore.data, extraIssues: issues });
    }
  }
}
