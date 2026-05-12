// ── Builder tree entry point ──────────────────────────────────────────────────
import { tree, makeGroup, makeItem, _formTick, rawFhir, calcTested, values } from '../state.js';
import { init as sharedInit, formatSeg } from './_shared.js';
import { init as dndInit, makeRootDropZone } from './dnd.js';
import { renderItem } from './node-item.js';
import { renderGroup } from './node-group.js';

// UI-only collapse state per node.id — not part of FHIR data, owned here
const collapsed = new Map();

// Inject reactive state into _shared (triggerCalcRecalc needs them)
sharedInit({ tree, formTick: _formTick, rawFhir, calcTested, values });

/**
 * @typedef {Object} BuilderCtx
 * @property {Function} renderTree   - Re-renders the entire tree into #treeContainer
 * @property {Function} renderNode   - Renders a single node (dispatches group/item)
 * @property {Array}    tree         - The reactive root tree array (from state.js)
 * @property {import('@vue/reactivity').Ref<number>} formTick - Reactive tick to trigger preview re-eval
 * @property {Map<string,boolean>}   collapsed    - UI-only collapse state keyed by node.id
 */

// renderNode is passed as ctx so node-item / node-group don't import each other
function renderNode(node) {
  const ctx = { renderTree, renderNode, tree, formTick: _formTick, collapsed };
  return node.type === 'group'
    ? renderGroup(node, ctx)
    : renderItem(node, ctx);
}

export function renderTree() {
  const container = document.getElementById('treeContainer');
  container.innerHTML = '';
  for (const node of tree) container.appendChild(renderNode(node));
  container.appendChild(makeRootDropZone());
}

// Wire DnD re-render callback once
dndInit(renderTree, tree, _formTick);

// ── Collapse / expand all ─────────────────────────────────────────────────────
function setCollapsedAll(nodes, value) {
  for (const n of nodes) {
    if (n.type === 'group') {
      collapsed.set(n.id, value);
      setCollapsedAll(n.children, value);
    }
  }
}
export function collapseAll() { setCollapsedAll(tree, true);  renderTree(); }
export function expandAll()   { setCollapsedAll(tree, false); renderTree(); }

// ── Renumber ──────────────────────────────────────────────────────────────────
function toRoman(n) {
  const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
  const syms = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
  let r = '';
  for (let i = 0; i < vals.length; i++) while (n >= vals[i]) { r += syms[i]; n -= vals[i]; }
  return r;
}
function toLetter(n) {
  let r = '';
  while (n > 0) { r = String.fromCharCode(64 + ((n - 1) % 26 + 1)) + r; n = Math.floor((n - 1) / 26); }
  return r;
}
function _walkNodes(nodes, fn) {
  for (const n of nodes) { fn(n); if (n.type === 'group') _walkNodes(n.children, fn); }
}
function _applyNumbers(format, nodes, prefix) {
  nodes.forEach((node, i) => {
    const idx = i + 1;
    const seg = format === 'roman' ? toRoman(idx) : format === 'letters' ? toLetter(idx) : String(idx);
    const newId = prefix ? prefix + '.' + seg : seg;
    node._oldId = node.id;
    node.id = newId;
    if (node.type === 'group' && node.children.length) _applyNumbers(format, node.children, newId);
  });
}
export async function renumberAll(format) {
  const idMap = new Map();
  _applyNumbers(format, tree, '');
  _walkNodes(tree, n => { if (n._oldId !== undefined) { idMap.set(n._oldId, n.id); delete n._oldId; } });
  _walkNodes(tree, n => {
    idMap.forEach((newId, oldId) => {
      if (newId) {
        if (n.visibilityRule)  n.visibilityRule  = n.visibilityRule.split(`'${oldId}'`).join(`'${newId}'`);
        if (n._calculatedExpr) n._calculatedExpr = n._calculatedExpr.split(`'${oldId}'`).join(`'${newId}'`);
      }
    });
  });
  // Incremental DOM render: yield between root nodes so the browser can paint progress
  const container = document.getElementById('treeContainer');
  container.innerHTML = '';
  const total = tree.length;
  const raf = () => new Promise(r => requestAnimationFrame(r));
  for (let i = 0; i < tree.length; i++) {
    container.appendChild(renderNode(tree[i]));
    document.dispatchEvent(new CustomEvent('renumber-progress', { detail: { done: i + 1, total } }));
    await raf();
  }
  container.appendChild(makeRootDropZone());
  document.dispatchEvent(new CustomEvent('renumber-done'));
}

// ── Root-level add buttons (wired in app.js via these exports) ────────────────
export function addRootGroup() {
  const node = makeGroup('New Group');
  node.id = formatSeg(tree.length + 1);
  tree.push(node);
  _formTick.value++;
  renderTree();
  requestAnimationFrame(() => {
    const el = document.querySelector('[data-node-id="' + node.id + '"]');
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('node-flash'); setTimeout(() => el.classList.remove('node-flash'), 1000); }
  });
}

export function addRootItem() {
  const node = makeItem('New Item');
  node.id = formatSeg(tree.length + 1);
  tree.push(node);
  _formTick.value++;
  renderTree();
  requestAnimationFrame(() => {
    const el = document.querySelector('[data-node-id="' + node.id + '"]');
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('node-flash'); setTimeout(() => el.classList.remove('node-flash'), 1000); }
  });
}
