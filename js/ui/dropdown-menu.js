// ── DropdownMenu base class ───────────────────────────────────────────────────
// Subclass this to build a .load-wrap button+menu dropdown.
// Listens for 'close-dropdowns' CustomEvent to close itself.
// Button click dispatches 'close-dropdowns' (closes all others) then opens own menu.
//
// Constructor options:
//   btnId, menuId     — HTML ids for button and menu div
//   wrapId            — optional id for the .load-wrap element
//   label             — innerHTML for the button
//   btnClass          — CSS classes for the button (default: 'btn-fhir')
//   testid            — data-testid on the button
//   tipTitle/tipBody  — rich tooltip attributes on the button
//   tipFhir/tipSpec   — FHIR path / spec badge for tooltip

export class DropdownMenu {
  constructor({ btnId, menuId, wrapId, label, btnClass = 'btn-fhir',
                testid, tipTitle, tipBody, tipFhir, tipSpec } = {}) {
    this._wrap = document.createElement('div');
    this._wrap.className = 'load-wrap';
    if (wrapId) this._wrap.id = wrapId;

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

    this._menu = document.createElement('div');
    this._menu.className = 'load-menu';
    this._menu.id = menuId;
    this._menu.style.display = 'none';

    this._wrap.appendChild(this._btn);
    this._wrap.appendChild(this._menu);

    this._btn.addEventListener('click', e => {
      e.stopPropagation();
      const wasOpen = this._menu.style.display !== 'none';
      document.dispatchEvent(new CustomEvent('close-dropdowns'));
      if (!wasOpen) {
        this._onOpen?.();
        this._menu.style.display = 'block';
      }
    });

    document.addEventListener('close-dropdowns', () => this.close());
  }

  /** Root element to append to the DOM. */
  get el() { return this._wrap; }

  close() { this._menu.style.display = 'none'; }
  show()  { this._wrap.style.display = ''; }
  hide()  { this._wrap.style.display = 'none'; }

  // ── DOM helpers for subclasses ─────────────────────────────────────────────

  /** Plain text/HTML menu item div. */
  _item(id, html, testid) {
    const el = document.createElement('div');
    el.className = 'load-menu-item';
    if (id)     el.id = id;
    if (testid) el.dataset.testid = testid;
    el.innerHTML = html;
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
