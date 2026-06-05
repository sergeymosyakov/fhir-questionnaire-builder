// ── Node Picker modal ─────────────────────────────────────────────────────────
// Reusable modal that shows the questionnaire tree with checkboxes.
// Search filters by title or linkId; matching leaves + all ancestors are kept.
//
// Usage:
//   nodePickerModal.open(excludeId, onConfirm)
//   onConfirm receives string[] of selected node ids.
import { Modal } from './modal-base.js';

/** Recursively keep matching leaves + their ancestors.
 *  @param {object[]} nodes   — flat or nested tree array
 *  @param {string}   query   — lower-cased search string
 *  @param {string}   exclude — node id to exclude (currently being edited)
 *  @returns {{ node, children: []|null }[]}
 */
function _filterTree(nodes, query, exclude) {
  const out = [];
  for (const node of nodes) {
    if (node.id === exclude) continue;
    if (node.type === 'group') {
      const filteredChildren = _filterTree(node.children || [], query, exclude);
      const selfMatch = !query || node.title?.toLowerCase().includes(query) || node.id?.toLowerCase().includes(query);
      if (selfMatch || filteredChildren.length > 0) {
        out.push({ node, children: filteredChildren });
      }
    } else {
      const match = !query || node.title?.toLowerCase().includes(query) || node.id?.toLowerCase().includes(query);
      if (match) out.push({ node, children: null });
    }
  }
  return out;
}

class NodePickerModal extends Modal {
  getName() { return 'nodePickerModal'; }

  constructor() {
    super({ applyLabel: null, cancelLabel: 'Cancel' });
    this._excludeId  = null;
    this._onConfirm  = null;
    this._selected   = new Set();
    this._treeEl     = null;

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
   * @param {string}   excludeId — id of the node being edited (excluded from list)
   * @param {Function} onConfirm — called with string[] of selected ids
   */
  open(excludeId, onConfirm) {
    this._excludeId = excludeId;
    this._onConfirm = onConfirm;
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
    const filtered = _filterTree(Modal._svc.tree || [], query, this._excludeId);
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
    for (const { node, children } of items) {
      if (node.type === 'group') {
        const row = document.createElement('div');
        row.className = 'node-picker-group';
        row.style.paddingLeft = `${depth * 16 + 8}px`;

        const icon = document.createElement('span');
        icon.className = 'node-picker-group-icon';
        icon.textContent = '\u25b8';

        const label = document.createElement('span');
        label.className = 'node-picker-group-label';
        label.textContent = node.title || node.id;

        const linkId = document.createElement('span');
        linkId.className = 'node-picker-linkid';
        linkId.textContent = node.id;

        row.append(icon, label, linkId);
        container.appendChild(row);

        if (children?.length) this._buildRows(children, container, depth + 1);
      } else {
        const row = document.createElement('label');
        row.className = 'node-picker-item';
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
        title.textContent = node.title || node.id;

        const linkId = document.createElement('span');
        linkId.className = 'node-picker-linkid';
        linkId.textContent = node.id;

        row.append(cb, title, linkId);
        container.appendChild(row);
      }
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
    this._onConfirm = null;
    this._excludeId = null;
    this._selected.clear();
    this._updateConfirmBtn();
    this.close();
  }
}

export const nodePickerModal = typeof document !== 'undefined' ? new NodePickerModal() : null;
