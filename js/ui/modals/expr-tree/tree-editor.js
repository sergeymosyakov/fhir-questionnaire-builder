// ── Expression tree editor ────────────────────────────────────────────────────
// Renders any boolean FHIRPath as a nested AND/OR/NOT/LEAF tree (reusing
// explain.js) with per-node live results. Leaves reuse the leaf editor; the
// whole structure is always visible — no whole-expression raw fallback.
import { parseExprTree, emitExprTree, evaluateExprTree } from '../../../fhir/explain.js';
import { expandAggregateOverSet } from '../../../fhir/expr-builder/parse.js';
import { _rc } from '../../../preview/render-ctx.js';
import { createCustomSelect } from '../../custom-select.js';
import { createLeafEditor } from './leaf-editor.js';

// Editor keeps a group at the root so the top-level AND/OR is always editable.
function normalizeRoot(node) {
  return node.type === 'AND' || node.type === 'OR' ? node : { type: 'AND', children: [node] };
}

// Expand boolean-aggregate-over-a-set leaves (allTrue/anyTrue/…) into groups,
// using the real CST parser so nothing stays an opaque text blob.
function expandTree(node, fp) {
  if (node.type === 'LEAF') {
    const ex = fp ? expandAggregateOverSet(node.expr, fp) : null;
    if (ex) return { type: ex.op === 'and' ? 'AND' : 'OR', children: ex.leaves.map((e) => ({ type: 'LEAF', expr: e })) };
    return node;
  }
  if (node.children) node.children = node.children.map((c) => expandTree(c, fp));
  if (node.child) node.child = expandTree(node.child, fp);
  return node;
}

export function createExprTreeEditor({ initialExpr, items, fp, onChange } = {}) {
  const el = document.createElement('div');
  el.className = 'eb-tree';
  el.dataset.testid = 'eb-tree';

  let root = normalizeRoot(parseExprTree((initialExpr || '').trim() || ''));
  root = normalizeRoot(expandTree(root, fp));

  const getExpr = () => emitExprTree(root);

  const notify = () => onChange && onChange();

  let leafEditors = [];
  let applyAllBtn = null;

  const updateApplyAll = () => {
    if (applyAllBtn) applyAllBtn.style.display = leafEditors.some((e) => e.isDirty()) ? '' : 'none';
    notify();
  };

  // Recompute per-node results from the live QR without re-rendering.
  function refreshResults() {
    const ctx = _rc.ctx;
    if (ctx && ctx.fp && ctx.qr) {
      evaluateExprTree(root, ctx.fp, ctx.qr, { resource: ctx.qr, ...(ctx.envVars || {}) });
    }
    walk(root, (n) => { if (n._chip) setChip(n._chip, ctx ? n.result : undefined); });
    notify();
  }

  function rebuild() {
    el.innerHTML = '';
    leafEditors = [];
    applyAllBtn = document.createElement('button');
    applyAllBtn.type = 'button';
    applyAllBtn.className = 'eb-apply-all';
    applyAllBtn.textContent = 'Apply changes';
    applyAllBtn.dataset.testid = 'eb-apply-all';
    applyAllBtn.style.display = 'none';
    applyAllBtn.addEventListener('click', () => {
      // Re-parse the whole (edited) expression at once.
      root = normalizeRoot(expandTree(parseExprTree((getExpr() || '').trim() || ''), fp));
      rebuild();
    });
    el.appendChild(applyAllBtn);
    el.appendChild(renderNode(root, null));
    refreshResults();
    updateApplyAll();
  }

  // A leaf/value edit only changes results; structural edits rebuild the DOM.
  const onLeafChange = () => refreshResults();

  function renderNode(node, parentChildren) {
    if (node.type === 'LEAF') return renderLeaf(node, parentChildren);
    if (node.type === 'NOT') return renderNot(node, parentChildren);
    return renderGroup(node, parentChildren);
  }

  function renderGroup(node, parentChildren) {
    const box = document.createElement('div');
    box.className = 'eb-node eb-group';
    box.dataset.testid = 'eb-group';

    const head = document.createElement('div');
    head.className = 'eb-group-head';

    const behavior = createCustomSelect({
      items: [{ value: 'AND', label: 'ALL (AND)' }, { value: 'OR', label: 'ANY (OR)' }],
      value: node.type,
      className: 'sc-trigger--sm',
      testid: 'eb-group-type',
      onChange: (v) => { node.type = v; refreshResults(); },
    });
    behavior.el.style.display = node.children.length > 1 ? '' : 'none';

    node._chip = mkChip();

    head.append(behavior.el, node._chip,
      mkLink('+ condition', 'eb-add-condition', () => { node.children.push({ type: 'LEAF', expr: '' }); rebuild(); }),
      mkLink('+ group', 'eb-add-group', () => { node.children.push({ type: 'OR', children: [{ type: 'LEAF', expr: '' }] }); rebuild(); }));
    if (parentChildren) head.appendChild(mkRemove(node, parentChildren));
    box.appendChild(head);

    const kids = document.createElement('div');
    kids.className = 'eb-children';
    node.children.forEach((c) => kids.appendChild(renderNode(c, node.children)));
    box.appendChild(kids);
    return box;
  }

  function renderNot(node, parentChildren) {
    const box = document.createElement('div');
    box.className = 'eb-node eb-not';
    const head = document.createElement('div');
    head.className = 'eb-group-head';
    const lbl = document.createElement('span');
    lbl.className = 'eb-not-lbl';
    lbl.textContent = 'NOT';
    node._chip = mkChip();
    head.append(lbl, node._chip);
    if (parentChildren) head.appendChild(mkRemove(node, parentChildren));
    box.appendChild(head);
    const kids = document.createElement('div');
    kids.className = 'eb-children';
    kids.appendChild(renderNode(node.child, null));
    box.appendChild(kids);
    return box;
  }

  function renderLeaf(node, parentChildren) {
    const box = document.createElement('div');
    box.className = 'eb-node eb-leaf-row';
    const editor = createLeafEditor({
      expr: node.expr,
      items,
      fp,
      onChange: () => { node.expr = editor.getExpr(); onLeafChange(); },
      onApply: () => reparseLeaf(node, parentChildren),
      onDirtyChange: updateApplyAll,
    });
    leafEditors.push(editor);
    node.expr = editor.getExpr();
    node._chip = mkChip();
    box.append(editor.el, node._chip);
    if (parentChildren && parentChildren.length > 1) box.appendChild(mkRemove(node, parentChildren));
    return box;
  }

  // Re-parse an edited leaf so new and/or/sets restructure the tree in place.
  function reparseLeaf(node, parentChildren) {
    const parsed = expandTree(parseExprTree((node.expr || '').trim() || ''), fp);
    if (!parentChildren) { root = normalizeRoot(parsed); rebuild(); return; }
    const i = parentChildren.indexOf(node);
    if (i < 0) return;
    parentChildren.splice(i, 1, parsed);
    rebuild();
  }

  function mkRemove(node, parentChildren) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'eb-rm';
    b.dataset.testid = 'eb-remove-node';
    b.textContent = '\u2715';
    b.addEventListener('click', () => {
      const i = parentChildren.indexOf(node);
      if (i >= 0) parentChildren.splice(i, 1);
      rebuild();
    });
    return b;
  }

  function mkLink(label, testid, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'eb-add';
    b.dataset.testid = testid;
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  rebuild();
  return { el, getExpr, refresh: refreshResults };
}

function walk(node, fn) {
  fn(node);
  if (node.children) node.children.forEach((c) => walk(c, fn));
  if (node.child) walk(node.child, fn);
}

function mkChip() {
  const s = document.createElement('span');
  s.className = 'eb-chip';
  s.dataset.testid = 'eb-node-chip';
  return s;
}

function setChip(chip, result) {
  chip.className = 'eb-chip';
  if (result === undefined) { chip.textContent = ''; return; }
  if (result === null) { chip.classList.add('eb-chip--err'); chip.textContent = 'error'; return; }
  chip.classList.add(result ? 'eb-chip--ok' : 'eb-chip--off');
  chip.textContent = result ? '\u2713 true' : '\u2717 false';
}
