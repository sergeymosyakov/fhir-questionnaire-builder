// File loading, QR answers, import pipeline, and filename display.
// Exports: setFileName, navigateToNode, importAndValidate
import { tree, values, rawFhir, effect } from './state.js';
import { _formTick } from './render-bus.js';
import { showError } from './ui/toast.js';
import { importFHIR } from './fhir/import.js';
import { importQRAnswers } from './fhir/qr-import.js';
import { validateTree } from './fhir/validate.js';
import * as validateModal from './ui/modals/validate-modal.js';
import * as libraryModal from './ui/modals/library-modal.js';
import * as progress from './ui/progress.js';
import * as autosave from './ui/autosave.js';
import { expandAll, renderTreeAsync } from './render-builder.js';
import { reinitForm, resetCollapsedFromTree } from './render-preview.js';

// ── File name display ─────────────────────────────────────────────────────────
const _fileNameWrap = document.getElementById('loadedFileNameWrap');
const _fileNameEl   = document.getElementById('loadedFileName');

export function setFileName(name) {
  if (name) {
    _fileNameEl.textContent = name;
    _fileNameWrap.style.display = 'inline-flex';
  } else {
    _fileNameEl.textContent = '';
    _fileNameWrap.style.display = 'none';
  }
}

// Show toolbar sections and file name whenever the tree has nodes
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
  } catch (err) {
    showError('Import error: ' + err.message);
  } finally {
    progress.hide();
  }
}

// ── Read JSON file helper ─────────────────────────────────────────────────────
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

// ── Load dropdown ─────────────────────────────────────────────────────────────
const _loadMenu       = document.getElementById('loadMenu');
const _loadRecentItem = document.getElementById('loadRecentItem');
const _loadRecentSep  = document.getElementById('loadRecentSep');

function _syncRecentItem() {
  const meta = autosave.getDraftMeta();
  if (meta) {
    const d = new Date(meta.savedAt);
    const ts = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    _loadRecentItem.textContent = '\uD83D\uDD52 Recent: ' + (meta.title || 'draft') + ' (' + ts + ')';
    _loadRecentItem.style.display = '';
    _loadRecentSep.style.display  = '';
  } else {
    _loadRecentItem.style.display = 'none';
    _loadRecentSep.style.display  = 'none';
  }
}

document.getElementById('loadFhirBtn').onclick = e => {
  e.stopPropagation();
  document.getElementById('exportMenu').style.display  = 'none';
  document.getElementById('answersMenu').style.display = 'none';
  if (_loadMenu.style.display === 'none') _syncRecentItem();
  _loadMenu.style.display = _loadMenu.style.display === 'none' ? 'block' : 'none';
};

_loadRecentItem.onclick = () => {
  _loadMenu.style.display = 'none';
  const data = autosave.getDraftData();
  if (!data) return;
  const meta = autosave.getDraftMeta();
  const label = (meta && meta.title) ? meta.title : 'autosave-draft';
  progress.show('Loading recent draft\u2026');
  importAndValidate(data, label);
};

document.getElementById('loadFromFileItem').onclick = () => {
  _loadMenu.style.display = 'none';
  document.getElementById('fhirFileInput').click();
};

document.getElementById('loadLibraryItem').onclick = () => {
  _loadMenu.style.display = 'none';
  libraryModal.open('fhir-r4', item => {
    progress.show('Loading ' + item.label + '\u2026');
    fetch('sampledata/' + item.file)
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(data => { progress.update(0, 1); importAndValidate(data, item.label); })
      .catch(err => { progress.hide(); showError('Could not load sample: ' + err.message); });
  }, 'questionnaire');
};

document.getElementById('fhirFileInput').onchange = e => {
  const fileName = e.target.files[0]?.name;
  if (!fileName) return;
  progress.show('Loading ' + fileName + '\u2026');
  _readFileAsJSON(e, (data, name) => { progress.update(0, 1); importAndValidate(data, name); });
};

// ── Answers (QuestionnaireResponse) ──────────────────────────────────────────
const _answersMenu = document.getElementById('answersMenu');

document.getElementById('answersBtn').onclick = e => {
  e.stopPropagation();
  _loadMenu.style.display = 'none';
  document.getElementById('exportMenu').style.display = 'none';
  _answersMenu.style.display = _answersMenu.style.display === 'none' ? 'block' : 'none';
};

document.getElementById('loadAnswersItem').onclick = () => {
  _answersMenu.style.display = 'none';
  document.getElementById('qrFileInput').click();
};

document.getElementById('qrFileInput').onchange = e => {
  _readFileAsJSON(e, data => _applyQRAnswers(data));
};

document.getElementById('loadAnswersLibraryItem').onclick = () => {
  _answersMenu.style.display = 'none';
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
