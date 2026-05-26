// Entry point: wires toolbar buttons, patient context popup, and loads the built-in example.
import { tree, values, rawFhir, effect, clearAllValues } from './state.js';
import { showError } from './ui/toast.js';
import { _formTick } from './render-bus.js';
import { importFHIR } from './fhir/import.js';
import { buildFHIRObject, exportFHIR } from './fhir/export.js';
import { importQRAnswers } from './fhir/qr-import.js';
import { validateTree } from './fhir/validate.js';
import * as validateModal from './ui/modals/validate-modal.js';
import * as progress from './ui/progress.js';
import * as search from './ui/search.js';
import * as tooltip from './ui/tooltip.js';
import * as autosave from './ui/autosave.js';
import * as statusBadge from './ui/status-badge.js';
import * as variablesPanel from './ui/variables-panel.js';
import * as containedPanel from './ui/contained-panel.js';
import * as answerValueSetPanel from './ui/answer-valueset-panel.js';
import * as jsonViewer from './ui/modals/json-viewer.js';
import * as patientCtx from './ui/patient-ctx.js';
import * as showWhenModal from './ui/modals/showwhen-modal.js';
import * as constraintModal from './ui/modals/constraint-modal.js';
import * as expressionModal from './ui/modals/expression-modal.js';
import * as initialModal from './ui/modals/initial-modal.js';
import * as appearanceModal from './ui/modals/appearance-modal.js';
import * as repeatableModal from './ui/modals/repeatable-modal.js';
import * as statesModal from './ui/modals/states-modal.js';
import * as answerTypeModal from './ui/modals/answer-type/modal.js';
import * as metadataModal from './ui/modals/metadata-modal.js';
import * as codesModal from './ui/modals/codes-modal.js';
import * as qrExportModal from './ui/modals/qr-export-modal.js';
import * as libraryModal from './ui/modals/library-modal.js';
import * as noteModal from './ui/modals/note-modal.js';
import { renderTree, collapseAll, expandAll, renumberAll, addRootGroup, renderTreeAsync } from './render-builder.js';
import { navigateToPreview, reinitForm, initPreview, resetCollapsedFromTree } from './render-preview.js';
import { questVariables, questContained, questMeta } from './state.js';

// Buttons
document.getElementById('clearFormBtn').onclick    = _clearForm;

// ── DOM helpers ───────────────────────────────────────────────────────────────
// Returns an object with standard modal element keys for modals whose inner
// element IDs follow the pattern: <id>, <id>Title, <id>Body, <id>Close,
// <id>Cancel, <id>Apply, <id>Footer. Missing elements are omitted.
function _modalElements(id) {
  const map = { '': 'modal', Title: 'title', Body: 'body', Close: 'closeBtn', Cancel: 'cancelBtn', Apply: 'applyBtn', Footer: 'footer' };
  const result = {};
  for (const [suffix, key] of Object.entries(map)) {
    const el = document.getElementById(id + suffix);
    if (el) result[key] = el;
  }
  return result;
}

// Reads the first file from a file input event, parses it as JSON, and calls
// onData(parsedObject, fileName). Clears the input value so the same file can
// be re-selected. Error handling shows alert on parse failure.
function _readFileAsJSON(e, onData) {
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
document.getElementById('addRootGroupBtn').onclick = () => {
  addRootGroup();
  // If no file is loaded, show a default name so the × button makes sense
  if (!_fileNameEl.textContent) _setFileName('New Questionnaire');
};
document.getElementById('collapseAllBtn').onclick  = collapseAll;

// Wire a toggle button: click flips stateRef.value and updates active class.
function wireToggle(btnId, prefKey) {
  const btn = document.getElementById(btnId);
  btn.onclick = () => {
    const newVal = !btn.classList.contains('btn-fhir--active');
    btn.classList.toggle('btn-fhir--active', newVal);
    document.dispatchEvent(new CustomEvent('view-pref-change', { detail: { key: prefKey, value: newVal } }));
  };
}
wireToggle('showLinkIdBtn',  'showLinkId');
wireToggle('showPrefixBtn',  'showPrefix');
wireToggle('showBadgesBtn',  'showBadges');
wireToggle('showHiddenBtn',  'showHiddenItems');
document.getElementById('expandAllBtn').onclick    = expandAll;
document.getElementById('renumberBtn').onclick = async () => {
  const btn = document.getElementById('renumberBtn');
  btn.disabled = true;
  progress.show('Renumbering…');
  const onProgress = e => progress.update(e.detail.done, e.detail.total);
  const cleanup = () => {
    progress.hide();
    btn.disabled = false;
    document.removeEventListener('renumber-progress', onProgress);
    document.removeEventListener('renumber-done', cleanup);
  };
  document.addEventListener('renumber-progress', onProgress);
  document.addEventListener('renumber-done', cleanup);
  try { await renumberAll(); } catch { cleanup(); }
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
});// ── Codes modal init ────────────────────────────────────
codesModal.init({
  modal:     document.getElementById('codesModal'),
  title:     document.getElementById('codesModalTitle'),
  body:      document.getElementById('codesModalBody'),
  closeBtn:  document.getElementById('codesModalClose'),
  cancelBtn: document.getElementById('codesModalCancel'),
  applyBtn:  document.getElementById('codesModalApply'),
});// ── Expression modal init ────────────────────────────────────────
expressionModal.init({
  modal:     document.getElementById('expressionModal'),
  title:     document.getElementById('exprModalTitle'),
  body:      document.getElementById('exprModalBody'),
  closeBtn:  document.getElementById('exprModalClose'),
  cancelBtn: document.getElementById('exprModalCancel'),
  applyBtn:  document.getElementById('exprModalApply'),
});
// ── Validate modal init ───────────────────────────────────────────────────
validateModal.init({
  modal:    document.getElementById('validateModal'),
  title:    document.getElementById('validateModalTitle'),
  body:     document.getElementById('validateModalBody'),
  footer:   document.getElementById('validateModalFooter'),
  closeBtn: document.getElementById('validateModalClose'),
});

// ── Default Value modal init ──────────────────────────────────────────────────
initialModal.init({
  modal:     document.getElementById('initialModal'),
  title:     document.getElementById('initialModalTitle'),
  body:      document.getElementById('initialModalBody'),
  closeBtn:  document.getElementById('initialModalClose'),
  cancelBtn: document.getElementById('initialModalCancel'),
  applyBtn:  document.getElementById('initialModalApply'),
});
// ── Repeatable modal init ────────────────────────────────────────────────────
repeatableModal.init({
  modal:     document.getElementById('repeatableModal'),
  title:     document.getElementById('repeatableModalTitle'),
  body:      document.getElementById('repeatableModalBody'),
  closeBtn:  document.getElementById('repeatableModalClose'),
  cancelBtn: document.getElementById('repeatableModalCancel'),
  applyBtn:  document.getElementById('repeatableModalApply'),
});
// ── States modal init (Required / Read-only / Hidden) ───────────────────────
statesModal.init({
  modal:     document.getElementById('statesModal'),
  title:     document.getElementById('statesModalTitle'),
  body:      document.getElementById('statesModalBody'),
  closeBtn:  document.getElementById('statesModalClose'),
  cancelBtn: document.getElementById('statesModalCancel'),
  applyBtn:  document.getElementById('statesModalApply'),
});
// ── Design Note modal init ───────────────────────────────────────────────────
noteModal.init({
  modal:     document.getElementById('designNoteModal'),
  title:     document.getElementById('designNoteModalTitle'),
  body:      document.getElementById('designNoteModalBody'),
  closeBtn:  document.getElementById('designNoteModalClose'),
  cancelBtn: document.getElementById('designNoteModalCancel'),
  applyBtn:  document.getElementById('designNoteModalApply'),
});
// ── Answer Type modal init ─────────────────────────────────────────────
answerTypeModal.init({
  modal:     document.getElementById('answerTypeModal'),
  title:     document.getElementById('answerTypeModalTitle'),
  body:      document.getElementById('answerTypeModalBody'),
  closeBtn:  document.getElementById('answerTypeModalClose'),
  cancelBtn: document.getElementById('answerTypeModalCancel'),
  applyBtn:  document.getElementById('answerTypeModalApply'),
});
// ── Metadata (Properties) modal init ──────────────────────────────────────────
metadataModal.init({
  modal:     document.getElementById('metadataModal'),
  title:     document.getElementById('metadataModalTitle'),
  body:      document.getElementById('metadataModalBody'),
  closeBtn:  document.getElementById('metadataModalClose'),
  cancelBtn: document.getElementById('metadataModalCancel'),
  applyBtn:  document.getElementById('metadataModalApply'),
});
// ── Appearance modal init ─────────────────────────────────────────────────────
appearanceModal.init({
  modal:     document.getElementById('appearanceModal'),
  title:     document.getElementById('appearanceModalTitle'),
  body:      document.getElementById('appearanceModalBody'),
  closeBtn:  document.getElementById('appearanceModalClose'),
  cancelBtn: document.getElementById('appearanceModalCancel'),
  applyBtn:  document.getElementById('appearanceModalApply'),
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
}, questVariables);

// QR Export modal init ─────────────────────────────────────────────────
qrExportModal.init({
  modal:     document.getElementById('qrExportModal'),
  title:     document.getElementById('qrExportModalTitle'),
  body:      document.getElementById('qrExportModalBody'),
  closeBtn:  document.getElementById('qrExportModalClose'),
  cancelBtn: document.getElementById('qrExportModalCancel'),
  applyBtn:  document.getElementById('qrExportModalApply'),
});
libraryModal.init({
  modal:    document.getElementById('libraryModal'),
  closeBtn: document.getElementById('libraryModalClose'),
  cancelBtn: document.getElementById('libraryModalCloseBtn'),
  body:     document.getElementById('libraryModalBody'),
});
// ── JSON Viewer modal init ────────────────────────────────────────────────
jsonViewer.init({
  modal:     document.getElementById('fhirJsonModal'),
  title:     document.getElementById('fhirJsonModalTitle'),
  pre:       document.getElementById('fhirJsonModalPre'),
  closeBtn:  document.getElementById('fhirJsonModalClose'),
  cancelBtn: document.getElementById('fhirJsonModalCloseBtn'),
});

// ── Contained resources panel init ───────────────────────────────────────
containedPanel.init({
  card:     document.getElementById('containedCard'),
  toggle:   document.getElementById('containedCardToggle'),
  chipList: document.getElementById('containedCardChips'),
  count:    document.getElementById('containedCardCount'),
}, questContained);

// ── Answer ValueSet panel init ────────────────────────────────────────────
answerValueSetPanel.init({
  card:     document.getElementById('answerValueSetCard'),
  toggle:   document.getElementById('answerValueSetCardToggle'),
  chipList: document.getElementById('answerValueSetCardChips'),
  count:    document.getElementById('answerValueSetCardCount'),
}, tree);

// ── Patient context popup init ────────────────────────────────────────────
patientCtx.init({
  presetBtn: document.getElementById('patientPresetBtn'),
  presetMenu: document.getElementById('patientPresetMenu'),
  modal:    document.getElementById('patientCtxModal'),
  closeBtn: document.getElementById('patientCtxClose'),
  applyBtn: document.getElementById('patientCtxApply'),
  body:     document.getElementById('patientCtxBody'),
}, questVariables);

// Refresh variables panel chips when patient context changes
document.addEventListener('patient-ctx-applied', () => variablesPanel.refresh());
// Re-evaluate FHIRPath when variables or patient context change
document.addEventListener('reinit-form', reinitForm);
// Open JSON viewer via event bus
document.addEventListener('show-json', e => jsonViewer.show(e.detail.title, e.detail.data));

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
  input:       document.getElementById('searchInput'),
  prevBtn:     document.getElementById('searchPrevBtn'),
  nextBtn:     document.getElementById('searchNextBtn'),
  counter:     document.getElementById('searchCounter'),
  lform:       document.getElementById('lform'),
  fhirJsonView: document.getElementById('fhirJsonView'),
});

// ── Preview module init ──────────────────────────────────────────────────────
initPreview({
  lform:                 document.getElementById('lform'),
  fhirJsonView:          document.getElementById('fhirJsonView'),
  leftPanelBody:         document.querySelector('.left-panel-body'),
  showLinkIdBtn:         document.getElementById('showLinkIdBtn'),
  showPrefixBtn:         document.getElementById('showPrefixBtn'),
  showBadgesBtn:         document.getElementById('showBadgesBtn'),
  showHiddenBtn:         document.getElementById('showHiddenBtn'),
  previewModeWrap:       document.getElementById('previewModeWrap'),
  previewCollapseAllBtn: document.getElementById('previewCollapseAllBtn'),
  previewExpandAllBtn:   document.getElementById('previewExpandAllBtn'),
  searchWrap:            document.getElementById('searchWrap'),
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

// ── Properties button ────────────────────────────────────────────────────────
document.getElementById('propertiesBtn').onclick = () => metadataModal.open();

// Sync metadata card summary whenever questMeta changes
const _metaCardStatus       = document.getElementById('questMetaCardStatus');
const _metaCardExperimental = document.getElementById('questMetaCardExperimental');
effect(() => {
  _metaCardStatus.textContent    = questMeta.status || 'draft';
  _metaCardStatus.dataset.status = questMeta.status || 'draft';
  const exp = questMeta.experimental;
  if (exp === null || exp === undefined) {
    _metaCardExperimental.style.display = 'none';
  } else {
    _metaCardExperimental.style.display  = '';
    _metaCardExperimental.textContent    = exp ? '⚗ experimental' : '✓ production';
    _metaCardExperimental.dataset.exp    = String(exp);
  }
});

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

// ── Export dropdown ──────────────────────────────────────────────────────────
const exportMenu = document.getElementById('exportMenu');
document.getElementById('exportBtn').onclick = e => {
  e.stopPropagation();
  loadMenu.style.display = 'none';
  answersMenu.style.display = 'none';
  exportMenu.style.display = exportMenu.style.display === 'none' ? 'block' : 'none';
};
document.getElementById('exportFhirItem').onclick = () => {
  exportMenu.style.display = 'none';
  const issues = validateTree(tree, values);
  if (issues.length === 0) { _promptExport(); return; }
  validateModal.show('Export — Validation Report', issues, 'export', { onExport: () => _promptExport(), onNavigate: _navigateToNode });
};
document.getElementById('exportQrItem').onclick = () => {
  exportMenu.style.display = 'none';
  const suggested = (_fileNameEl && _fileNameEl.textContent.trim()) || 'questionnaire';
  qrExportModal.open(suggested + '-response.json');
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
  document.getElementById('variablesCard').style.display = hasNodes ? '' : 'none';
  document.getElementById('validateBtn').style.display   = hasNodes ? '' : 'none';
  document.getElementById('exportWrap').style.display    = hasNodes ? '' : 'none';
  document.getElementById('questMetaCard').style.display = hasNodes ? '' : 'none';
  document.getElementById('answersWrap').style.display   = hasNodes ? '' : 'none';
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
  clearAllValues();
  // Clear rawFhir
  rawFhir.value = null;
  // Reset questionnaire-level metadata
  questMeta.id = ''; questMeta.url = ''; questMeta.version = '';
  questMeta.title = ''; questMeta.status = 'draft';
  questMeta.publisher = ''; questMeta.description = ''; questMeta.name = '';
  questMeta.date = ''; questMeta.subjectType = 'Patient';
  questMeta.purpose = ''; questMeta.copyright = '';
  questMeta.approvalDate = ''; questMeta.lastReviewDate = '';
  questMeta.effectivePeriodStart = ''; questMeta.effectivePeriodEnd = '';
  questMeta.experimental = null; questMeta.language = ''; questMeta.derivedFrom = [];
  questMeta.replaces = [];
  questMeta._rawIdentifier = [];
  questMeta._rawText = null;
  questMeta._rawContact = null; questMeta._rawUseContext = null; questMeta._rawJurisdiction = null;
  questMeta._rawCode = null;
  questMeta._metaVersionId = ''; questMeta._metaSource = '';
  questMeta._metaLastUpdated = ''; questMeta._rawMetaProfile = [];
  questMeta._rawMetaTag = []; questMeta._rawMetaSecurity = [];
  questMeta._rawQuestExtensions = [];
  // Clear questionnaire-level variables
  questVariables.splice(0);
  questContained.splice(0);
  // Re-render empty builder
  renderTree();
  _setFileName('');
  autosave.clearDraft();
  document.dispatchEvent(new CustomEvent('questionnaire-cleared'));
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

    const esc = e => { if (e.key === 'Escape') close('cancel'); };
    document.addEventListener('keydown', esc);
    const close = (result) => { document.removeEventListener('keydown', esc); backdrop.remove(); resolve(result); };
    box.querySelector('#_ccExport').onclick  = () => close('export');
    box.querySelector('#_ccClear').onclick   = () => close('clear');
    box.querySelector('#_ccCancel').onclick  = () => close('cancel');
    backdrop.addEventListener('click', e => { if (e.target === backdrop) close('cancel'); });
  });
}

async function _importAndValidate(data, fileName) {
  // importFHIR is sync (parses tree); skip its internal renderTree, do async render instead
  try {
    importFHIR(data, () => {}); // pass no-op renderFn — we render below
    resetCollapsedFromTree(tree);
    reinitForm(); // evaluate initialExpression fields from imported data
    document.dispatchEvent(new CustomEvent('questionnaire-loaded'));
    const issues = validateTree(tree, values);
    progress.show('Rendering ' + tree.length + ' nodes…');
    await renderTreeAsync((done, total) => progress.update(done, total));
    expandAll();
    document.querySelector('.left-panel-body')?.scrollTo({ top: 0 });
    document.querySelector('.right-panel-body')?.scrollTo({ top: 0 });
    _setFileName(fileName || '');
    if (issues.length > 0) validateModal.show('Import — Validation Report', issues, 'import', { onNavigate: _navigateToNode });
  } catch (err) {
    showError('Import error: ' + err.message);
  } finally {
    progress.hide();
  }
}

function _navigateToNode(nodeId) {
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

// ── Load dropdown ─────────────────────────────────────────────────────────────
const loadMenu         = document.getElementById('loadMenu');
const loadRecentItem   = document.getElementById('loadRecentItem');
const loadRecentSep    = document.getElementById('loadRecentSep');

function _syncRecentItem() {
  const meta = autosave.getDraftMeta();
  if (meta) {
    const d = new Date(meta.savedAt);
    const ts = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    loadRecentItem.textContent = '🕒 Recent: ' + (meta.title || 'draft') + ' (' + ts + ')';
    loadRecentItem.style.display = '';
    loadRecentSep.style.display  = '';
  } else {
    loadRecentItem.style.display = 'none';
    loadRecentSep.style.display  = 'none';
  }
}

document.getElementById('loadFhirBtn').onclick = e => {
  e.stopPropagation();
  exportMenu.style.display = 'none';
  answersMenu.style.display = 'none';
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
document.getElementById('loadLibraryItem').onclick = () => {
  loadMenu.style.display = 'none';
  libraryModal.open('fhir-r4', item => {
    progress.show('Loading ' + item.label + '\u2026');
    fetch('sampledata/' + item.file)
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(data => { progress.update(0, 1); _importAndValidate(data, item.label); })
      .catch(err => { progress.hide(); showError('Could not load sample: ' + err.message); });
  }, 'questionnaire');
};
document.getElementById('fhirFileInput').onchange = e => {
  const fileName = e.target.files[0]?.name;
  if (!fileName) return;
  progress.show('Loading ' + fileName + '\u2026');
  _readFileAsJSON(e, (data, name) => { progress.update(0, 1); _importAndValidate(data, name); });
};

// ── Answers button (load QuestionnaireResponse) ──────────────────────────────────────
const answersMenu = document.getElementById('answersMenu');
document.getElementById('answersBtn').onclick = e => {
  e.stopPropagation();
  loadMenu.style.display = 'none';
  exportMenu.style.display = 'none';
  answersMenu.style.display = answersMenu.style.display === 'none' ? 'block' : 'none';
};
document.getElementById('loadAnswersItem').onclick = () => {
  answersMenu.style.display = 'none';
  document.getElementById('qrFileInput').click();
};
document.getElementById('qrFileInput').onchange = e => {
  _readFileAsJSON(e, (data) => _applyQRAnswers(data));
};

document.getElementById('loadAnswersLibraryItem').onclick = () => {
  answersMenu.style.display = 'none';
  libraryModal.open('qr-responses', item => {
    fetch('sampledata/' + item.file)
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(data => _applyQRAnswers(data))
      .catch(err => showError('Could not load sample response: ' + err.message));
  }, 'qr');
};

function _applyQRAnswers(qr) {
  const result = importQRAnswers(qr, values, tree);
  if (!result.ok) { showError('Cannot load answers: ' + result.error); return; }
  // Dispatch qr-loaded so qr-export-modal can pre-fill its fields
  document.dispatchEvent(new CustomEvent('qr-loaded', { detail: {
    status:  result.meta.status,
    subject: result.meta.subject,
    author:  result.meta.author,
  } }));

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
  exportMenu.style.display = 'none';
  answersMenu.style.display = 'none';
  const ppMenu = document.getElementById('patientPresetMenu');
  if (ppMenu) ppMenu.style.display = 'none';
  const pmMenu = document.getElementById('previewModeMenu');
  if (pmMenu) pmMenu.style.display = 'none';
});

// ── Preview mode dropdown ─────────────────────────────────────────────────────
{
  const _modeMenu = document.getElementById('previewModeMenu');
  const _modeBtn  = document.getElementById('previewModeBtn');
  const _modeLabels = {
    preview: '\uD83D\uDC41\uFE0F Preview \u25BE',
    patient: '\uD83D\uDC64 Patient \u25BE',
    json:    '{} FHIR JSON \u25BE',
  };
  function _applyPreviewMode(mode) {
    document.dispatchEvent(new CustomEvent('preview-mode-change', { detail: { mode } }));
    _modeBtn.textContent = _modeLabels[mode];
    document.querySelectorAll('#previewModeMenu .load-menu-item').forEach(item => {
      item.classList.toggle('load-menu-item--checked', item.dataset.mode === mode);
    });
  }
  _modeBtn.addEventListener('click', e => {
    e.stopPropagation();
    loadMenu.style.display = 'none';
    answersMenu.style.display = 'none';
    exportMenu.style.display = 'none';
    _modeMenu.style.display = _modeMenu.style.display === 'none' ? 'block' : 'none';
  });
  document.querySelectorAll('#previewModeMenu .load-menu-item').forEach(item => {
    item.addEventListener('click', () => {
      _modeMenu.style.display = 'none';
      _applyPreviewMode(item.dataset.mode);
    });
  });
  // Set initial active state
  _applyPreviewMode('preview');
}

// ── Panel resize drag ─────────────────────────────────────────────────────────
{
  const resizer   = document.getElementById('panelResizer');
  const leftPanel = document.querySelector('.left-panel');
  const STORAGE_KEY = 'leftPanelWidth';
  const MIN = 200, MAX = () => window.innerWidth * 0.7;

  // Restore saved width
  let saved;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* private mode / quota */ }
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
      try { localStorage.setItem(STORAGE_KEY, parseInt(leftPanel.style.width)); } catch { /* ignore */ }
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
      ? 'autosave · ' + String(lastSaveDate.getHours()).padStart(2,'0') + ':' + String(lastSaveDate.getMinutes()).padStart(2,'0')
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