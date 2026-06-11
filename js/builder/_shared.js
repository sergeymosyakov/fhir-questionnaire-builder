// ── Builder shared state and utilities ───────────────────────────────────────
import { AppEvents } from '../events.js';
import { buildQR } from '../fhir/qr-builder.js';
import { evalCalcNodes } from '../fhir/calc.js';

const fhirpath = typeof window !== 'undefined' ? window.fhirpath : null;

// Injected by index.js via init()
let _deps = null;
export function init(deps) { _deps = deps; }
export function setRenumberGetter(fn) { _renumberGetter = fn; }
let _renumberGetter = () => 'numbers';

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
  const fmt = _renumberGetter();
  return fmt === 'roman' ? _toRoman(n) : fmt === 'letters' ? _toLetter(n) : String(n);
}

export function triggerCalcRecalc() {
  const { tree, rawFhir, values } = _deps;
  if (rawFhir.value && fhirpath) {
    const base = JSON.parse(JSON.stringify(rawFhir.value));
    const qr = buildQR(base, values);
    evalCalcNodes(tree, qr, fhirpath, values, {}, base);
  }
  document.dispatchEvent(new CustomEvent(AppEvents.RESPONSE_CHANGED));
}

/** Re-render the builder tree (injected from builder/index.js to avoid circular imports). */
export function renderTree() {
  if (_deps?.renderTree) _deps.renderTree();
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
      '<div class="clear-confirm-msg"></div>' +
      '<div class="clear-confirm-btns">' +
        '<button class="btn-fhir btn-danger" id="_cdDel" data-testid="delete-confirm-del-btn">Delete</button>' +
        '<button class="btn-fhir" id="_cdCancel" data-testid="delete-confirm-cancel-btn">Cancel</button>' +
      '</div>';
    const msg = box.querySelector('.clear-confirm-msg');
    const strong = document.createElement('strong');
    strong.textContent = label;
    msg.appendChild(strong);
    msg.appendChild(document.createTextNode(' and all its children will be permanently removed.'));
    backdrop.appendChild(box);
    document.body.appendChild(backdrop);
    const esc = e => { if (e.key === 'Escape') close(false); };
    document.addEventListener('keydown', esc);
    const close = ok => { document.removeEventListener('keydown', esc); backdrop.remove(); resolve(ok); };
    box.querySelector('#_cdDel').onclick    = () => close(true);
    box.querySelector('#_cdCancel').onclick = () => close(false);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) close(false); });
  });
}


