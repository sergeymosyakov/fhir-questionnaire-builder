// ── Design Note modal ─────────────────────────────────────────────────────────
// Centered modal for editing node._designNote (FHIR designNote extension).
// Text is author-facing only — never shown to end users.
//
// init(elements)                    — wire DOM once at startup
// open(node, noteLink, setActive)   — populate + show

import { initModal, setModalTitle, openModal, closeModal } from './modal-base.js';

let _el      = null;
let _pending = null; // { node, noteLink, setActive, draftNote }

// ── module API ────────────────────────────────────────────────────────────────

export function init(elements) {
  _el = elements;
  initModal(elements, { onApply: _apply, onCancel: _cancel });
}

export function open(node, noteLink, setActive) {
  _pending = { node, noteLink, setActive, draftNote: node._designNote || '' };
  setModalTitle(_el.title, 'Design Note', node.title || node.id || 'Item');
  _el.body.innerHTML = '';
  _renderBody(_el.body);
  openModal(_el.modal);
  _el.body.querySelector('textarea')?.focus();
}

// ── internals ─────────────────────────────────────────────────────────────────

function _apply() {
  if (!_pending) return;
  const { node, noteLink, setActive } = _pending;
  const v = _pending.draftNote.trim();
  if (v) node._designNote = v;
  else   delete node._designNote;
  setActive(noteLink, !!node._designNote);
  _close();
}

function _cancel() { _close(); }

function _close() {
  _pending = null;
  closeModal(_el.modal);
}

function _renderBody(container) {
  const hint = document.createElement('div');
  hint.className = 'panel-hint';
  hint.textContent = 'Internal note for questionnaire authors. Stored as the FHIR designNote extension — never displayed to patients.';
  container.appendChild(hint);

  const ta = document.createElement('textarea');
  ta.className = 'note-modal-textarea';
  ta.dataset.testid = 'design-note-input';
  ta.placeholder = 'e.g. "Discuss with clinical lead — threshold may change."';
  ta.value = _pending.draftNote;
  ta.oninput = () => { _pending.draftNote = ta.value; };
  container.appendChild(ta);
}
