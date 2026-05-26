// ── Library modal ─────────────────────────────────────────────────────────────
// Browse and load sample Questionnaires and QuestionnaireResponses.
//
// init(elements)               — wire DOM once at startup (called from app.js)
// open(focusGroupId, onSelect) — render tree, expand the given group, show modal
//
// onSelect(item) is called with { label, file, type } when user clicks an entry.
// The modal closes automatically before calling onSelect.

import { initModal, openModal, closeModal } from './modal-base.js';

const LIBRARY_URL = 'sampledata/library.json';

// Icons per group id (unused for now, kept for future UI labeling)
const _GROUP_ICONS = {
  'fhir-r4':           '\u2605',  // ★
  'fhir-stu3':         '\u2605',  // ★
  'patient-scenarios': '\u1F9EA', // 🧪
  'qr-responses':      '\u1F4CB', // 📋
};

// Icon per item type
const TYPE_ICONS = {
  'questionnaire': '\u2605',  // ★
  'qr':            '\u1F4CB', // 📋
};

let _el       = null;
let _cache    = null; // fetched library data
let _onSelect = null;

export function init(elements) {
  _el = elements;
  initModal(elements, { onCancel: _close });
  _el.closeBtn.addEventListener('click', _close);
}

/**
 * Open the library modal.
 * @param {string}   focusGroupId  — group id to expand on open (others collapsed)
 * @param {Function} onSelect      — callback(item) fired after modal closes
 * @param {string}   [typeFilter]  — 'questionnaire' | 'qr' — show only matching groups
 */
export function open(focusGroupId, onSelect, typeFilter) {
  _onSelect = onSelect;
  _el.body.innerHTML = '';

  const render = data => {
    const groups = typeFilter
      ? data.filter(g => g.items.some(i => i.type === typeFilter))
      : data;
    _render(groups, focusGroupId);
  };

  if (_cache) {
    render(_cache);
    openModal(_el.modal);
  } else {
    _el.body.textContent = 'Loading\u2026';
    openModal(_el.modal);
    fetch(LIBRARY_URL)
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(data => {
        _cache = data;
        _el.body.innerHTML = '';
        render(data);
      })
      .catch(err => {
        _el.body.textContent = 'Could not load library: ' + err.message;
      });
  }
}

function _close() {
  _onSelect = null;
  closeModal(_el.modal);
}

function _render(groups, focusGroupId) {
  groups.forEach(group => {
    const open = group.id === focusGroupId;

    const groupEl = document.createElement('div');
    groupEl.className = 'lib-group';
    groupEl.dataset.testid = 'lib-group-' + group.id;

    // Header (toggle)
    const hdr = document.createElement('div');
    hdr.className = 'lib-group-hdr';
    hdr.dataset.testid = 'lib-group-hdr-' + group.id;

    const arrow = document.createElement('span');
    arrow.className = 'lib-group-toggle';
    arrow.textContent = open ? '\u25BC' : '\u25BA';

    const lbl = document.createElement('span');
    lbl.textContent = group.label;

    hdr.append(arrow, lbl);

    // Body
    const body = document.createElement('div');
    body.className = 'lib-group-body';
    body.style.display = open ? '' : 'none';

    group.items.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'lib-item';
      row.dataset.testid = 'lib-item-' + group.id + '-' + idx;
      row.dataset.file = item.file;
      row.dataset.sample = item.file;
      row.dataset.type = item.type;

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
        const cb = _onSelect;
        _close();
        if (cb) cb(item);
      });

      body.appendChild(row);
    });

    // Toggle click
    hdr.addEventListener('click', () => {
      const isOpen = body.style.display !== 'none';
      body.style.display = isOpen ? 'none' : '';
      arrow.textContent = isOpen ? '\u25BA' : '\u25BC';
    });

    groupEl.append(hdr, body);
    _el.body.appendChild(groupEl);
  });
}
