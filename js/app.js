// Entry point: wires patient inputs, toolbar buttons, and loads the built-in example.
import { age, gender, bmi, pregnant, smoker, proc, comorb } from './patient.js';
import { tree, values, rawFhir, calcTested, _formTick, effect } from './state.js';
import { importFHIR } from './fhir/import.js';
import { exportFHIR } from './fhir/export.js';
import { validateTree } from './fhir/validate.js';
import * as validateModal from './ui/validate-modal.js';
import * as progress from './ui/progress.js';
import { renderTree, collapseAll, expandAll, renumberAll, addRootGroup, renderTreeAsync } from './render-builder.js';
import './render-preview.js'; // side-effect: registers the reactive effect()
import { buildQR } from './fhir/qr-builder.js';
import { evalCalcNodes } from './fhir/calc.js';

// fhirpath.js v4 browser bundle loaded as global via lib/fhirpath.min.js
const fhirpath = window.fhirpath;

// Wire patient-data inputs to reactive refs
[
  ['inp-age',    age,    v => parseFloat(v) || 0],
  ['inp-bmi',    bmi,    v => parseFloat(v) || 0],
  ['inp-proc',   proc,   v => v],
  ['inp-comorb', comorb, v => v],
  ['inp-gender', gender, v => v],
].forEach(([id, r, parse]) => {
  document.getElementById(id).addEventListener('input', e => {
    r.value = parse(e.target.value);
  });
});
document.getElementById('inp-pregnant').addEventListener('change', e => { pregnant.value = e.target.checked; });
document.getElementById('inp-smoker').addEventListener('change',   e => { smoker.value   = e.target.checked; });

// Buttons
document.getElementById('clearFormBtn').onclick    = _clearForm;
document.getElementById('addRootGroupBtn').onclick = () => {
  addRootGroup();
  // If no file is loaded, show a default name so the × button makes sense
  if (!_fileNameEl.textContent) _setFileName('New Questionnaire');
};
document.getElementById('testBtn').onclick = () => {
  if (rawFhir.value && fhirpath) {
    const plainFhir = JSON.parse(JSON.stringify(rawFhir.value));
    const qr = buildQR(plainFhir, values);
    evalCalcNodes(tree, qr, fhirpath, values);
    calcTested.value = true;
  }
  _formTick.value++;
};
document.getElementById('collapseAllBtn').onclick  = collapseAll;
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
  const format = document.getElementById('renumberFormat').value;
  await renumberAll(format);
};
// ── Validate modal init ───────────────────────────────────────────────────
const _modal = document.getElementById('validateModal');
validateModal.init({
  backdrop:    _modal,
  headerTitle: _modal.querySelector('.validate-modal-header span'),
  body:        _modal.querySelector('.validate-modal-body'),
  footer:      _modal.querySelector('.validate-modal-footer'),
  closeBtn:    _modal.querySelector('.validate-modal-close'),
});

// ── Global progress bar init ──────────────────────────────────────────────
progress.init({
  wrap:    document.getElementById('progressWrap'),
  bar:     document.getElementById('progressBar'),
  label:   document.getElementById('progressLabel'),
  blocker: document.getElementById('uiBlocker'),
});

// Prompt for filename then export
function _promptExport(afterExport) {
  const suggested = (_fileNameEl && _fileNameEl.textContent.trim()) || 'questionnaire';
  const name = window.prompt('Save as:', suggested + '.json');
  if (name === null) return; // cancelled
  const trimmed = (name.trim() || suggested).replace(/\.json$/i, '');
  exportFHIR(trimmed + '.json');
  if (afterExport) afterExport();
}

document.getElementById('exportFhirBtn').onclick = () => {
  const issues = validateTree(tree, values);
  if (issues.length === 0) { _promptExport(); return; }
  validateModal.show('Export — Validation Report', issues, 'export', { onExport: () => _promptExport(), onNavigate: _navigateToNode });
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

// Show × button whenever the tree has nodes (even when built manually, without a loaded file)
effect(() => {
  const hasNodes = tree.length > 0;
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
  calcTested.value = false;
  // Explicitly reset finalResult (class carries pass/fail styling even when innerHTML empty)
  const finalEl = document.getElementById('finalResult');
  finalEl.innerHTML = '';
  finalEl.className = 'final-result';
  finalEl.style.display = 'none';
  // Re-render empty builder
  renderTree();
  _setFileName('');
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
        '<button class="btn-fhir btn-fhir-export" id="_ccExport">⬇ Export first</button>' +
        '<button class="btn-fhir" id="_ccClear">Clear anyway</button>' +
        '<button class="btn-fhir" id="_ccCancel">Cancel</button>' +
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
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.classList.add('node-flash');
  setTimeout(() => target.classList.remove('node-flash'), 1000);
}

// ── Load dropdown ─────────────────────────────────────────────────────────────
const loadMenu = document.getElementById('loadMenu');
document.getElementById('loadFhirBtn').onclick = e => {
  e.stopPropagation();
  loadMenu.style.display = loadMenu.style.display === 'none' ? 'block' : 'none';
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

// Close any open ⊕ Add dropdown when clicking outside
document.addEventListener('click', () => {
  document.querySelectorAll('.action-add-menu').forEach(m => { m.style.display = 'none'; });
  loadMenu.style.display = 'none';
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
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;cursor:col-resize;';
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