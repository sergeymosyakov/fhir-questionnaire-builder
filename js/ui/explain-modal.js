// ── Expression Explain popup ───────────────────────────────────────────────────
// Floating panel (centered, fixed) that renders a parsed AND/OR/NOT/LEAF
// expression tree with ✓/✗ icons.
//
// Usage:
//   explainModal.show(expr, fp, resource, env);
//   explainModal.hide();

import { parseExprTree, evaluateExprTree } from '../fhir/explain.js';

let _popup = null;

function _getPopup() {
  if (_popup) return _popup;
  _popup = document.createElement('div');
  _popup.className = 'explain-popup';
  _popup.setAttribute('role', 'dialog');
  _popup.style.display = 'none';
  document.body.appendChild(_popup);

  // Close on outside click
  document.addEventListener('mousedown', e => {
    if (_popup.style.display !== 'none' && !_popup.contains(e.target)) hide();
  });
  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') hide();
  });
  return _popup;
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

function _icon(result) {
  const span = document.createElement('span');
  span.className = 'explain-icon' +
    (result === true  ? ' explain-icon--true'  :
     result === false ? ' explain-icon--false' : ' explain-icon--err');
  span.textContent = result === true ? '✓' : result === false ? '✗' : '?';
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
    code.className = 'explain-expr';
    code.textContent = node.expr;
    row.appendChild(code);
    if (node.error) {
      const err = document.createElement('span');
      err.className = 'explain-error';
      err.textContent = node.error;
      row.appendChild(err);
    }
  } else {
    const label = document.createElement('span');
    label.className = 'explain-op explain-op--' + node.type.toLowerCase();
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
 * Parse `expr`, evaluate every node, and show the popup centered on screen.
 * `env` must be `{ resource: qr, ...envVars }` (same format as calc.js).
 */
export function show(expr, fp, resource, env) {
  const popup = _getPopup();
  popup.innerHTML = '';

  // ── Header ────────────────────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'explain-header';

  const title = document.createElement('span');
  title.className = 'explain-title';
  title.textContent = 'Expression explain';
  header.appendChild(title);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'explain-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '✕';
  closeBtn.onclick = hide;
  header.appendChild(closeBtn);

  popup.appendChild(header);

  // ── Body ──────────────────────────────────────────────────────────────────
  const body = document.createElement('div');
  body.className = 'explain-body';

  try {
    const tree = parseExprTree(expr);
    evaluateExprTree(tree, fp, resource, env);
    body.appendChild(_renderNode(tree, 0));
  } catch (e) {
    const errDiv = document.createElement('div');
    errDiv.className = 'explain-parse-error';
    errDiv.textContent = 'Could not parse expression: ' + e.message;
    body.appendChild(errDiv);
  }

  popup.appendChild(body);

  // ── Footer: full raw expression ───────────────────────────────────────────
  const footer = document.createElement('div');
  footer.className = 'explain-footer';

  const label = document.createElement('span');
  label.className = 'explain-footer-label';
  label.textContent = 'FHIRPath:';
  footer.appendChild(label);

  const code = document.createElement('code');
  code.className = 'explain-full-expr';
  code.textContent = expr;
  footer.appendChild(code);

  popup.appendChild(footer);

  popup.style.display = 'block';
}

export function hide() {
  if (_popup) _popup.style.display = 'none';
}
