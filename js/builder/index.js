// ── Builder tree entry point ──────────────────────────────────────────────────
import { tree, rawFhir, values } from '../state.js';
import { _formTick, _bulkUpdate } from '../render-bus.js';
import { init as sharedInit, formatSeg, confirmDelete, triggerCalcRecalc } from './_shared.js';
import { init as dndInit, makeRootDropZone } from './dnd.js';
import { navigateToPreview } from '../render-preview.js';
import { findAndRemove } from '../utils.js';
import { GroupNode } from '../nodes/group-node.js';
import { BaseNode } from '../nodes/base-node.js';

// Inject reactive state into _shared (triggerCalcRecalc + renderTree need them)
sharedInit({ tree, formTick: _formTick, rawFhir, values, renderTree });

// ── Inject builder services into node layer ───────────────────────────────────
// Nodes must not import state or services directly — they receive them here.
BaseNode.configure({
  tree,
  findAndRemove,
  confirmDelete,
  triggerCalcRecalc,
  tickForm:   () => _formTick.value++,
  formatSeg,
});

// ── Event listeners ───────────────────────────────────────────────────────────
// Nodes dispatch custom events instead of importing index.js/render-preview.js
// (those modules import nodes — importing back would be circular).
document.addEventListener('builder:rerender',  ()  => renderTree());
document.addEventListener('builder:navigate',  e   => navigateToPreview(e.detail.id));

function renderNode(node) {
  return node.buildBuilder();
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
      GroupNode._collapseMap.set(n.id, value);
      setCollapsedAll(n.children, value);
    }
  }
}
export function collapseAll() { setCollapsedAll(tree, true);  renderTree(); }
export function expandAll()   { setCollapsedAll(tree, false); renderTree(); }

// ── Renumber ──────────────────────────────────────────────────────────────────
// Renumber writes only node._prefix — node.id (FHIR linkId) is never touched,
// so all enableWhen / calculatedExpression references stay valid.
function _applyPrefixes(nodes, parentPrefix) {
  nodes.forEach((node, i) => {
    const seg = formatSeg(i + 1);
    const prefix = parentPrefix ? parentPrefix + '.' + seg : seg;
    node._prefix = prefix;
    if (node.type === 'group' && node.children.length) _applyPrefixes(node.children, prefix);
  });
}
export async function renumberAll() {
  const raf = () => new Promise(r => requestAnimationFrame(r));
  // Yield first so progress.show() has a chance to paint before any sync work
  await raf();

  _bulkUpdate.value = true;
  try {
    _applyPrefixes(tree, '');
  } finally {
    _bulkUpdate.value = false;
  }

  // Build into a DocumentFragment off-screen so RAF yields update the progress bar
  // without touching the live DOM — no layout thrash or visual jitter in the left panel.
  // Swap into the container in one operation at the end.
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
  const node = createGroupNode({ title: 'New Group' });
  node.id = formatSeg(tree.length + 1);
  tree.push(node);
  _formTick.value++;
  renderTree();
  requestAnimationFrame(() => {
    const el = document.querySelector('[data-node-id="' + CSS.escape(node.id) + '"]');
    if (el) {
      const panel = document.querySelector('.left-panel-body');
      if (panel) {
        const top = el.getBoundingClientRect().top - panel.getBoundingClientRect().top + panel.scrollTop;
        panel.scrollTo({ top, behavior: 'smooth' });
      } else {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      el.classList.add('node-flash'); setTimeout(() => el.classList.remove('node-flash'), 1000);
    }
  });
}

