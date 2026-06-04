// ── Questionnaire Loader ──────────────────────────────────────────────────────
// Orchestrates FHIR Questionnaire import: parse → render → validate → VS expand.
// Also owns the reset flow (clearing tree + metadata to empty state).
import { showError } from '../ui/toast.js';
import { importFHIR } from './import.js';
import { validateTree } from './validate.js';
import * as validateModal from '../ui/modals/validate-modal.js';
import * as progress from '../ui/progress.js';
import { renderTreeAsync, renderTree } from '../builder/index.js';
import { GroupNode } from '../nodes/group-node.js';
import { terminologyService } from './terminology-service.js';
import { AppEvents } from '../events.js';
import { loadConfirmModal } from '../ui/modals/load-confirm-modal.js';
import { destroyTree } from '../utils.js';
import { clearAllValues, resetQuestMeta, questVariables, questContained } from '../state.js';

export class QuestionnaireLoader {
  /** @param {{ tree, values, questMeta, reinitForm?, rawFhir?, shouldValidate? }} deps */
  constructor({ tree, values, questMeta, reinitForm, rawFhir, shouldValidate }) {
    this._tree          = tree;
    this._values        = values;
    this._questMeta     = questMeta;
    this._rawFhir       = rawFhir || null;
    this._reinitForm    = reinitForm || null;
    this._importSeq     = 0;
    this._shouldValidate = shouldValidate || (() => true);
    // Reset-flow callbacks — injected via configureResetFlow()
    this._resetFlow     = null;
  }

  /**
   * Inject UI callbacks needed for the confirm-and-reset flow.
   * Called once after construction when all UI modules are available.
   */
  configureResetFlow({ confirmOpen, promptExport, showValidateExport, clearDraft }) {
    this._resetFlow = { confirmOpen, promptExport, showValidateExport, clearDraft };
  }

  /**
   * Hard reset: destroy tree, clear all state, dispatch QUESTIONNAIRE_CLEARED.
   * Equivalent to the old _doReset() — but encapsulated in the loader.
   */
  reset() {
    destroyTree(this._tree);
    clearAllValues();
    if (this._rawFhir) this._rawFhir.value = null;
    resetQuestMeta();
    questVariables.splice(0);
    questContained.splice(0);
    renderTree();
    if (this._resetFlow?.clearDraft) this._resetFlow.clearDraft();
    document.dispatchEvent(new CustomEvent(AppEvents.QUESTIONNAIRE_CLEARED));
  }

  /**
   * Full confirm-before-clear flow (replaces _clearForm in app.js):
   * - If tree is empty → reset immediately.
   * - Else show confirm dialog → export-if-needed → reset.
   */
  async confirmAndReset() {
    if (!this._resetFlow) { this.reset(); return; }
    const { confirmOpen, promptExport, showValidateExport } = this._resetFlow;

    if (this._tree.length > 0) {
      const choice = await confirmOpen();
      if (choice === 'cancel') return;
      if (choice === 'export') {
        showValidateExport(() => { promptExport(() => this.reset()); });
        return;
      }
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
      importFHIR(data, () => {});
      GroupNode.resetCollapsedFromTree(this._tree);
      if (this._reinitForm) {
        await this._reinitForm();
      } else {
        document.dispatchEvent(new CustomEvent(AppEvents.REINIT_FORM));
      }
      document.dispatchEvent(new CustomEvent(AppEvents.QUESTIONNAIRE_LOADED, {
        detail: { fileName: fileName || '' },
      }));
      progress.show('Rendering ' + this._tree.length + ' nodes…');
      await renderTreeAsync((done, total) => progress.update(done, total));
      document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_EXPAND_ALL));

      // Show import report only when local validator finds errors and validate is enabled.
      // Warnings are non-blocking — users can review them via Tools → Validate.
      if (this._shouldValidate() && validateTree(this._tree, this._values).some(i => i.severity === 'error')) {
        validateModal.show('Import — Validation Report', 'import', { questJson: data, tree: this._tree, values: this._values });
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
    const failures = await terminologyService.expandAll(this._tree, this._questMeta);
    if (this._importSeq !== seq) return;
    if (failures.length) {
      validateModal.show('ValueSet Expansion Errors', 'import', { tree: this._tree, values: this._values });
    }
    if (this._reinitForm) {
      await this._reinitForm({ silent: true });
    } else {
      document.dispatchEvent(new CustomEvent(AppEvents.REINIT_FORM));
    }
  }
}
