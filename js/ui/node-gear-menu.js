import { AppEvents } from '../events.js';

// ── NodeGearMenu ──────────────────────────────────────────────────────────────
// Gear (⚙) dropdown shown in the top-right corner of a builder node, in place of
// the old "×" delete button. Consolidates node actions:
//   - groups: Add Group, Add Item, Delete
//   - items:  Delete
// Follows the same CLOSE_DROPDOWNS toggle pattern as AddChildMenu / DropdownMenu.

const _GEAR_SVG =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<circle cx="12" cy="12" r="3"/>' +
  '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' +
  '</svg>';

export class NodeGearMenu {
  /** @param {string} testid data-testid for the gear button */
  constructor(testid) {
    this._wrap = document.createElement('div');
    this._wrap.className = 'node-gear-wrap';

    this._btn = document.createElement('button');
    this._btn.type = 'button';
    this._btn.className = 'node-gear-btn';
    this._btn.dataset.testid = testid;
    this._btn.dataset.tipTitle = 'Node actions';
    this._btn.innerHTML = _GEAR_SVG;

    this._menu = document.createElement('div');
    this._menu.className = 'node-gear-menu';
    this._menu.style.display = 'none';

    this._wrap.appendChild(this._btn);
    this._wrap.appendChild(this._menu);

    this._btn.addEventListener('click', e => {
      e.stopPropagation();
      const wasOpen = this._menu.style.display !== 'none';
      document.dispatchEvent(new CustomEvent(AppEvents.CLOSE_DROPDOWNS));
      if (wasOpen) {
        this.close();
      } else {
        this._menu.style.display = 'block';
        this._wrap.classList.add('node-gear-wrap--open');
      }
    });

    document.addEventListener(AppEvents.CLOSE_DROPDOWNS, () => this.close());
  }

  /** Root element to append to the DOM. */
  get el() { return this._wrap; }

  close() { this._menu.style.display = 'none'; this._wrap.classList.remove('node-gear-wrap--open'); }

  /** Add a divider between item groups. */
  addSep() {
    const sep = document.createElement('div');
    sep.className = 'node-gear-menu-sep';
    this._menu.appendChild(sep);
  }

  /**
   * Add a checkable item to the menu (shows a ✓ prefix when checked).
   * @param {string}   label
   * @param {string}   testid
   * @param {boolean}  checked   initial checked state
   * @param {Function} onClick   called after the menu closes
   */
  addCheckItem(label, testid, checked, onClick) {
    const mi = document.createElement('div');
    mi.className = 'node-gear-menu-item node-gear-menu-item--checkable';
    if (checked) mi.classList.add('node-gear-menu-item--checked');
    mi.dataset.testid = testid;
    mi.textContent = label;
    mi.addEventListener('click', () => { this.close(); onClick(); });
    this._menu.appendChild(mi);
    return mi;
  }

  /**
   * Add a clickable item to the menu.
   * @param {string} label            Visible text
   * @param {string} testid           data-testid value
   * @param {Function} onClick        Called after the menu closes
   * @param {{destructive?: boolean, disabled?: boolean}} [opts]
   */
  addItem(label, testid, onClick, opts = {}) {
    const mi = document.createElement('div');
    mi.className = 'node-gear-menu-item' + (opts.destructive ? ' node-gear-menu-item--danger' : '');
    if (opts.disabled) mi.classList.add('node-gear-menu-item--disabled');
    mi.dataset.testid = testid;
    mi.textContent = label;
    mi.addEventListener('click', () => {
      if (mi.classList.contains('node-gear-menu-item--disabled')) return;
      this.close();
      onClick();
    });
    this._menu.appendChild(mi);
    return mi;
  }
}
