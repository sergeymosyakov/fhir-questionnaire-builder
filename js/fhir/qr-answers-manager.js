// ── QR Answers Manager ────────────────────────────────────────────────────────
// Orchestrates QuestionnaireResponse import: calls pure import logic, dispatches
// events, builds validation issues, and triggers UI feedback.
import { importQRAnswers } from './qr-import.js';
import { showError } from '../ui/toast.js';
import * as validateModal from '../ui/modals/validate-modal.js';
import { AppEvents, EventState } from '../events.js';

export class QRAnswersManager {
  constructor() {
    this._answerStore     = null;
    this._tree            = null;
    this._questDoc        = null;
    this._validateEnabled = true;

    if (typeof document !== 'undefined') {
      const _init = ({ questDoc, answerStore }) => {
        this._answerStore = answerStore;
        this._tree        = questDoc.tree;
        this._questDoc    = questDoc;
      };
      const cached = EventState.get(AppEvents.APP_CONTEXT_READY);
      if (cached?.questDoc) { _init(cached); }
      else { document.addEventListener(AppEvents.APP_CONTEXT_READY, e => _init(e.detail), { once: true }); }

      document.addEventListener(AppEvents.VALIDATOR_TOGGLE, e => {
        if (e.detail?.id === 'local') this._validateEnabled = e.detail.enabled;
      });
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

    if (issues.length > 0 && this._validateEnabled) {
      validateModal.show('Load Answers \u2014 ' + result.loaded + ' loaded', 'import', { tree: this._tree, values: this._answerStore.data, extraIssues: issues });
    }
  }
}
