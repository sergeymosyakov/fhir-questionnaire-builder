// ── Modal lifecycle utilities ─────────────────────────────────────────────────
// Shared helpers for the standard draft-pattern modal lifecycle.
//
// initModal(elements, { onApply?, onCancel })
//   Wire lifecycle events once — call from each modal's init().
//   elements must contain: modal, closeBtn, and optionally cancelBtn, applyBtn.
//
// setModalTitle(titleEl, label, subject)
//   Render the standard two-part title: bold label + muted subject.
//
// openModal(modalEl)  / closeModal(modalEl)
//   Show / hide helpers (replaces inline style assignments).

/**
 * Wire standard modal lifecycle events (call once from init()).
 * @param {{ modal: HTMLElement, closeBtn: HTMLElement, cancelBtn?: HTMLElement, applyBtn?: HTMLElement }} elements
 * @param {{ onApply?: Function, onCancel: Function }} callbacks
 */
export function initModal(elements, { onApply, onCancel }) {
  const { modal, closeBtn, cancelBtn, applyBtn } = elements;
  if (closeBtn)            closeBtn.addEventListener('click', onCancel);
  if (cancelBtn)           cancelBtn.addEventListener('click', onCancel);
  if (applyBtn && onApply) applyBtn.addEventListener('click', onApply);
  modal.addEventListener('click', e => { if (e.target === modal) onCancel(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.style.display !== 'none') onCancel();
  });
}

/**
 * Render the standard two-part modal title (bold label + muted subject).
 * @param {HTMLElement} titleEl  — the title container element
 * @param {string}      label   — bold left part  (e.g. "Required", "Show When")
 * @param {string}      subject — muted right part (e.g. node.title || node.id)
 */
export function setModalTitle(titleEl, label, subject) {
  titleEl.innerHTML = '';
  const labelEl = document.createElement('span');
  labelEl.className   = 'modal-title-label';
  labelEl.textContent = label;
  titleEl.appendChild(labelEl);
  if (subject) {
    const subjectEl = document.createElement('span');
    subjectEl.className   = 'modal-title-subject';
    subjectEl.textContent = ' \u2014 ' + subject;
    titleEl.appendChild(subjectEl);
  }
}

/** Show the modal (sets display to flex). */
export function openModal(modalEl)  { modalEl.style.display = 'flex'; }

/** Hide the modal (sets display to none). */
export function closeModal(modalEl) { modalEl.style.display = 'none'; }
