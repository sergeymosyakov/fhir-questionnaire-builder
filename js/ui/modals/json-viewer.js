// ── Shared read-only FHIR JSON viewer modal ───────────────────────────────────
// Shows any JSON object as formatted, scrollable, read-only text.
// init(elements) — wire DOM once at startup (called from app.js).
// show(title, data) — open modal with given title and data.
// close() — close modal.

import { initModal, openModal, closeModal, createModalElements } from './modal-base.js';

const _el = {
  ...createModalElements('fhirJsonModal'),
  pre:       document.getElementById('fhirJsonModalPre'),
  cancelBtn: document.getElementById('fhirJsonModalCloseBtn'),
};
initModal(_el, { onCancel: close });
document.addEventListener('show-json', e => show(e.detail.title, e.detail.data));

export function show(title, data) {
  _el.title.textContent = title;
  _el.pre.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  openModal(_el.modal);
}

export function close() {
  closeModal(_el.modal);
}
