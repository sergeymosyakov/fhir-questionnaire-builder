// Entry point: wires patient inputs, toolbar buttons, and loads the built-in example.
import {
  age, gender, bmi, pregnant, smoker, proc, comorb, testMode, tree, makeGroup,
  values, rawFhir, calcTested, _formTick
} from './state.js';
import { importFHIR } from './fhir/import.js';
import { exportFHIR } from './fhir/export.js';
import { renderTree, collapseAll, expandAll, renumberAll } from './render-builder.js';
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
    testMode.value = false;
  });
});
document.getElementById('inp-pregnant').addEventListener('change', e => { pregnant.value = e.target.checked; testMode.value = false; });
document.getElementById('inp-smoker').addEventListener('change',   e => { smoker.value   = e.target.checked; testMode.value = false; });

// Buttons
document.getElementById('addRootGroupBtn').onclick = () => {
  const newNode = makeGroup('Root Group ' + tree.length);
  tree.push(newNode);
  renderTree();
  requestAnimationFrame(() => {
    const el = document.querySelector('[data-node-id="' + newNode.id + '"]');
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('node-flash'); setTimeout(() => el.classList.remove('node-flash'), 1000); }
  });
};
document.getElementById('testBtn').onclick = () => {
  if (rawFhir.value && fhirpath) {
    const plainFhir = JSON.parse(JSON.stringify(rawFhir.value));
    const qr = buildQR(plainFhir, values);
    evalCalcNodes(tree, qr, fhirpath, values);
    calcTested.value = true;
  }
  testMode.value = true;
  _formTick.value++;
};
document.getElementById('collapseAllBtn').onclick  = collapseAll;
document.getElementById('expandAllBtn').onclick    = expandAll;
document.getElementById('renumberBtn').onclick     = () => {
  const format = document.getElementById('renumberFormat').value;
  renumberAll(format);
};
document.getElementById('loadExampleBtn').onclick  = () => loadExampleFile(importFHIR);
document.getElementById('exportFhirBtn').onclick   = exportFHIR;
document.getElementById('loadFhirBtn').onclick     = () => document.getElementById('fhirFileInput').click();
document.getElementById('fhirFileInput').onchange  = e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload  = ev => { try { importFHIR(JSON.parse(ev.target.result)); } catch (err) { alert('Parse error: ' + err.message); } };
  reader.onerror = () => alert('Error reading file.');
  reader.readAsText(file);
  e.target.value = '';
};

// Load built-in example via fetch (requires HTTP server or GitHub Pages)
function loadExampleFile(onLoaded) {
  fetch('sampledata/example-bariatric.fhir.json')
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(onLoaded)
    .catch(err => alert('Could not load example: ' + err.message));
}

// Close any open ⊕ Add dropdown when clicking outside
document.addEventListener('click', () => {
  document.querySelectorAll('.action-add-menu').forEach(m => { m.style.display = 'none'; });
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