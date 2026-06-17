import { Modal } from './modal-base.js';
// ── Node Picker modal ─────────────────────────────────────────────────────────
// Reusable modal that shows the questionnaire tree with checkboxes.
// Search filters by title or linkId; matching leaves + all ancestors are kept.
//
// Usage:
//   nodePickerModal.open(excludeId, onConfirm, EventState.get(AppEvents.APP_CONTEXT_READY)?.questDoc?.tree ?? [])
//   onConfirm receives string[] of selected node ids.

/** Recursively keep matching leaves + their ancestors.
 *  @param {object[]} nodes       — flat or nested tree array
 *  @param {string}   query       — lower-cased search string
 *  @param {string}   exclude     — node id to exclude (currently being edited)
 *  @param {string|null} allowedType — 'group'|'item'|null; nodes of other type are non-selectable
 *  @returns {{ node, children: []|null, selectable: boolean }[]}
 */
function _filterTree(nodes, query, exclude, allowedType) {
  const out = [];
  for (const node of nodes) {
    if (node.id === exclude) continue;
    const selectable = !allowedType || node.type === allowedType;
    if (node.type === 'group') {
      const filteredChildren = _filterTree(node.children || [], query, exclude, allowedType);
      const selfMatch = !query || node.title?.toLowerCase().includes(query) || node.id?.toLowerCase().includes(query);
      // Include group if it matches (or has matching descendants)
      if (selfMatch || filteredChildren.length > 0) {
        out.push({ node, children: filteredChildren, selectable });
      }
    } else {
      const match = !query || node.title?.toLowerCase().includes(query) || node.id?.toLowerCase().includes(query);
      if (match) out.push({ node, children: null, selectable });
    }
  }
  return out;
}

class NodePickerModal extends Modal {
  getName() { return 'nodePickerModal'; }

  constructor() {
    super({ applyLabel: null, cancelLabel: 'Cancel' });
    this._excludeId   = null;
    this._onConfirm   = null;
    this._selected    = new Set();
    this._treeEl      = null;
    this._allowedType = null; // 'group' | 'item' | null (both)

    // Dynamic confirm button — label updates as selection changes.
    this._confirmBtn = document.createElement('button');
    this._confirmBtn.type = 'button';
    this._confirmBtn.className = 'modal-btn modal-btn--apply';
    this._confirmBtn.dataset.testid = 'node-picker-confirm';
    this._confirmBtn.textContent = 'Copy to selected (0)';
    this._confirmBtn.disabled = true;
    this._confirmBtn.addEventListener('click', () => this._confirm());
    this.footer.appendChild(this._confirmBtn);
  }

  /**
   * @param {string}   excludeId   — id of the node being edited (excluded from list)
   * @param {Function} onConfirm   — called with string[] of selected ids
   * @param {string}   [allowedType] — 'group' | 'item' | null (show all)
   */
  open(excludeId, onConfirm, allowedType = null, tree = []) {
    this._tree = tree;
    this._excludeId   = excludeId;
    this._onConfirm   = onConfirm;
    this._allowedType = allowedType;
    this._selected.clear();
    this._updateConfirmBtn();
    this.setTitle('Copy to\u2026');
    this._renderBody();
    super.open();
  }

  _renderBody() {
    this.body.innerHTML = '';

    const searchWrap = document.createElement('div');
    searchWrap.className = 'node-picker-search-wrap';

    const searchInp = document.createElement('input');
    searchInp.type = 'text';
    searchInp.className = 'node-picker-search';
    searchInp.placeholder = 'Filter by title or link ID\u2026';
    searchInp.dataset.testid = 'node-picker-search';
    searchInp.oninput = () => this._renderTree(searchInp.value.trim().toLowerCase());
    searchWrap.appendChild(searchInp);
    this.body.appendChild(searchWrap);

    this._treeEl = document.createElement('div');
    this._treeEl.className = 'node-picker-tree';
    this.body.appendChild(this._treeEl);

    this._renderTree('');
    requestAnimationFrame(() => searchInp.focus());
  }

  _renderTree(query) {
    const filtered = _filterTree(this._tree || [], query, this._excludeId, this._allowedType);
    this._treeEl.innerHTML = '';

    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'node-picker-empty';
      empty.textContent = query ? 'No matching nodes.' : 'No nodes available.';
      this._treeEl.appendChild(empty);
      return;
    }

    this._buildRows(filtered, this._treeEl, 0);
  }

  _buildRows(items, container, depth) {
    for (const { node, children, selectable } of items) {
      const isGroup = node.type === 'group';

      if (!selectable) {
        // Non-selectable: render as a plain header row (no checkbox)
        const row = document.createElement('div');
        row.dataset.testid = `node-picker-hdr-${node.id}`;
        row.className = isGroup
          ? 'node-picker-item node-picker-item--group node-picker-item--header'
          : 'node-picker-item node-picker-item--header';
        row.style.paddingLeft = `${depth * 16 + 8}px`;

        const title = document.createElement('span');
        title.className = 'node-picker-item-title';
        if (isGroup) {
          const icon = document.createElement('span');
          icon.className = 'node-picker-group-icon';
          icon.textContent = '\u25b8 ';
          title.appendChild(icon);
        }
        title.appendChild(document.createTextNode(node.title || node.id));

        const linkId = document.createElement('span');
        linkId.className = 'node-picker-linkid';
        linkId.textContent = node.id;

        row.append(title, linkId);
        container.appendChild(row);
      } else {
        // Selectable: render with checkbox
        const row = document.createElement('label');
        row.className = isGroup
          ? 'node-picker-item node-picker-item--group'
          : 'node-picker-item';
        row.style.paddingLeft = `${depth * 16 + 8}px`;

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'node-picker-cb';
        cb.dataset.testid = `node-picker-cb-${node.id}`;
        cb.checked = this._selected.has(node.id);
        cb.addEventListener('change', () => {
          if (cb.checked) this._selected.add(node.id);
          else this._selected.delete(node.id);
          this._updateConfirmBtn();
        });

        const title = document.createElement('span');
        title.className = 'node-picker-item-title';
        if (isGroup) {
          const icon = document.createElement('span');
          icon.className = 'node-picker-group-icon';
          icon.textContent = '\u25b8 ';
          title.appendChild(icon);
        }
        title.appendChild(document.createTextNode(node.title || node.id));

        const linkId = document.createElement('span');
        linkId.className = 'node-picker-linkid';
        linkId.textContent = node.id;

        row.append(cb, title, linkId);
        container.appendChild(row);
      }

      if (isGroup && children?.length) this._buildRows(children, container, depth + 1);
    }
  }

  _updateConfirmBtn() {
    const n = this._selected.size;
    this._confirmBtn.textContent = `Copy to selected (${n})`;
    this._confirmBtn.disabled = n === 0;
  }

  _confirm() {
    const ids = [...this._selected];
    const cb = this._onConfirm;
    this._cancel();
    cb?.(ids);
  }

  _cancel() {
    this._onConfirm  = null;
    this._excludeId  = null;
    this._allowedType = null;
    this._selected.clear();
    this._updateConfirmBtn();
    this.close();
  }
}

export const nodePickerModal = typeof document !== 'undefined' ? new NodePickerModal() : null;
