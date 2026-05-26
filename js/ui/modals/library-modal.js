// ── Library modal ─────────────────────────────────────────────────────────────
// Browse and load sample Questionnaires and QuestionnaireResponses.
//
// open(focusGroupId, onSelect, typeFilter) — render tree, expand the given group, show modal
// onSelect(item) called with { label, file, type } when user clicks an entry.
import { Modal } from './modal-base.js';

const LIBRARY_URL = 'sampledata/library.json';

const TYPE_ICONS = {
  'questionnaire': '\u2605',  // ★
  'qr':            '\u1F4CB', // 📋
};

class LibraryModal extends Modal {
  constructor() {
    super({ cancelLabel: 'Close', applyLabel: null });
    this._cache    = null;
    this._onSelect = null;
    this.title.textContent = 'Load from Library';
  }

  open(focusGroupId, onSelect, typeFilter) {
    this._onSelect = onSelect;
    this.body.innerHTML = '';

    const render = data => {
      const groups = typeFilter
        ? data.filter(g => g.items.some(i => i.type === typeFilter))
        : data;
      this._render(groups, focusGroupId);
    };

    if (this._cache) {
      render(this._cache);
      super.open();
    } else {
      this.body.textContent = 'Loading\u2026';
      super.open();
      fetch(LIBRARY_URL)
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(data => {
          this._cache = data;
          this.body.innerHTML = '';
          render(data);
        })
        .catch(err => {
          this.body.textContent = 'Could not load library: ' + err.message;
        });
    }
  }

  _cancel() {
    this._onSelect = null;
    this.close();
  }

  _render(groups, focusGroupId) {
    groups.forEach(group => {
      const isOpen = group.id === focusGroupId;

      const groupEl = document.createElement('div');
      groupEl.className = 'lib-group';
      groupEl.dataset.testid = 'lib-group-' + group.id;

      const hdr = document.createElement('div');
      hdr.className = 'lib-group-hdr';
      hdr.dataset.testid = 'lib-group-hdr-' + group.id;

      const arrow = document.createElement('span');
      arrow.className = 'lib-group-toggle';
      arrow.textContent = isOpen ? '\u25BC' : '\u25BA';

      const lbl = document.createElement('span');
      lbl.textContent = group.label;
      hdr.append(arrow, lbl);

      const body = document.createElement('div');
      body.className = 'lib-group-body';
      body.style.display = isOpen ? '' : 'none';

      group.items.forEach((item, idx) => {
        const row = document.createElement('div');
        row.className = 'lib-item';
        row.dataset.testid = 'lib-item-' + group.id + '-' + idx;
        row.dataset.file   = item.file;
        row.dataset.sample = item.file;
        row.dataset.type   = item.type;

        const icon = document.createElement('span');
        icon.className = 'lib-item-icon';
        icon.textContent = TYPE_ICONS[item.type] || '\u2605';
        icon.setAttribute('aria-hidden', 'true');

        const labelEl = document.createElement('span');
        labelEl.textContent = item.label;
        row.append(icon, labelEl);

        if (item.note) {
          const note = document.createElement('span');
          note.className = 'lib-item-note';
          note.textContent = item.note;
          row.appendChild(note);
        }

        row.addEventListener('click', () => {
          const cb = this._onSelect;
          this._cancel();
          if (cb) cb(item);
        });

        body.appendChild(row);
      });

      hdr.addEventListener('click', () => {
        const nowOpen = body.style.display !== 'none';
        body.style.display = nowOpen ? 'none' : '';
        arrow.textContent = nowOpen ? '\u25BA' : '\u25BC';
      });

      groupEl.append(hdr, body);
      this.body.appendChild(groupEl);
    });
  }
}

const _modal = new LibraryModal();
export const open = (focusGroupId, onSelect, typeFilter) => _modal.open(focusGroupId, onSelect, typeFilter);
