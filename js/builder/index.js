// ── Builder tree entry point ──────────────────────────────────────────────────
import { tree, makeGroup, makeItem, _formTick, rawFhir, calcTested, values, _bulkUpdate } from '../state.js';
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

export async function renderTreeAsync(onProgress) {
  const raf = () => new Promise(r => requestAnimationFrame(r));
  await raf(); // yield so caller's progress UI can paint
  // Build off-screen in a fragment — RAF yields keep progress bar updating
  // without causing layout reflows in the live left panel.
  const frag = document.createDocumentFragment();
  const total = tree.length;
  for (let i = 0; i < tree.length; i++) {
    frag.appendChild(renderNode(tree[i]));
    if (onProgress) onProgress(i + 1, total);
    await raf();
  }
  frag.appendChild(makeRootDropZone());
  const container = document.getElementById('treeContainer');
  container.innerHTML = '';
  container.appendChild(frag);
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
  const raf = () => new Promise(r => requestAnimationFrame(r));
  // Yield first so progress.show() has a chance to paint before any sync work
  await raf();

  // Pause Vue tracking so bulk node.id mutations don't trigger preview re-renders
  // Suppress preview effect() during bulk mutations — set flag before, clear after.
  // When flag is set: effect reads _bulkUpdate and returns early (stops tracking tree).
  // When flag is cleared: effect re-runs once and rebuilds the preview fully.
  _bulkUpdate.value = true;
  try {
    const idMap = new Map();
    _applyNumbers(format, tree, '');
    _walkNodes(tree, n => { if (n._oldId !== undefined) { idMap.set(n._oldId, n.id); delete n._oldId; } });

    // Build a single regex for all old IDs → O(n) replacement instead of O(n²)
    const allOldIds = [...idMap.keys()];
    if (allOldIds.length > 0) {
      const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp("'(" + allOldIds.map(esc).join('|') + ")'", 'g');
      const repl = s => s.replace(re, (_, id) => "'" + (idMap.get(id) ?? id) + "'");
      _walkNodes(tree, n => {
        if (n.visibilityRule)  n.visibilityRule  = repl(n.visibilityRule);
        if (n._calculatedExpr) n._calculatedExpr = repl(n._calculatedExpr);
      });
    }
  } finally {
    _bulkUpdate.value = false;
  }

  // Build into a DocumentFragment off-screen so RAF yields update the progress bar
  // without touching the live DOM — no layout thrash or visual jitter in the left panel.
  // Swap into the container in one operation at the end.
  const raf = () => new Promise(r => requestAnimationFrame(r));
  const frag = document.createDocumentFragment();
  const total = tree.length;
  for (let i = 0; i < tree.length; i++) {
    frag.appendChild(renderNode(tree[i]));
    document.dispatchEvent(new CustomEvent('renumber-progress', { detail: { done: i + 1, total } }));
    await raf();
  }
  frag.appendChild(makeRootDropZone());
  const container = document.getElementById('treeContainer');
  container.innerHTML = '';
  container.appendChild(frag);
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
