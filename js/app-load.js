// File loading, QR answers, import pipeline, and filename display.
// Exports: setFileName, navigateToNode, importAndValidate
import { tree, values, rawFhir, effect, questMeta } from './state.js';
import { _formTick } from './render-bus.js';
import { showError } from './ui/toast.js';
import { importFHIR } from './fhir/import.js';
import { importQRAnswers } from './fhir/qr-import.js';
import { validateTree } from './fhir/validate.js';
import * as validateModal from './ui/modals/validate-modal.js';
import * as libraryModal from './ui/modals/library-modal.js';
import * as progress from './ui/progress.js';
import * as autosave from './ui/autosave.js';
import { expandAll, renderTreeAsync } from './builder/index.js';
import { reinitForm, resetCollapsedFromTree } from './render-preview.js';
import { terminologyService } from './fhir/terminology-service.js';
import { answersMenu, saveMenu, toolsMenu } from './ui/header-actions.js';


// ── File name display ─────────────────────────────────────────────────────────
let _fileNameWrap, _fileNameEl;
window.addEventListener('DOMContentLoaded', () => {
  _fileNameWrap = document.getElementById('loadedFileNameWrap');
  _fileNameEl   = document.getElementById('loadedFileName');

  // Show toolbar sections and file name whenever the tree has nodes
  effect(() => {
    const hasNodes = tree.length > 0;
    document.getElementById('variablesCard').style.display = hasNodes ? '' : 'none';
    document.getElementById('questMetaCard').style.display = hasNodes ? '' : 'none';
    answersMenu.el.style.display = hasNodes ? '' : 'none';
    saveMenu.el.style.display    = hasNodes ? '' : 'none';
    toolsMenu.el.style.display   = hasNodes ? '' : 'none';
    if (hasNodes) {
      _fileNameWrap.style.display = 'inline-flex';
    } else {
      _fileNameEl.textContent = '';
      _fileNameWrap.style.display = 'none';
    }
  });
});

export function setFileName(name) {
  if (!_fileNameEl || !_fileNameWrap) return;
  if (name) {
    _fileNameEl.textContent = name;
    _fileNameWrap.style.display = 'inline-flex';
  } else {
    _fileNameEl.textContent = '';
    _fileNameWrap.style.display = 'none';
  }
}

// ── Navigate builder to node ──────────────────────────────────────────────────
export function navigateToNode(nodeId) {
  const target = document.querySelector(`[data-node-id="${CSS.escape(nodeId)}"]`);
  if (!target) return;
  const panel = document.querySelector('.left-panel-body');
  if (panel) {
    const top = target.getBoundingClientRect().top - panel.getBoundingClientRect().top + panel.scrollTop - 10;
    panel.scrollTo({ top, behavior: 'smooth' });
  } else {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  target.classList.add('node-flash');
  setTimeout(() => target.classList.remove('node-flash'), 1000);
}

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
    validateModal.show('ValueSet Expansion Errors', issues, 'import', { onNavigate: navigateToNode });
  }
  reinitForm();
}

// ── Import + render + validate pipeline ──────────────────────────────────────
export async function importAndValidate(data, fileName) {
  try {
    importFHIR(data, () => {}); // pass no-op renderFn — we render below
    resetCollapsedFromTree(tree);
    reinitForm();
    document.dispatchEvent(new CustomEvent('questionnaire-loaded'));
    const issues = validateTree(tree, values);
    progress.show('Rendering ' + tree.length + ' nodes\u2026');
    await renderTreeAsync((done, total) => progress.update(done, total));
    expandAll();
    document.querySelector('.left-panel-body')?.scrollTo({ top: 0 });
    document.querySelector('.right-panel-body')?.scrollTo({ top: 0 });
    setFileName(fileName || '');
    if (issues.length > 0) validateModal.show('Import \u2014 Validation Report', issues, 'import', { onNavigate: navigateToNode });

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
  return new Promise(resolve => {
    const backdrop = document.createElement('div');
    backdrop.className = 'clear-confirm-backdrop';

    const box = document.createElement('div');
    box.className = 'clear-confirm-box';
    box.innerHTML =
      '<div class="clear-confirm-title">Load new questionnaire?</div>' +
      '<div class="clear-confirm-msg">This will replace the current questionnaire.' +
        ' The undo history will also be lost and cannot be recovered.</div>' +
      '<div class="clear-confirm-btns">' +
        '<button class="btn-fhir" id="_lcProceed" data-testid="load-confirm-proceed-btn">Load anyway</button>' +
        '<button class="btn-fhir" id="_lcCancel"  data-testid="load-confirm-cancel-btn">Cancel</button>' +
      '</div>';

    backdrop.appendChild(box);
    document.body.appendChild(backdrop);

    const esc = e => { if (e.key === 'Escape') close('cancel'); };
    document.addEventListener('keydown', esc);
    const close = result => { document.removeEventListener('keydown', esc); backdrop.remove(); resolve(result); };
    box.querySelector('#_lcProceed').onclick = () => close('proceed');
    box.querySelector('#_lcCancel').onclick  = () => close('cancel');
    backdrop.addEventListener('click', e => { if (e.target === backdrop) close('cancel'); });
  });
}

export function _applyQRAnswers(qr) {
  const result = importQRAnswers(qr, values, tree);
  if (!result.ok) { showError('Cannot load answers: ' + result.error); return; }
  document.dispatchEvent(new CustomEvent('qr-loaded', { detail: {
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
    validateModal.show('Load Answers \u2014 ' + result.loaded + ' loaded', issues, 'import', { onNavigate: navigateToNode });
  }
}
