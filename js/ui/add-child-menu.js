import { AppEvents } from '../events.js';

// ── AddChildMenu ──────────────────────────────────────────────────────────────
// Inline "⊕ Add ▾" dropdown used on group builder nodes.
// Listens for CLOSE_DROPDOWNS to close itself (same pattern as DropdownMenu).
// Button click dispatches CLOSE_DROPDOWNS (closes all others) then toggles.

export class AddChildMenu {
  constructor() {
    this._wrap = document.createElement('div');
    this._wrap.className = 'action-add-wrap';

    this._btn = document.createElement('button');
    this._btn.type = 'button';
    this._btn.className = 'action-add-btn';
    this._btn.dataset.testid = 'group-add-btn';
    this._btn.innerHTML = '&#x2295; Add &#x25BE;';

    this._menu = document.createElement('div');
    this._menu.className = 'action-add-menu';
    this._menu.style.display = 'none';

    this._wrap.appendChild(this._btn);
    this._wrap.appendChild(this._menu);

    this._btn.addEventListener('click', e => {
      e.stopPropagation();
      const wasOpen = this._menu.style.display !== 'none';
      document.dispatchEvent(new CustomEvent(AppEvents.CLOSE_DROPDOWNS));
      this._menu.style.display = wasOpen ? 'none' : 'block';
    });

    document.addEventListener(AppEvents.CLOSE_DROPDOWNS, () => this.close());
  }

  /** Root element to append to the DOM. */
  get el() { return this._wrap; }

  close() { this._menu.style.display = 'none'; }

  /**
   * Add a clickable item to the menu.
   * @param {string} label     Visible text
   * @param {string} testid    data-testid value (e.g. 'add-menu-group')
   * @param {Function} onClick Called after the menu closes
   */
  addItem(label, testid, onClick) {
    const mi = document.createElement('div');
    mi.className = 'action-add-menu-item';
    mi.dataset.testid = testid;
    mi.textContent = label;
    mi.addEventListener('click', () => { this.close(); onClick(); });
    this._menu.appendChild(mi);
    return mi;
  }
}
