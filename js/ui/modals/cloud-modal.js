// ── Cloud Questionnaires modal ────────────────────────────────────────────────
// Lists the signed-in user's cloud-saved questionnaires.
// open(onSelect) — onSelect(id) called when user clicks Load.

import { Modal } from './modal-base.js';
import * as storage from '../../storage/storage.js';
import { showError } from '../toast.js';

/** Format an ISO date string as a human-readable relative time label. */
function _relTime(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  <  2) return 'just now';
  if (mins  < 60) return `${mins} min ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days  <  7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return new Date(isoStr).toLocaleDateString();
}

class CloudModal extends Modal {
  getName() { return 'cloudModal'; }

  constructor() {
    super({ cancelLabel: 'Close', applyLabel: null, maxWidth: '520px' });
    this._onSelect = null;
    this.title.textContent = 'My Cloud Questionnaires';
  }

  /** @param {function(id: string): void} onSelect */
  open(onSelect) {
    this._onSelect = onSelect;
    this.body.innerHTML = '';
    this._renderLoading();
    super.open();
    this._load();
  }

  _cancel() {
    this._onSelect = null;
    this.close();
  }

  _renderLoading() {
    const el = document.createElement('div');
    el.className = 'cloud-list-empty';
    el.textContent = 'Loading\u2026';
    this.body.appendChild(el);
  }

  async _load() {
    try {
      const rows = await storage.cloudList();
      this.body.innerHTML = '';
      if (rows.length === 0) {
        const el = document.createElement('div');
        el.className = 'cloud-list-empty';
        el.textContent = 'No questionnaires saved to the cloud yet.';
        this.body.appendChild(el);
        return;
      }
      rows.forEach(row => this._renderRow(row));
    } catch (err) {
      this.body.innerHTML = '';
      const el = document.createElement('div');
      el.className = 'cloud-list-empty cloud-list-error';
      el.textContent = 'Could not load: ' + err.message;
      this.body.appendChild(el);
    }
  }

  _renderRow(row) {
    const item = document.createElement('div');
    item.className = 'cloud-list-item';
    item.dataset.testid = 'cloud-item-' + row.id;

    const info = document.createElement('div');
    info.className = 'cloud-list-info';

    const title = document.createElement('div');
    title.className = 'cloud-list-title';
    title.textContent = row.title;

    const meta = document.createElement('div');
    meta.className = 'cloud-list-meta';
    meta.textContent = 'Updated ' + _relTime(row.updated_at);
    if (row.url) {
      const urlSpan = document.createElement('span');
      urlSpan.className = 'cloud-list-url';
      urlSpan.textContent = row.url;
      meta.appendChild(urlSpan);
    }

    info.append(title, meta);

    const actions = document.createElement('div');
    actions.className = 'cloud-list-actions';

    const loadBtn = document.createElement('button');
    loadBtn.type = 'button';
    loadBtn.className = 'modal-btn modal-btn--apply cloud-list-load-btn';
    loadBtn.textContent = 'Load';
    loadBtn.dataset.testid = 'cloud-load-' + row.id;
    loadBtn.addEventListener('click', () => {
      const cb = this._onSelect;
      this._cancel();
      if (cb) cb(row.id);
    });

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'modal-btn cloud-list-del-btn';
    delBtn.textContent = '\u00D7';
    delBtn.dataset.tipTitle = 'Delete from cloud';
    delBtn.dataset.testid = 'cloud-delete-' + row.id;
    delBtn.addEventListener('click', async () => {
      if (!confirm(`Delete "${row.title}" from the cloud?`)) return;
      delBtn.disabled = true;
      try {
        await storage.cloudDelete(row.id);
        item.remove();
        if (!this.body.querySelector('.cloud-list-item')) {
          const empty = document.createElement('div');
          empty.className = 'cloud-list-empty';
          empty.textContent = 'No questionnaires saved to the cloud yet.';
          this.body.appendChild(empty);
        }
      } catch (err) {
        delBtn.disabled = false;
        showError('Delete failed: ' + err.message);
      }
    });

    actions.append(loadBtn, delBtn);
    item.append(info, actions);
    this.body.appendChild(item);
  }
}

const _modal = new CloudModal();

/** Open the cloud questionnaire picker.
 *  @param {function(id: string): void} onSelect */
export const open = onSelect => _modal.open(onSelect);
