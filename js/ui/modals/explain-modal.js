// ── Expression Explain modal ───────────────────────────────────────────────────
// Renders a parsed AND/OR/NOT/LEAF expression tree with ✓/✗ icons.
// Single Close button, no Apply.
//
// Usage:
//   explainModal.show(expr, fp, resource, env);
//   explainModal.hide();
import { Modal } from './modal-base.js';
import { parseExprTree, evaluateExprTree } from '../../fhir/explain.js';

class ExplainModal extends Modal {
  constructor() {
    super({ cancelLabel: 'Close', applyLabel: null });
    this.setTitle('Expression Explain');
  }

  show(expr, fp, resource, env) {
    this.body.innerHTML = '';

    try {
      const tree = parseExprTree(expr);
      evaluateExprTree(tree, fp, resource, env);
      this.body.appendChild(_renderNode(tree, 0));
    } catch (e) {
      const errDiv = document.createElement('div');
      errDiv.className   = 'explain-parse-error';
      errDiv.textContent = 'Could not parse expression: ' + e.message;
      this.body.appendChild(errDiv);
    }

    const strip = document.createElement('div');
    strip.className = 'explain-fhirpath';
    const label = document.createElement('span');
    label.className   = 'explain-fhirpath-label';
    label.textContent = 'FHIRPath:';
    const code = document.createElement('code');
    code.className   = 'explain-full-expr';
    code.textContent = expr;
    strip.append(label, code);
    this.body.appendChild(strip);

    super.open();
  }

  _cancel() { this.close(); }
}

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
    const lbl = document.createElement('span');
    lbl.className   = 'explain-op explain-op--' + node.type.toLowerCase();
    lbl.textContent = node.type;
    row.appendChild(lbl);
  }

  frag.appendChild(row);

  if (node.type === 'AND' || node.type === 'OR') {
    for (const child of node.children) frag.appendChild(_renderNode(child, depth + 1));
  } else if (node.type === 'NOT') {
    frag.appendChild(_renderNode(node.child, depth + 1));
  }

  return frag;
}

// Lazy: base-node.js imports this module in non-browser tests; defer DOM creation.
let _inst = null;
const _modal = () => (_inst ??= new ExplainModal());
export const show = (expr, fp, resource, env) => _modal().show(expr, fp, resource, env);
export const hide = () => _inst?.close();
