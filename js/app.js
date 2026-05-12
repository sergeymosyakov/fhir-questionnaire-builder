// Entry point: wires patient inputs, toolbar buttons, and loads the built-in example.
import {
  age, gender, bmi, pregnant, smoker, proc, comorb,
  tree, values, rawFhir, calcTested, _formTick
} from './state.js';
import { importFHIR } from './fhir/import.js';
import { exportFHIR } from './fhir/export.js';
import { validateTree } from './fhir/validate.js';
import * as validateModal from './ui/validate-modal.js';
import { renderTree, collapseAll, expandAll, renumberAll, addRootGroup } from './render-builder.js';
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
document.getElementById('addRootGroupBtn').onclick = addRootGroup;
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
document.getElementById('renumberBtn').onclick     = () => {
  const format = document.getElementById('renumberFormat').value;
  renumberAll(format);
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

document.getElementById('exportFhirBtn').onclick = () => {
  const issues = validateTree(tree);
  if (issues.length === 0) { exportFHIR(); return; }
  validateModal.show('Export — Validation Report', issues, 'export', exportFHIR);
};

// Wrapper: run import then show validation report if needed
function _importAndValidate(data) {
  importFHIR(data);
  const issues = validateTree(tree);
  if (issues.length > 0) validateModal.show('Import — Validation Report', issues, 'import');
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
    fetch('sampledata/' + item.dataset.sample)
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(_importAndValidate)
      .catch(err => alert('Could not load sample: ' + err.message));
  };
});
document.getElementById('fhirFileInput').onchange  = e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload  = ev => { try { _importAndValidate(JSON.parse(ev.target.result)); } catch (err) { alert('Parse error: ' + err.message); } };
  reader.onerror = () => alert('Error reading file.');
  reader.readAsText(file);
  e.target.value = '';
};

// Load built-in example on startup
fetch('sampledata/example-bariatric.fhir.json')
  .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
  .then(importFHIR)  // startup: skip validation report on built-in example
  .catch(err => alert('Could not load example: ' + err.message));

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