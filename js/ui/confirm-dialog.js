// ── ConfirmDialog ─────────────────────────────────────────────────────────────
// Self-contained "Delete node?" confirmation modal.
// Usage: `const ok = await ConfirmDialog.show(label)` — no DI needed.
export class ConfirmDialog {
  /**
   * Show a "Delete node?" confirmation dialog.
   * @param {string} label  - Node title / linkId shown in the message body.
   * @returns {Promise<boolean>} Resolves true if user confirms, false otherwise.
   */
  static show(label) {
    return new Promise(resolve => {
      const backdrop = document.createElement('div');
      backdrop.className = 'clear-confirm-backdrop';
      const box = document.createElement('div');
      box.className = 'clear-confirm-box';
      box.innerHTML =
        '<div class="clear-confirm-title">Delete node?</div>' +
        '<div class="clear-confirm-msg"></div>' +
        '<div class="clear-confirm-btns">' +
          '<button class="btn-fhir btn-danger" id="_cdDel" ' +
            'data-testid="delete-confirm-del-btn">Delete</button>' +
          '<button class="btn-fhir" id="_cdCancel" ' +
            'data-testid="delete-confirm-cancel-btn">Cancel</button>' +
        '</div>';
      const msg = box.querySelector('.clear-confirm-msg');
      const strong = document.createElement('strong');
      strong.textContent = label;
      msg.appendChild(strong);
      msg.appendChild(document.createTextNode(
        ' and all its children will be permanently removed.'));
      backdrop.appendChild(box);
      document.body.appendChild(backdrop);
      const esc = e => { if (e.key === 'Escape') close(false); };
      document.addEventListener('keydown', esc);
      const close = ok => {
        document.removeEventListener('keydown', esc);
        backdrop.remove();
        resolve(ok);
      };
      box.querySelector('#_cdDel').onclick = () => close(true);
      box.querySelector('#_cdCancel').onclick = () => close(false);
      backdrop.addEventListener('click', e => {
        if (e.target === backdrop) close(false);
      });
    });
  }
}
