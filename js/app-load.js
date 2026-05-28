// File loading, QR answers, and import pipeline.
// Exports: importAndValidate
import { tree, values, rawFhir, effect, questMeta } from './state.js';
import { _formTick } from './render-bus.js';
import { showError } from './ui/toast.js';
import { importFHIR } from './fhir/import.js';
import { importQRAnswers } from './fhir/qr-import.js';
import { validateTree } from './fhir/validate.js';
import * as validateModal from './ui/modals/validate-modal.js';
import * as progress from './ui/progress.js';
import { renderTreeAsync } from './builder/index.js';
import { reinitForm } from './render-preview.js';
import { GroupNode } from './nodes/group-node.js';
import { terminologyService } from './fhir/terminology-service.js';
import { answersMenu, saveMenu, toolsMenu } from './ui/header-actions.js';
import { AppEvents } from './events.js';
import { loadConfirmModal } from './ui/modals/load-confirm-modal.js';


// ── Toolbar section visibility ────────────────────────────────────────────────
// Show/hide left-panel cards and header menus when the tree has nodes.
window.addEventListener('DOMContentLoaded', () => {
  effect(() => {
    const hasNodes = tree.length > 0;
    document.getElementById('variablesCard').style.display = hasNodes ? '' : 'none';
    document.getElementById('questMetaCard').style.display = hasNodes ? '' : 'none';
    answersMenu.el.style.display = hasNodes ? '' : 'none';
    saveMenu.el.style.display    = hasNodes ? '' : 'none';
    toolsMenu.el.style.display   = hasNodes ? '' : 'none';
  });
});

// ── ValueSet expansion ────────────────────────────────────────────────────────
// Each import increments this counter. _expandValueSets checks it on completion
// to guard against re-rendering a stale questionnaire if the user loads another
// file while expansion is still in flight.
let _importSeq = 0;

async function _expandValueSets(seq) {
  const failures = await terminologyService.expandAll(tree, questMeta);
  if (_importSeq !== seq) return; // user loaded a different questionnaire — discard
  if (failures.length) {
    const issues = failures.map(f => ({
      severity: 'error',
      nodeId:   f.node?.id || '(unknown)',
      message:  ` \u2014 ValueSet ${f.vsUrl} from ${f.server}: ${f.error}`,
    }));
    validateModal.show('ValueSet Expansion Errors', issues, 'import');
  }
  reinitForm();
}

// ── Import + render + validate pipeline ──────────────────────────────────────
export async function importAndValidate(data, fileName) {
  try {
    importFHIR(data, () => {}); // pass no-op renderFn — we render below
    GroupNode.resetCollapsedFromTree(tree);
    reinitForm();
    document.dispatchEvent(new CustomEvent(AppEvents.QUESTIONNAIRE_LOADED, { detail: { fileName: fileName || '' } }));
    const issues = validateTree(tree, values);
    progress.show('Rendering ' + tree.length + ' nodes\u2026');
    await renderTreeAsync((done, total) => progress.update(done, total));
    document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_EXPAND_ALL));
    document.querySelector('.left-panel-body')?.scrollTo({ top: 0 });
    document.querySelector('.right-panel-body')?.scrollTo({ top: 0 });

    if (issues.length > 0) validateModal.show('Import — Validation Report', issues, 'import');

    // Expand external answerValueSets in the background; re-render preview when done.
    _expandValueSets(++_importSeq);
  } catch (err) {
    showError('Import error: ' + err.message);
  } finally {
    progress.hide();
  }
}

// ── Read JSON file helper ─────────────────────────────────────────────────────
export function _readFileAsJSON(e, onData) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload  = ev => {
    try { onData(JSON.parse(ev.target.result), file.name); }
    catch (err) { showError('Parse error: ' + err.message); }
  };
  reader.onerror = () => { showError('Error reading file.'); };
  reader.readAsText(file);
  e.target.value = '';
}

// ── Confirm before load ───────────────────────────────────────────────────────
/** Returns promise resolving to 'proceed' | 'cancel'.
 *  Only shows the dialog when the tree has items (undo history would be lost). */
export function _askBeforeLoad() {
  if (tree.length === 0) return Promise.resolve('proceed');
  return loadConfirmModal.open();
}

export function _applyQRAnswers(qr) {
  const result = importQRAnswers(qr, values, tree);
  if (!result.ok) { showError('Cannot load answers: ' + result.error); return; }
  document.dispatchEvent(new CustomEvent(AppEvents.QR_LOADED, { detail: {
    status:  result.meta.status,
    subject: result.meta.subject,
    author:  result.meta.author,
  } }));

  const currentUrl = (rawFhir.value && (rawFhir.value.url || rawFhir.value.id)) || '';
  const issues = [];
  if (result.questionnaire && currentUrl && result.questionnaire !== currentUrl) {
    issues.push({
      severity: 'warning', nodeId: null,
      message: 'QR questionnaire "' + result.questionnaire + '" does not match loaded questionnaire "' + currentUrl + '"',
    });
  }
  if (result.unmatched.length > 0) {
    const preview = result.unmatched.slice(0, 5).join(', ') + (result.unmatched.length > 5 ? '\u2026' : '');
    issues.push({
      severity: 'warning', nodeId: null,
      message: result.unmatched.length + ' answer(s) in response not found in questionnaire: ' + preview,
    });
  }

  _formTick.value++;

  if (issues.length > 0) {
    validateModal.show('Load Answers — ' + result.loaded + ' loaded', issues, 'import');
  }
}
