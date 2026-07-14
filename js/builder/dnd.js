// ── Drag & Drop for the builder tree ─────────────────────────────────────────
// Self-contained: all DnD state and logic lives here.
// Connects to the tree via callbacks passed in init().
import { AppEvents } from '../events.js';

let _dragId = null;
let _onDropCallback = null; // called after a successful drop to re-render
let _tree = null;

// ── Tree lookup ───────────────────────────────────────────────────────────────
export function findNode(nodes, id, parent = null) {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) return { node: nodes[i], arr: nodes, idx: i, parent };
    if (nodes[i].children?.length) {
      const r = findNode(nodes[i].children, id, nodes[i]);
      if (r) return r;
    }
  }
  return null;
}

function _isAncestor(ancestorId, nodeId) {
  const a = findNode(_tree, ancestorId);
  if (!a || !a.node.children?.length) return false;
  return !!findNode(a.node.children, nodeId);
}

// ── Drop execution ────────────────────────────────────────────────────────────
function _doDrop(targetId, position) {
  if (!_dragId || _dragId === targetId) return;
  if ((position === 'inside' || position === 'inside-last') && _isAncestor(_dragId, targetId)) return;
  if (position === 'inside' || position === 'inside-last') {
    const t = findNode(_tree, targetId);
    if (!t || !(t.node.type === 'group' || t.node.children?.length > 0)) return;
  }

  const src = findNode(_tree, _dragId);
  if (!src) return;
  src.arr.splice(src.idx, 1);

  if (position === 'inside') {
    const dest = findNode(_tree, targetId);
    if (dest) dest.node.children.unshift(src.node);
  } else if (position === 'inside-last') {
    const dest = findNode(_tree, targetId);
    if (dest) dest.node.children.push(src.node);
  } else {
    const dest = findNode(_tree, targetId);
    if (!dest) { _tree.push(src.node); }
    else {
      const insertIdx = position === 'before' ? dest.idx : dest.idx + 1;
      dest.arr.splice(insertIdx, 0, src.node);
    }
  }

  if (_onDropCallback) _onDropCallback();
  document.dispatchEvent(new CustomEvent(AppEvents.REINIT_FORM));
}

// ── Event handlers ────────────────────────────────────────────────────────────
function _onDragStart(e, node) {
  _dragId = node.id;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', node.id);
  setTimeout(() => {
    const el = document.querySelector('[data-node-id="' + CSS.escape(node.id) + '"]');
    if (el) el.classList.add('node-dragging');
    document.body.classList.add('dragging');
  }, 0);
}

function _onDragEnd() {
  _dragId = null;
  document.body.classList.remove('dragging');
  document.querySelectorAll('.node-dragging').forEach(el => el.classList.remove('node-dragging'));
  document.querySelectorAll('.node-drop-target').forEach(el => el.classList.remove('node-drop-target'));
}

// ── Public API ────────────────────────────────────────────────────────────────

// Register the re-render callback and tree reference
export function init(onDrop, tree) {
  _onDropCallback = onDrop;
  _tree = tree;
}

// Returns a draggable ⠿ handle element wired to this node
export function makeDragHandle(node) {
  const h = document.createElement('span');
  h.className = 'node-drag-handle';
  h.dataset.tipTitle = 'Drag to reorder';
  h.textContent = '⠿';
  h.draggable = true;
  h.addEventListener('dragstart', e => _onDragStart(e, node));
  h.addEventListener('dragend', _onDragEnd);
  return h;
}

// Attaches dragover/dragleave/drop listeners to an existing drop-zone element
export function attachDropZone(div, node, position) {
  div.addEventListener('dragover', e => {
    if (!_dragId || _dragId === node.id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    div.classList.add('node-drop-target');
  });
  div.addEventListener('dragleave', e => {
    if (!div.contains(e.relatedTarget)) div.classList.remove('node-drop-target');
  });
  div.addEventListener('drop', e => {
    e.preventDefault();
    e.stopPropagation();
    div.classList.remove('node-drop-target');
    _doDrop(node.id, position);
  });
}

// Creates and returns the root-level drop zone (drop to end of tree)
export function makeRootDropZone() {
  const rootDrop = document.createElement('div');
  rootDrop.className = 'drop-zone drop-zone-root';
  rootDrop.textContent = 'Drop here to move to end';
  rootDrop.addEventListener('dragover', e => {
    if (!_dragId) return;
    e.preventDefault();
    rootDrop.classList.add('drop-zone-root--active');
  });
  rootDrop.addEventListener('dragleave', () => {
    rootDrop.classList.remove('drop-zone-root--active');
  });
  rootDrop.addEventListener('drop', e => {
    e.preventDefault();
    rootDrop.classList.remove('drop-zone-root--active');
    if (!_dragId) return;
    const src = findNode(_tree, _dragId);
    if (!src) return;
    src.arr.splice(src.idx, 1);
    _tree.push(src.node);
    if (_onDropCallback) _onDropCallback();
    document.dispatchEvent(new CustomEvent(AppEvents.REINIT_FORM));
  });
  return rootDrop;
}
