// ── Questionnaire Loader ──────────────────────────────────────────────────────
// Orchestrates FHIR Questionnaire import: parse → render → validate → VS expand.
import { showError } from '../ui/toast.js';
import { importFHIR } from './import.js';
import { validateTree } from './validate.js';
import * as validateModal from '../ui/modals/validate-modal.js';
import * as progress from '../ui/progress.js';
import { renderTreeAsync } from '../builder/index.js';
import { GroupNode } from '../nodes/group-node.js';
import { terminologyService } from './terminology-service.js';
import { AppEvents } from '../events.js';
import { loadConfirmModal } from '../ui/modals/load-confirm-modal.js';

export class QuestionnaireLoader {
  /** @param {{ tree, values, questMeta, reinitForm? }} deps — reactive state refs */
  constructor({ tree, values, questMeta, reinitForm }) {
    this._tree       = tree;
    this._values     = values;
    this._questMeta  = questMeta;
    this._reinitForm = reinitForm || null;
    this._importSeq  = 0;
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
      const issues = validateTree(this._tree, this._values);
      progress.show('Rendering ' + this._tree.length + ' nodes\u2026');
      await renderTreeAsync((done, total) => progress.update(done, total));
      document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_EXPAND_ALL));

      if (issues.length > 0) {
        validateModal.show('Import \u2014 Validation Report', issues, 'import');
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
      const issues = failures.map(f => ({
        severity: 'error',
        nodeId:   f.node?.id || '(unknown)',
        message:  ` \u2014 ValueSet ${f.vsUrl} from ${f.server}: ${f.error}`,
      }));
      validateModal.show('ValueSet Expansion Errors', issues, 'import');
    }
    if (this._reinitForm) {
      await this._reinitForm({ silent: true });
    } else {
      document.dispatchEvent(new CustomEvent(AppEvents.REINIT_FORM));
    }
  }
}
