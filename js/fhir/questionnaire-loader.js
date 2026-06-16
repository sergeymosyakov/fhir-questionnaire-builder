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
import { versionRegistry } from './version-registry.js';
// Format registrations are handled by js/fhir/formats/*.js, imported via export.js
import { loadConfirmModal } from '../ui/modals/load-confirm-modal.js';

export class QuestionnaireLoader {
  /** @param {{ questDoc: import('./quest-document.js').QuestDocument,
   *            values, clearAllValues?, reinitForm?, shouldValidate?,
   *            renderTree?, renderTreeAsync? }} deps */
  constructor({ questDoc, values, reinitForm, shouldValidate,
                renderTree: renderTreeFn, renderTreeAsync: renderTreeAsyncFn,
                clearAllValues }) {
    this._questDoc         = questDoc;
    this._tree             = questDoc.tree;     // alias — same array reference
    this._values           = values;
    this._reinitForm       = reinitForm || null;
    this._importSeq        = 0;
    this._shouldValidate   = shouldValidate || (() => true);
    this._renderTree       = renderTreeFn       || renderTree;
    this._renderTreeAsync  = renderTreeAsyncFn  || renderTreeAsync;
    this._clearAllValues   = clearAllValues     || (() => {});
    // Reset-flow callbacks — injected via configureResetFlow()
    this._resetFlow        = null;
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
    this._questDoc.reset();   // destroyTree + rawFhir=null + contained/variables/meta
    this._clearAllValues();
    this._renderTree();
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
      if (this._reinitForm) {
        await this._reinitForm();
      } else {
        document.dispatchEvent(new CustomEvent(AppEvents.REINIT_FORM));
      }
      document.dispatchEvent(new CustomEvent(AppEvents.QUESTIONNAIRE_LOADED, {
        detail: { fileName: fileName || '' },
      }));
      progress.show('Rendering ' + this._tree.length + ' nodes…');
      await this._renderTreeAsync((done, total) => progress.update(done, total));
      document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_EXPAND_ALL));

      // Show import report only when local validator finds errors and validate is enabled.
      // Warnings are non-blocking — users can review them via Tools → Validate.
      if (this._shouldValidate() && validateTree(this._tree, this._values, { name: data?.name }).some(i => i.severity === 'error')) {
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
    const failures = await terminologyService.expandAll(this._tree, this._questDoc.meta);
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
