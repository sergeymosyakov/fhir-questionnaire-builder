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
    _evalCalcNodes(tree, qr, fhirpath);
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

// Evaluate FHIRPath calculatedExpression on all nodes that have one.
// Writes result (boolean) back to values[node.id].
function _evalCalcNodes(nodes, qr, fp) {
  const env = { resource: qr };
  for (const node of nodes) {
    if (node._calculatedExpr) {
      try {
        const result = fp.evaluate(qr, node._calculatedExpr, env);
        values[node.id] = result[0] === true || result[0] === 'true';
      } catch (e) {
        // silently skip nodes whose expression fails (e.g. missing linkId)
      }
    }
    if (node.type === 'group') _evalCalcNodes(node.children, qr, fp);
  }
}

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

// Start empty — use Example button or Load FHIR JSON to load data