// ── Expression Explain modal ───────────────────────────────────────────────────
// Centered modal (shared modal system) that renders a parsed AND/OR/NOT/LEAF
// expression tree with ✓/✗ icons. Single Close button; no Apply.
//
// Usage:
//   explainModal.show(expr, fp, resource, env);
//   explainModal.hide();

import { parseExprTree, evaluateExprTree } from '../fhir/explain.js';

let _backdrop = null;
let _body     = null;

function _getModal() {
  if (_backdrop) return;

  _backdrop = document.createElement('div');
  _backdrop.className = 'modal-backdrop';
  _backdrop.id        = 'explainModal';
  _backdrop.style.display = 'none';

  const box = document.createElement('div');
  box.className = 'modal-box';

  // Header
  const header = document.createElement('div');
  header.className = 'modal-header';

  const title = document.createElement('span');
  title.className   = 'modal-title-label';
  title.textContent = 'Expression Explain';
  header.appendChild(title);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '\u2715';
  closeBtn.onclick = hide;
  header.appendChild(closeBtn);

  box.appendChild(header);

  // Body (repopulated on each show())
  _body = document.createElement('div');
  _body.className = 'modal-body';
  box.appendChild(_body);

  // Footer — single Cancel button
  const footer = document.createElement('div');
  footer.className = 'modal-footer';

  const cancelBtn = document.createElement('button');
  cancelBtn.className   = 'modal-btn modal-btn--cancel';
  cancelBtn.textContent = 'Close';
  cancelBtn.onclick     = hide;
  footer.appendChild(cancelBtn);

  box.appendChild(footer);
  _backdrop.appendChild(box);
  document.body.appendChild(_backdrop);

  // Close on backdrop click
  _backdrop.addEventListener('mousedown', e => {
    if (e.target === _backdrop) hide();
  });
  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && _backdrop.style.display !== 'none') hide();
  });
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

function _icon(result) {
  const span = document.createElement('span');
  span.className = 'explain-icon' +
    (result === true  ? ' explain-icon--true'  :
     result === false ? ' explain-icon--false' : ' explain-icon--err');
  span.textContent = result === true ? '\u2713' : result === false ? '\u2717' : '?';
  return span;
}

function _renderNode(node, depth) {
  const frag = document.createDocumentFragment();

  const row = document.createElement('div');
  row.className = 'explain-row';
  row.style.setProperty('--explain-depth', depth);

  row.appendChild(_icon(node.result));

  if (node.type === 'LEAF') {
    const code = document.createElement('code');
    code.className   = 'explain-expr';
    code.textContent = node.expr;
    row.appendChild(code);
    if (node.error) {
      const err = document.createElement('span');
      err.className   = 'explain-error';
      err.textContent = node.error;
      row.appendChild(err);
    }
  } else {
    const label = document.createElement('span');
    label.className   = 'explain-op explain-op--' + node.type.toLowerCase();
    label.textContent = node.type;
    row.appendChild(label);
  }

  frag.appendChild(row);

  if (node.type === 'AND' || node.type === 'OR') {
    for (const child of node.children) {
      frag.appendChild(_renderNode(child, depth + 1));
    }
  } else if (node.type === 'NOT') {
    frag.appendChild(_renderNode(node.child, depth + 1));
  }

  return frag;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse `expr`, evaluate every node, and show the modal centered on screen.
 * `env` must be `{ resource: qr, ...envVars }` (same format as calc.js).
 */
export function show(expr, fp, resource, env) {
  _getModal();
  _body.innerHTML = '';

  // Tree
  try {
    const tree = parseExprTree(expr);
    evaluateExprTree(tree, fp, resource, env);
    _body.appendChild(_renderNode(tree, 0));
  } catch (e) {
    const errDiv = document.createElement('div');
    errDiv.className   = 'explain-parse-error';
    errDiv.textContent = 'Could not parse expression: ' + e.message;
    _body.appendChild(errDiv);
  }

  // FHIRPath raw expression strip at the bottom of the body
  const strip = document.createElement('div');
  strip.className = 'explain-fhirpath';

  const label = document.createElement('span');
  label.className   = 'explain-fhirpath-label';
  label.textContent = 'FHIRPath:';
  strip.appendChild(label);

  const code = document.createElement('code');
  code.className   = 'explain-full-expr';
  code.textContent = expr;
  strip.appendChild(code);

  _body.appendChild(strip);

  _backdrop.style.display = 'flex';
}

export function hide() {
  if (_backdrop) _backdrop.style.display = 'none';
}

