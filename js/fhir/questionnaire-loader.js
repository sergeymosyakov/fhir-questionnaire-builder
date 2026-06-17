// ── Questionnaire Loader ──────────────────────────────────────────────────────
// Orchestrates FHIR Questionnaire import: parse → render → validate → VS expand.
// Also owns the reset flow (clearing tree + metadata to empty state).
import { showError } from '../ui/toast.js';
import { importFHIR } from './import.js';
import { validateTree } from './validate.js';
import * as validateModal from '../ui/modals/validate-modal.js';
import * as progress from '../ui/progress.js';
import { GroupNode } from '../nodes/group-node.js';
import { terminologyService } from './terminology-service.js';
import { AppEvents } from '../events.js';
import { versionRegistry } from './version-registry.js';
// Format registrations are handled by js/fhir/formats/*.js, imported via export.js
import { loadConfirmModal } from '../ui/modals/load-confirm-modal.js';

export class QuestionnaireLoader {
  /** @param {{ questDoc: import('../fhir/quest-document.js').QuestDocument, answerStore }} deps */
  constructor({ questDoc, answerStore }) {
    this._questDoc         = questDoc;
    this._tree             = questDoc.tree;
    this._answerStore      = answerStore;
    this._importSeq        = 0;
    this._validateEnabled  = true;  // kept in sync via VALIDATOR_TOGGLE
    // Self-wire lifecycle events — no external wiring needed in app.js
    if (typeof document !== 'undefined') {
      document.addEventListener(AppEvents.VALIDATOR_TOGGLE, e => {
        if (e.detail?.id === 'local') this._validateEnabled = e.detail.enabled;
      });
      document.addEventListener(AppEvents.QUESTIONNAIRE_CLEAR_REQUESTED, () => this.confirmAndReset());
      document.addEventListener(AppEvents.QUESTIONNAIRE_RESET, () => this.reset());
      document.addEventListener(AppEvents.QUESTIONNAIRE_LOAD_CONFIRM_REQUESTED, async e => {
        const result = await this.confirmBeforeLoad();
        e.detail.resolve(result === 'proceed');
      });
      document.addEventListener(AppEvents.QUESTIONNAIRE_LOAD_REQUESTED, async e => {
        const { data, fileName } = e.detail;
        // Note: caller may have already confirmed (e.g. library open after confirm).
        // We do NOT call confirmBeforeLoad here — the menu already did it.
        this.load(data, fileName);
      });
    }
  }

  /**
   * Hard reset: destroy tree, clear all state, dispatch QUESTIONNAIRE_CLEARED.
   * Equivalent to the old _doReset() — but encapsulated in the loader.
   */
  reset() {
    this._questDoc.reset();
    document.dispatchEvent(new CustomEvent(AppEvents.ANSWERS_CLEAR));
    document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_RERENDER));
    document.dispatchEvent(new CustomEvent(AppEvents.AUTOSAVE_CLEAR_DRAFT));
    document.dispatchEvent(new CustomEvent(AppEvents.QUESTIONNAIRE_CLEARED));
  }

  /**
   * Full confirm-before-clear flow (replaces _clearForm in app.js):
   * - If tree is empty → reset immediately.
   * - Else show confirm dialog → export-if-needed → reset.
   */
  async confirmAndReset() {
    if (this._tree.length === 0) { this.reset(); return; }

    const choice = await new Promise(resolve =>
      document.dispatchEvent(new CustomEvent(AppEvents.CLEAR_CONFIRM_REQUESTED, { detail: { resolve } }))
    );
    if (choice === 'cancel') return;
    if (choice === 'export') {
      await new Promise(resolve =>
        document.dispatchEvent(new CustomEvent(AppEvents.VALIDATE_EXPORT_REQUESTED, {
          detail: { resolve, questDoc: this._questDoc, answerStore: this._answerStore }
        }))
      );
      await new Promise(resolve =>
        document.dispatchEvent(new CustomEvent(AppEvents.EXPORT_PROMPT_REQUESTED, { detail: { resolve } }))
      );
    }
    this.reset();
  }

  /** Returns 'proceed' | 'cancel'. Shows confirm dialog when tree is non-empty. */
  confirmBeforeLoad() {
    if (this._tree.length === 0) return Promise.resolve('proceed');
    return loadConfirmModal.open();
  }

  /** Full import pipeline: parse → render tree → validate → expand ValueSets. */
  async load(data, fileName) {
    try {
      importFHIR(data);
      // Auto-detect FHIR version: builder-target-version extension first, then
      // feature-based heuristics (see formatRegistry.detectVersion); default R4
      const _importedVersion = versionRegistry.detectVersion(data);
      if (this._questDoc.meta.fhirTarget !== _importedVersion) {
        this._questDoc.meta.fhirTarget = _importedVersion;
        document.dispatchEvent(new CustomEvent(AppEvents.FHIR_VERSION_CHANGED, {
          detail: { versionId: _importedVersion },
        }));
      }
      GroupNode.resetCollapsedFromTree(this._tree);
      document.dispatchEvent(new CustomEvent(AppEvents.REINIT_FORM));
      document.dispatchEvent(new CustomEvent(AppEvents.QUESTIONNAIRE_LOADED, {
        detail: { fileName: fileName || '', questDoc: this._questDoc, answerStore: this._answerStore },
      }));

      // Show import report only when local validator finds errors and validate is enabled.
      // Warnings are non-blocking — users can review them via Tools → Validate.
      if (this._validateEnabled && validateTree(this._tree, this._answerStore.data, { name: data?.name }).some(i => i.severity === 'error')) {
        validateModal.show('Import — Validation Report', 'import', { questJson: data, tree: this._tree, values: this._answerStore.data });
      }
      this._expandValueSets(++this._importSeq);
    } catch (err) {
      showError('Import error: ' + err.message);
    } finally {
      progress.hide();
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  async _expandValueSets(seq) {
    const failures = await terminologyService.expandAll(this._tree, this._questDoc.meta);
    if (this._importSeq !== seq) return;
    if (failures.length) {
      validateModal.show('ValueSet Expansion Errors', 'import', { tree: this._tree, values: this._answerStore.data });
    }
    document.dispatchEvent(new CustomEvent(AppEvents.REINIT_FORM, { detail: { silent: true } }));
  }
}
