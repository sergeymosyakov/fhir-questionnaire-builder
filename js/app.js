// Entry point: wires toolbar buttons, patient context popup, and loads the built-in example.
import { tree, values, rawFhir, _formTick, effect } from './state.js';
import { importFHIR } from './fhir/import.js';
import { buildFHIRObject, exportFHIR } from './fhir/export.js';
import { exportQR } from './fhir/qr-export.js';
import { importQRAnswers } from './fhir/qr-import.js';
import { validateTree } from './fhir/validate.js';
import * as validateModal from './ui/validate-modal.js';
import * as progress from './ui/progress.js';
import * as search from './ui/search.js';
import * as tooltip from './ui/tooltip.js';
import * as autosave from './ui/autosave.js';
import * as statusBadge from './ui/status-badge.js';
import * as variablesPanel from './ui/variables-panel.js';
import * as patientCtx from './ui/patient-ctx.js';
import * as showWhenModal from './ui/showwhen-modal.js';
import * as constraintModal from './ui/constraint-modal.js';
import * as expressionModal from './ui/expression-modal.js';
import { renderTree, collapseAll, expandAll, renumberAll, addRootGroup, renderTreeAsync } from './render-builder.js';
import { navigateToPreview, reinitForm } from './render-preview.js';
import { showLinkId, showPrefix, showBadges, questVariables } from './state.js';
import './render-preview.js'; // side-effect: registers the reactive effect()

// fhirpath.js v4 browser bundle loaded as global via lib/fhirpath.min.js
const fhirpath = window.fhirpath;

// Buttons
document.getElementById('clearFormBtn').onclick    = _clearForm;
document.getElementById('addRootGroupBtn').onclick = () => {
  addRootGroup();
  // If no file is loaded, show a default name so the × button makes sense
  if (!_fileNameEl.textContent) _setFileName('New Questionnaire');
};
document.getElementById('collapseAllBtn').onclick  = collapseAll;

// Wire a toggle button: click flips stateRef.value and updates active class.
function wireToggle(btnId, stateRef) {
  const btn = document.getElementById(btnId);
  btn.onclick = () => {
    stateRef.value = !stateRef.value;
    btn.classList.toggle('btn-fhir--active', stateRef.value);
  };
}
wireToggle('showLinkIdBtn', showLinkId);
wireToggle('showPrefixBtn', showPrefix);
wireToggle('showBadgesBtn', showBadges);
document.getElementById('expandAllBtn').onclick    = expandAll;
document.getElementById('renumberBtn').onclick = async () => {
  const btn = document.getElementById('renumberBtn');
  btn.disabled = true;
  progress.show('Renumbering…');
  const onProgress = e => progress.update(e.detail.done, e.detail.total);
  const onDone = () => {
    progress.hide();
    btn.disabled = false;
    document.removeEventListener('renumber-progress', onProgress);
    document.removeEventListener('renumber-done', onDone);
  };
  document.addEventListener('renumber-progress', onProgress);
  document.addEventListener('renumber-done', onDone);
  await renumberAll();
};
// ── Show When modal init ─────────────────────────────────────────────────
showWhenModal.init({
  modal:     document.getElementById('showWhenModal'),
  title:     document.getElementById('showWhenModalTitle'),
  body:      document.getElementById('showWhenModalBody'),
  closeBtn:  document.getElementById('showWhenModalClose'),
  cancelBtn: document.getElementById('showWhenModalCancel'),
  applyBtn:  document.getElementById('showWhenModalApply'),
});
// ── Constraint modal init ────────────────────────────────────────
constraintModal.init({
  modal:     document.getElementById('constraintModal'),
  title:     document.getElementById('constraintModalTitle'),
  body:      document.getElementById('constraintModalBody'),
  closeBtn:  document.getElementById('constraintModalClose'),
  cancelBtn: document.getElementById('constraintModalCancel'),
  applyBtn:  document.getElementById('constraintModalApply'),
});
// ── Expression modal init ────────────────────────────────────────
expressionModal.init({
  modal:     document.getElementById('expressionModal'),
  title:     document.getElementById('exprModalTitle'),
  body:      document.getElementById('exprModalBody'),
  closeBtn:  document.getElementById('exprModalClose'),
  cancelBtn: document.getElementById('exprModalCancel'),
  applyBtn:  document.getElementById('exprModalApply'),
});
// ── Validate modal init ───────────────────────────────────────────────────
const _modal = document.getElementById('validateModal');
validateModal.init({
  backdrop:    _modal,
  headerTitle: _modal.querySelector('.validate-modal-header span'),
  body:        _modal.querySelector('.modal-body'),
  footer:      _modal.querySelector('.modal-footer'),
  closeBtn:    _modal.querySelector('.modal-close'),
});

// ── Variables panel init ──────────────────────────────────────────────────
variablesPanel.init({
  card:      document.getElementById('variablesCard'),
  toggle:    document.getElementById('variablesCardToggle'),
  chipList:  document.getElementById('variablesCardChips'),
  count:     document.getElementById('variablesCardCount'),
  editBtn:   document.getElementById('variablesEditBtn'),
  reinitBtn: document.getElementById('variablesReinitBtn'),
  modal:     document.getElementById('variablesModal'),
  modalBody: document.getElementById('variablesModalBody'),
  closeBtn:  document.getElementById('variablesModalClose'),
  applyBtn:  document.getElementById('variablesModalApply'),
  cancelBtn: document.getElementById('variablesModalCancel'),
}, questVariables, reinitForm);

// ── Patient context popup init ────────────────────────────────────────────
patientCtx.init({
  presetBtn: document.getElementById('patientPresetBtn'),
  presetMenu: document.getElementById('patientPresetMenu'),
  modal:    document.getElementById('patientCtxModal'),
  closeBtn: document.getElementById('patientCtxClose'),
  applyBtn: document.getElementById('patientCtxApply'),
  body:     document.getElementById('patientCtxBody'),
}, questVariables, reinitForm);

// Refresh variables panel chips when patient context changes
document.addEventListener('patient-ctx-applied', () => variablesPanel.refresh());

// ── Global progress bar init ──────────────────────────────────────────────
progress.init({
  wrap:    document.getElementById('progressWrap'),
  bar:     document.getElementById('progressBar'),
  label:   document.getElementById('progressLabel'),
  blocker: document.getElementById('uiBlocker'),
});

// ── Tooltip init ─────────────────────────────────────────────────────────
tooltip.init();

statusBadge.init({
  btn:      document.getElementById('statusBadgeBtn'),
  dropdown: document.getElementById('statusDropdown'),
  wrap:     document.getElementById('statusBadgeWrap'),
}, navigateToPreview);

const _tooltipToggleBtn  = document.getElementById('tooltipToggleBtn');
const _tooltipsOffBadge  = document.getElementById('tooltipsOffBadge');
const _syncTooltipState = (enabled) => {
  _tooltipToggleBtn.classList.toggle('btn-fhir--active', enabled);
  _tooltipsOffBadge.style.display = enabled ? 'none' : '';
};
_syncTooltipState(tooltip.isEnabled());
_tooltipToggleBtn.addEventListener('click', () => {
  const next = !tooltip.isEnabled();
  tooltip.setEnabled(next);
  _syncTooltipState(next);
});

// ── Search init ───────────────────────────────────────────────────────────
search.init({
  input:   document.getElementById('searchInput'),
  prevBtn: document.getElementById('searchPrevBtn'),
  nextBtn: document.getElementById('searchNextBtn'),
  counter: document.getElementById('searchCounter'),
  lform:   document.getElementById('lform'),
});

// Prompt for filename then export
function _promptExport(afterExport) {
  const suggested = (_fileNameEl && _fileNameEl.textContent.trim()) || 'questionnaire';
  const name = window.prompt('Save as:', suggested + '.json');
  if (name === null) return; // cancelled
  const trimmed = (name.trim() || suggested).replace(/\.json$/i, '');
  exportFHIR(trimmed + '.json');
  _setFileName(trimmed);
  if (afterExport) afterExport();
}

// ── Validate button ──────────────────────────────────────────────────────────
document.getElementById('validateBtn').onclick = () => {
  const issues = validateTree(tree, values);
  validateModal.show('Validate — Report', issues, 'import', { onNavigate: _navigateToNode });
};

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    const searchWrap = document.getElementById('searchWrap');
    const searchInput = document.getElementById('searchInput');
    if (searchWrap && searchInput && searchWrap.style.display !== 'none') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  }
});

document.getElementById('exportFhirBtn').onclick = () => {
  const issues = validateTree(tree, values);
  if (issues.length === 0) { _promptExport(); return; }
  validateModal.show('Export — Validation Report', issues, 'export', { onExport: () => _promptExport(), onNavigate: _navigateToNode });
};

document.getElementById('exportResponseBtn').onclick = () => {
  const suggested = (_fileNameEl && _fileNameEl.textContent.trim()) || 'questionnaire';
  const name = window.prompt('Save as:', suggested + '-response.json');
  if (name === null) return;
  const trimmed = (name.trim() || (suggested + '-response')).replace(/\.json$/i, '');
  exportQR(trimmed + '.json');
};

// Wrapper: run import then show validation report if needed
const _fileNameWrap = document.getElementById('loadedFileNameWrap');
const _fileNameEl   = document.getElementById('loadedFileName');

function _setFileName(name) {
  if (name) {
    _fileNameEl.textContent = name;
    _fileNameWrap.style.display = 'inline-flex';
  } else {
    _fileNameEl.textContent = '';
    _fileNameWrap.style.display = 'none';
  }
}

// Show × button and variables card whenever the tree has nodes
effect(() => {
  const hasNodes = tree.length > 0;
  document.getElementById('variablesCard').style.display       = hasNodes ? '' : 'none';
  document.getElementById('validateBtn').style.display         = hasNodes ? '' : 'none';
  document.getElementById('exportFhirBtn').style.display       = hasNodes ? '' : 'none';
  document.getElementById('exportResponseBtn').style.display   = hasNodes ? '' : 'none';
  document.getElementById('loadAnswersItem').style.display     = hasNodes ? '' : 'none';
  document.getElementById('loadAnswersSep').style.display      = hasNodes ? '' : 'none';
  if (hasNodes) {
    _fileNameWrap.style.display = 'inline-flex';
  } else {
    _fileNameEl.textContent = '';
    _fileNameWrap.style.display = 'none';
  }
});

async function _clearForm() {
  // If tree has content, ask about export first
  if (tree.length > 0) {
    const choice = await _askBeforeClear();
    if (choice === 'cancel') return;
    if (choice === 'export') {
      const issues = validateTree(tree, values);
      if (issues.length === 0) {
        _promptExport(_doReset);
        return;
      } else {
        // Show modal; after export (or skip) we do NOT auto-clear — user decides
        validateModal.show('Export — Validation Report', issues, 'export', {
          onExport: () => { _promptExport(_doReset); },
          onNavigate: _navigateToNode,
        });
        return;
      }
    }
  }
  _doReset();
}

function _doReset() {
  // Clear reactive tree
  tree.splice(0, tree.length);
  // Clear plain values store
  for (const k of Object.keys(values)) delete values[k];
  // Clear rawFhir
  rawFhir.value = null;
  // Clear questionnaire-level variables
  questVariables.splice(0);
  variablesPanel.refresh();
  // Re-render empty builder
  renderTree();
  _setFileName('');
  autosave.clearDraft();
}

// Returns promise resolving to 'export' | 'clear' | 'cancel'
function _askBeforeClear() {
  return new Promise(resolve => {
    const backdrop = document.createElement('div');
    backdrop.className = 'clear-confirm-backdrop';

    const box = document.createElement('div');
    box.className = 'clear-confirm-box';
    box.innerHTML =
      '<div class="clear-confirm-title">Clear questionnaire?</div>' +
      '<div class="clear-confirm-msg">You have unsaved changes. Do you want to export before clearing?</div>' +
      '<div class="clear-confirm-btns">' +
        '<button class="btn-fhir btn-fhir-export" id="_ccExport" data-testid="clear-confirm-export-btn">⬇ Export first</button>' +
        '<button class="btn-fhir" id="_ccClear" data-testid="clear-confirm-clear-btn">Clear anyway</button>' +
        '<button class="btn-fhir" id="_ccCancel" data-testid="clear-confirm-cancel-btn">Cancel</button>' +
      '</div>';

    backdrop.appendChild(box);
    document.body.appendChild(backdrop);

    const close = (result) => { backdrop.remove(); resolve(result); };
    box.querySelector('#_ccExport').onclick  = () => close('export');
    box.querySelector('#_ccClear').onclick   = () => close('clear');
    box.querySelector('#_ccCancel').onclick  = () => close('cancel');
    backdrop.addEventListener('click', e => { if (e.target === backdrop) close('cancel'); });
  });
}

async function _importAndValidate(data, fileName) {
  // importFHIR is sync (parses tree); skip its internal renderTree, do async render instead
  importFHIR(data, () => {}); // pass no-op renderFn — we render below
  variablesPanel.refresh();
  reinitForm(); // evaluate initialExpression fields from imported data
  const issues = validateTree(tree, values);
  progress.show('Rendering ' + tree.length + ' nodes…');
  await renderTreeAsync((done, total) => progress.update(done, total));
  expandAll();
  progress.hide();
  _setFileName(fileName || '');
  if (issues.length > 0) validateModal.show('Import — Validation Report', issues, 'import', { onNavigate: _navigateToNode });
}

function _navigateToNode(nodeId) {
  const target = document.querySelector(`[data-node-id="${nodeId}"]`);
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

// ── Load dropdown ─────────────────────────────────────────────────────────────
const loadMenu         = document.getElementById('loadMenu');
const loadRecentItem   = document.getElementById('loadRecentItem');
const loadRecentSep    = document.getElementById('loadRecentSep');

function _syncRecentItem() {
  const meta = autosave.getDraftMeta();
  if (meta) {
    const d = new Date(meta.savedAt);
    const ts = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    loadRecentItem.textContent = '\u{1F552} Recent: ' + (meta.title || 'draft') + ' (' + ts + ')';
    loadRecentItem.style.display = '';
    loadRecentSep.style.display  = '';
  } else {
    loadRecentItem.style.display = 'none';
    loadRecentSep.style.display  = 'none';
  }
}

document.getElementById('loadFhirBtn').onclick = e => {
  e.stopPropagation();
  if (loadMenu.style.display === 'none') _syncRecentItem();
  loadMenu.style.display = loadMenu.style.display === 'none' ? 'block' : 'none';
};
loadRecentItem.onclick = () => {
  loadMenu.style.display = 'none';
  const data = autosave.getDraftData();
  if (!data) return;
  const meta = autosave.getDraftMeta();
  const label = (meta && meta.title) ? meta.title : 'autosave-draft';
  progress.show('Loading recent draft…');
  _importAndValidate(data, label);
};

document.getElementById('loadFromFileItem').onclick = () => {
  loadMenu.style.display = 'none';
  document.getElementById('fhirFileInput').click();
};
document.querySelectorAll('#loadMenu [data-sample]').forEach(item => {
  item.onclick = () => {
    loadMenu.style.display = 'none';
    const name = item.dataset.sample.replace(/\.fhir\.json$/, '').replace(/-/g, ' ');
    progress.show('Loading ' + name + '…');
    fetch('sampledata/' + item.dataset.sample)
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(data => { progress.update(0, 1); _importAndValidate(data, item.dataset.sample.replace(/\.fhir\.json$/, '')); })
      .catch(err => { progress.hide(); alert('Could not load sample: ' + err.message); });
  };
});
document.getElementById('fhirFileInput').onchange  = e => {
  const file = e.target.files[0];
  if (!file) return;
  progress.show('Loading ' + file.name + '…');
  const reader = new FileReader();
  reader.onload  = ev => { try { progress.update(0, 1); _importAndValidate(JSON.parse(ev.target.result), file.name); } catch (err) { progress.hide(); alert('Parse error: ' + err.message); } };
  reader.onerror = () => { progress.hide(); alert('Error reading file.'); };
  reader.readAsText(file);
  e.target.value = '';
};

document.getElementById('loadAnswersItem').onclick = () => {
  loadMenu.style.display = 'none';
  document.getElementById('qrFileInput').click();
};
document.getElementById('qrFileInput').onchange = e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      _applyQRAnswers(JSON.parse(ev.target.result));
    } catch (err) {
      alert('Parse error: ' + err.message);
    }
  };
  reader.onerror = () => { alert('Error reading file.'); };
  reader.readAsText(file);
  e.target.value = '';
};

function _applyQRAnswers(qr) {
  const result = importQRAnswers(qr, values, tree);
  if (!result.ok) { alert('Cannot load answers: ' + result.error); return; }

  // Check questionnaire URL match
  const currentUrl = (rawFhir.value && (rawFhir.value.url || rawFhir.value.id)) || '';
  const issues = [];
  if (result.questionnaire && currentUrl && result.questionnaire !== currentUrl) {
    issues.push({
      severity: 'warning', nodeId: null,
      message: 'QR questionnaire "' + result.questionnaire + '" does not match loaded questionnaire "' + currentUrl + '"',
    });
  }
  if (result.unmatched.length > 0) {
    const preview = result.unmatched.slice(0, 5).join(', ') + (result.unmatched.length > 5 ? '…' : '');
    issues.push({
      severity: 'warning', nodeId: null,
      message: result.unmatched.length + ' answer(s) in response not found in questionnaire: ' + preview,
    });
  }

  // Trigger reactive re-render
  _formTick.value++;

  if (issues.length > 0) {
    validateModal.show('Load Answers — ' + result.loaded + ' loaded', issues, 'import', { onNavigate: _navigateToNode });
  }
}

// Close any open ⊕ Add dropdown when clicking outside
document.addEventListener('click', () => {
  document.querySelectorAll('.action-add-menu').forEach(m => { m.style.display = 'none'; });
  loadMenu.style.display = 'none';
  const ppMenu = document.getElementById('patientPresetMenu');
  if (ppMenu) ppMenu.style.display = 'none';
});

// ── Panel resize drag ─────────────────────────────────────────────────────────
{
  const resizer   = document.getElementById('panelResizer');
  const leftPanel = document.querySelector('.left-panel');
  const STORAGE_KEY = 'leftPanelWidth';
  const MIN = 200, MAX = () => window.innerWidth * 0.7;

  // Restore saved width
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) leftPanel.style.width = saved + 'px';

  let startX, startW;
  resizer.addEventListener('mousedown', e => {
    e.preventDefault();
    startX = e.clientX;
    startW = leftPanel.getBoundingClientRect().width;
    resizer.classList.add('resizing');

    // Overlay captures all pointer events and prevents text selection during drag
    const overlay = document.createElement('div');
    overlay.id = 'resize-overlay';
    overlay.className = 'resize-overlay';
    document.body.appendChild(overlay);

    const onMove = e => {
      const w = Math.min(MAX(), Math.max(MIN, startW + e.clientX - startX));
      leftPanel.style.width = w + 'px';
    };
    const onUp = () => {
      resizer.classList.remove('resizing');
      overlay.remove();
      localStorage.setItem(STORAGE_KEY, parseInt(leftPanel.style.width));
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

// Start empty — use Example button or Load FHIR JSON to load data
const _autosaveToggleBtn = document.getElementById('autosaveToggleBtn');
const _syncAutosaveState = (enabled, lastSaveDate) => {
  _autosaveToggleBtn.classList.toggle('btn-fhir--active', enabled);
  if (enabled) {
    const label = lastSaveDate
      ? 'autosave \u00b7 ' + String(lastSaveDate.getHours()).padStart(2,'0') + ':' + String(lastSaveDate.getMinutes()).padStart(2,'0')
      : 'autosave';
    _autosaveToggleBtn.textContent = label;
  } else {
    _autosaveToggleBtn.textContent = 'autosave off';
  }
};
_syncAutosaveState(autosave.isEnabled(), null);
_autosaveToggleBtn.addEventListener('click', () => {
  const next = !autosave.isEnabled();
  autosave.setEnabled(next);
  _syncAutosaveState(next, null);
});
autosave.init(buildFHIRObject, (date) => {
  _syncAutosaveState(autosave.isEnabled(), date);
});