// ── Drag & Drop for the builder tree ─────────────────────────────────────────
// Self-contained: all DnD state and logic lives here.
// Connects to the tree via callbacks passed in init().

let _dragId = null;
let _onDropCallback = null; // called after a successful drop to re-render
let _tree = null;
let _formTick = null;

// ── Tree lookup ───────────────────────────────────────────────────────────────
export function findNode(nodes, id, parent = null) {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) return { node: nodes[i], arr: nodes, idx: i, parent };
    if (nodes[i].type === 'group') {
      const r = findNode(nodes[i].children, id, nodes[i]);
      if (r) return r;
    }
  }
  return null;
}

function _isAncestor(ancestorId, nodeId) {
  const a = findNode(_tree, ancestorId);
  if (!a || a.node.type !== 'group') return false;
  return !!findNode(a.node.children, nodeId);
}

// ── Drop execution ────────────────────────────────────────────────────────────
function _doDrop(targetId, position) {
  if (!_dragId || _dragId === targetId) return;
  if ((position === 'inside' || position === 'inside-last') && _isAncestor(_dragId, targetId)) return;
  if (position === 'inside' || position === 'inside-last') {
    const t = findNode(_tree, targetId);
    if (!t || t.node.type !== 'group') return;
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
  _formTick.value++;
}

// ── Event handlers ────────────────────────────────────────────────────────────
function _onDragStart(e, node) {
  _dragId = node.id;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', node.id);
  setTimeout(() => {
    const el = document.querySelector('[data-node-id="' + node.id + '"]');
    if (el) el.classList.add('node-dragging');
  }, 0);
}

function _onDragEnd() {
  _dragId = null;
  document.querySelectorAll('.node-dragging').forEach(el => el.classList.remove('node-dragging'));
  document.querySelectorAll('.drop-indicator').forEach(el => el.remove());
  document.querySelectorAll('.node-drop-target').forEach(el => el.classList.remove('node-drop-target'));
}

// ── Public API ────────────────────────────────────────────────────────────────

// Register the re-render callback, tree reference and formTick
export function init(onDrop, tree, formTick) {
  _onDropCallback = onDrop;
  _tree = tree;
  _formTick = formTick;
}

// Returns a draggable ⠿ handle element wired to this node
export function makeDragHandle(node) {
  const h = document.createElement('span');
  h.className = 'node-drag-handle';
  h.title = 'Drag to reorder';
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
  rootDrop.style.cssText = 'height:32px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#bbb;border:1px dashed #ddd;border-radius:4px;margin-top:4px;opacity:0;transition:opacity .15s';
  rootDrop.textContent = 'Drop here to move to end';
  rootDrop.addEventListener('dragover', e => {
    if (!_dragId) return;
    e.preventDefault();
    rootDrop.style.opacity = '1';
    rootDrop.style.borderColor = 'var(--c-primary)';
    rootDrop.style.color = 'var(--c-primary)';
  });
  rootDrop.addEventListener('dragleave', () => {
    rootDrop.style.opacity = '0';
    rootDrop.style.borderColor = '#ddd';
    rootDrop.style.color = '#bbb';
  });
  rootDrop.addEventListener('drop', e => {
    e.preventDefault();
    rootDrop.style.opacity = '0';
    if (!_dragId) return;
    const src = findNode(_tree, _dragId);
    if (!src) return;
    src.arr.splice(src.idx, 1);
    _tree.push(src.node);
    if (_onDropCallback) _onDropCallback();
    _formTick.value++;
  });
  return rootDrop;
}
