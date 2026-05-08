// Entry point: wires patient inputs, toolbar buttons, and loads the built-in example.
import {
  age, gender, bmi, pregnant, smoker, proc, comorb, testMode, tree, makeGroup
} from './state.js';
import { importFHIR } from './fhir/import.js';
import { exportFHIR } from './fhir/export.js';
import { renderTree } from './render-builder.js';
import './render-preview.js'; // side-effect: registers the reactive effect()

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
document.getElementById('testBtn').onclick         = () => { testMode.value = true; };
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

// Load built-in example (window.EXAMPLE_FHIR_Q set by example-bariatric.fhir.js,
// or falls back to fetch() when running under HTTP server / GitHub Pages).
function loadExampleFile(onLoaded) {
  if (window.EXAMPLE_FHIR_Q) {
    onLoaded(window.EXAMPLE_FHIR_Q);
  } else {
    fetch('example-bariatric.fhir.json')
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(onLoaded)
      .catch(err => alert('Could not load example: ' + err.message));
  }
}

// Start with the built-in example loaded
loadExampleFile(importFHIR);