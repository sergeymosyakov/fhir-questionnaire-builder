import { AppEvents } from '../events.js';

export const DESKTOP_MIN_WIDTH = 1024; // must match css/builder-toolbar.css breakpoint

// ── DropdownMenu base class ───────────────────────────────────────────────────
// Subclass this to build a .load-wrap button+menu dropdown.
// Listens for CLOSE_DROPDOWNS CustomEvent to close itself.
// Button click dispatches CLOSE_DROPDOWNS (closes all others) then opens own menu.
// Below 1024px the menu becomes a bottom-sheet (css/builder-toolbar.css,
// matches css/status-badge.css's .status-dropdown) — full width, pinned to the
// bottom, height fits its content; the trigger gets a pressed/active look
// while its menu is open.
//
// Constructor options:
//   btnId, menuId     — HTML ids for button and menu div
//   wrapId            — optional id for the .load-wrap element
//   label             — innerHTML for the button
//   menuTitle         — mobile-only header title naming the menu (e.g. 'Answers')
//   btnClass          — CSS classes for the button (default: 'btn-fhir')
//   testid            — data-testid on the button
//   tipTitle/tipBody  — rich tooltip attributes on the button
//   tipFhir/tipSpec   — FHIR path / spec badge for tooltip

export class DropdownMenu {
  // One-time global click handler: clicking outside any dropdown closes all.
  static {
    if (typeof document !== 'undefined') {
      document.addEventListener('click', () =>
        document.dispatchEvent(new CustomEvent(AppEvents.CLOSE_DROPDOWNS)));
    }
  }

  constructor({ btnId, menuId, wrapId, label = '', menuTitle, btnClass = 'btn-fhir',
                testid, tipTitle, tipBody, tipFhir, tipSpec } = {}) {
    this._wrap = document.createElement('div');
    this._wrap.className = 'load-wrap';
    if (wrapId) { this._wrap.id = wrapId; this._wrap.dataset.mount = wrapId; }

    this._btn = document.createElement('button');
    this._btn.id = btnId;
    this._btn.type = 'button';
    this._btn.className = btnClass;
    if (testid)   this._btn.dataset.testid   = testid;
    if (tipTitle) this._btn.dataset.tipTitle = tipTitle;
    if (tipBody)  this._btn.dataset.tipBody  = tipBody;
    if (tipFhir)  this._btn.dataset.tipFhir  = tipFhir;
    if (tipSpec)  this._btn.dataset.tipSpec  = tipSpec;
    this._btn.innerHTML = label;
    this._btn.setAttribute('aria-haspopup', 'menu');
    this._btn.setAttribute('aria-expanded', 'false');

    this._menu = document.createElement('div');
    this._menu.className = 'load-menu';
    this._menu.id = menuId;
    if (menuId) this._menu.dataset.testid = menuId.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    this._menu.style.display = 'none';

    // Mobile-only (CSS hides/positions it) — lives inside .load-menu so it
    // survives normal item appends; subclasses that fully rebuild their menu
    // content (LanguageMenu.rebuild()) must re-append it after clearing.
    this._closeBtn = document.createElement('button');
    this._closeBtn.type = 'button';
    this._closeBtn.className = 'load-menu-close';
    this._closeBtn.dataset.testid = 'load-menu-close';
    this._closeBtn.dataset.tipTitle = 'Close';
    this._closeBtn.textContent = '\u2715';
    this._closeBtn.addEventListener('click', e => { e.stopPropagation(); this.close(); });

    this._menuHeader = document.createElement('div');
    this._menuHeader.className = 'load-menu-header';
    this._menuHeader.dataset.testid = 'load-menu-header';
    const titleEl = document.createElement('span');
    titleEl.className = 'load-menu-title';
    titleEl.dataset.testid = 'load-menu-title';
    titleEl.textContent = menuTitle || '';
    this._menuHeader.append(titleEl, this._closeBtn);
    this._menu.appendChild(this._menuHeader);

    this._wrap.appendChild(this._btn);
    this._wrap.appendChild(this._menu);

    this._btn.addEventListener('click', e => {
      e.stopPropagation();
      const wasOpen = this._menu.style.display !== 'none';
      document.dispatchEvent(new CustomEvent(AppEvents.CLOSE_DROPDOWNS));
      if (!wasOpen) {
        this._onOpen?.();
        this._menu.style.display = 'block';
        this._btn.classList.add('load-btn--active');
        this._btn.setAttribute('aria-expanded', 'true');
      }
    });

    document.addEventListener(AppEvents.CLOSE_DROPDOWNS, () => this.close());
  }

  /** Root element to append to the DOM. */
  get el() { return this._wrap; }

  close() {
    this._menu.style.display = 'none';
    this._btn.classList.remove('load-btn--active');
    this._btn.setAttribute('aria-expanded', 'false');
  }
  show()  { this._wrap.style.display = ''; }
  hide()  { this._wrap.style.display = 'none'; }

  /** Start hidden; show on QUESTIONNAIRE_LOADED / NEW, hide on CLEARED. */
  _bindTreeVisibility() {
    this.hide();
    document.addEventListener(AppEvents.QUESTIONNAIRE_LOADED, () => this.show());
    document.addEventListener(AppEvents.QUESTIONNAIRE_NEW,    () => this.show());
    document.addEventListener(AppEvents.QUESTIONNAIRE_CLEARED,() => this.hide());
  }

  // ── DOM helpers for subclasses ─────────────────────────────────────────────

  /** Plain text/HTML menu item div. */
  _item(id, html, testid) {
    const el = document.createElement('div');
    el.className = 'load-menu-item';
    if (id)     el.id = id;
    if (testid) el.dataset.testid = testid;
    el.innerHTML = window.DOMPurify ? window.DOMPurify.sanitize(html) : html;
    return el;
  }

  /** Separator line. */
  _sep(id) {
    const el = document.createElement('div');
    el.className = 'load-menu-sep';
    if (id) el.id = id;
    return el;
  }

  /** Checkbox label row for View Options style items. */
  _checkItem(inputId, label, testid) {
    const lbl = document.createElement('label');
    lbl.className = 'load-menu-item load-menu-item--checkbox';
    if (testid) lbl.dataset.testid = testid;

    const inp = document.createElement('input');
    inp.type = 'checkbox';
    inp.id = inputId;
    inp.checked = true;

    const span = document.createElement('span');
    span.textContent = label;

    lbl.appendChild(inp);
    lbl.appendChild(span);
    return lbl;
  }
}
