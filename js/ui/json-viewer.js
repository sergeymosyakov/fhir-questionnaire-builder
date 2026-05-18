// ── Shared read-only FHIR JSON viewer modal ───────────────────────────────────
// Shows any JSON object as formatted, scrollable, read-only text.
// init(elements) — wire DOM once at startup (called from app.js).
// show(title, data) — open modal with given title and data.
// close() — close modal.

let _el = null;

export function init(elements) {
  _el = elements;
  _el.closeBtn.addEventListener('click', close);
  _el.closeBtnFooter.addEventListener('click', close);
  _el.modal.addEventListener('click', e => { if (e.target === _el.modal) close(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && _el.modal.style.display !== 'none') close();
  });
}

export function show(title, data) {
  _el.title.textContent = title;
  _el.pre.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  _el.modal.style.display = 'flex';
}

export function close() {
  _el.modal.style.display = 'none';
}
