// ── Builder shared state and utilities ───────────────────────────────────────
import { buildQR } from '../fhir/qr-builder.js';
import { evalCalcNodes } from '../fhir/calc.js';

const fhirpath = window.fhirpath;

// Injected by index.js via init()
let _deps = null;
export function init(deps) { _deps = deps; }

// UI-only collapse state is owned by index.js and passed via ctx.collapsed.

export function triggerCalcRecalc() {
  const { tree, formTick, rawFhir, calcTested, values } = _deps;
  if (calcTested.value && rawFhir.value && fhirpath) {
    const qr = buildQR(JSON.parse(JSON.stringify(rawFhir.value)), values);
    evalCalcNodes(tree, qr, fhirpath, values);
  }
  formTick.value++;
}

// Collect all item nodes as flat list with breadcrumb labels for dropdowns
export function getAllItems(nodes, result = [], prefix = '') {
  for (const n of nodes) {
    if (n.type === 'item') {
      result.push({ id: n.id, label: (prefix ? prefix + ' › ' : '') + n.title, itemType: n.itemType, options: n.options });
    } else if (n.type === 'group') {
      getAllItems(n.children, result, (prefix ? prefix + ' › ' : '') + n.title);
    }
  }
  return result;
}

// Build or rebuild the success-value sub-UI inside a container div
export function buildSuccessValueUI(node, container) {
  container.innerHTML = '';
  const header = document.createElement('div');
  header.style.marginTop = '6px';

  if (node.itemType === 'checkbox') {
    header.textContent = 'Success when: ';
    const sel = document.createElement('select');
    sel.style.width = 'auto';
    [['true', 'checked'], ['false', 'unchecked']].forEach(([val, label]) => {
      const opt = document.createElement('option');
      opt.value = val; opt.textContent = label;
      if ((node.successValue || 'true') === val) opt.selected = true;
      sel.appendChild(opt);
    });
    if (!node.successValue) node.successValue = 'true';
    sel.onchange = () => { node.successValue = sel.value; };
    header.appendChild(sel);
  } else {
    header.textContent = 'Success value (exact match):';
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.placeholder = node.itemType === 'number' ? 'e.g. 42' : 'e.g. yes';
    inp.value = node.successValue || '';
    inp.style.marginTop = '2px';
    inp.oninput = () => { node.successValue = inp.value; };
    header.appendChild(inp);
  }

  container.appendChild(header);
}
