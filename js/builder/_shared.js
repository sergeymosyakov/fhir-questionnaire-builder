// ── Builder shared state and utilities ───────────────────────────────────────
import { buildQR } from '../fhir/qr-builder.js';
import { evalCalcNodes } from '../fhir/calc.js';

const fhirpath = window.fhirpath;

// Injected by index.js via init()
let _deps = null;
export function init(deps) { _deps = deps; }

// UI-only collapse state is owned by index.js and passed via ctx.collapsed.

// ── ID segment formatter ──────────────────────────────────────────────────────
function _toRoman(n) {
  const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
  const syms = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
  let r = ''; for (let i = 0; i < vals.length; i++) while (n >= vals[i]) { r += syms[i]; n -= vals[i]; } return r;
}
function _toLetter(n) {
  let r = ''; while (n > 0) { r = String.fromCharCode(64 + ((n-1)%26+1)) + r; n = Math.floor((n-1)/26); } return r;
}
export function formatSeg(n) {
  const fmt = document.getElementById('renumberFormat')?.value || 'numeric';
  return fmt === 'roman' ? _toRoman(n) : fmt === 'letters' ? _toLetter(n) : String(n);
}

export function triggerCalcRecalc() {
  const { tree, formTick, rawFhir, values } = _deps;
  if (rawFhir.value && fhirpath) {
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

// Confirmation dialog — matches clear-confirm style in app.js
export function confirmDelete(label) {
  return new Promise(resolve => {
    const backdrop = document.createElement('div');
    backdrop.className = 'clear-confirm-backdrop';
    const box = document.createElement('div');
    box.className = 'clear-confirm-box';
    box.innerHTML =
      '<div class="clear-confirm-title">Delete node?</div>' +
      '<div class="clear-confirm-msg">' +
        '<strong>' + label.replace(/</g, '&lt;') + '</strong> and all its children will be permanently removed.' +
      '</div>' +
      '<div class="clear-confirm-btns">' +
        '<button class="btn-fhir btn-danger" id="_cdDel" data-testid="delete-confirm-del-btn">Delete</button>' +
        '<button class="btn-fhir" id="_cdCancel" data-testid="delete-confirm-cancel-btn">Cancel</button>' +
      '</div>';
    backdrop.appendChild(box);
    document.body.appendChild(backdrop);
    const close = ok => { backdrop.remove(); resolve(ok); };
    box.querySelector('#_cdDel').onclick    = () => close(true);
    box.querySelector('#_cdCancel').onclick = () => close(false);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) close(false); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { document.removeEventListener('keydown', esc); close(false); }
    });
  });
}


