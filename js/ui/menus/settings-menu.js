// ── Settings menu ─────────────────────────────────────────────────────────────
// Replaces ToolsMenu. Two sections:
//   1. Preferences — toggle rows (Tips, Autosave, Local validation, Server validation)
//   2. Tools       — Validate now, Expand all, Collapse all
//
// Tips and Autosave initial state is read from their own modules (injected via
// setHandlers). Validate preferences are owned by Prefs (localStorage).
import { DropdownMenu } from '../dropdown-menu.js';
import { AppEvents } from '../../events.js';

export class SettingsMenu extends DropdownMenu {
  /**
   * @param {{ prefs: import('../prefs.js').Prefs }} deps
   */
  constructor({ prefs }) {
    super({
      btnId:    'toolsBtn',
      menuId:   'toolsMenu',
      wrapId:   'toolsWrap',
      label:    '&#x2699;&#xFE0F; Settings &#x25BE;',
      testid:   'tools-btn',
      tipTitle: 'Settings',
      tipBody:  'Toggle tooltips, autosave and validation; validate questionnaire; expand or collapse all.',
    });

    this._prefs = prefs;
    this._menu.className = 'load-menu load-menu--right';
    this._bindTreeVisibility();
    this._buildMenu();
  }

  _buildMenu() {
    // Initial states: tips/autosave unknown until setHandlers(); validate from prefs
    this._tipsRow             = this._toggleRow('Tips',               true);
    this._autosaveRow         = this._toggleRow('Autosave',           true);
    this._validateLocalRow    = this._toggleRow('Local validation',   this._prefs.get('validate'));
    this._validateExternalRow = this._toggleRow('Server validation',  this._prefs.get('validateExternal'));

    // ── Section label: Tools ───────────────────────────────────────────────
    this._validateItem = this._item('validateItem',
      'Validate',
      'validate-item');
    this._expandItem = this._item('expandAllItem',
      '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:5px"><path d="M2 6 L2 2 L6 2 M10 2 L14 2 L14 6 M14 10 L14 14 L10 14 M6 14 L2 14 L2 10"/></svg>Expand all',
      'expand-all-item');
    this._collapseItem = this._item('collapseAllItem',
      '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:5px"><path d="M6 2 L6 6 L2 6 M10 2 L10 6 L14 6 M14 10 L10 10 L10 14 M6 14 L6 10 L2 10"/></svg>Collapse all',
      'collapse-all-item');

    this._menu.append(
      this._tipsRow,
      this._autosaveRow,
      this._validateLocalRow,
      this._validateExternalRow,
      this._sep(),
      this._validateItem,
      this._sep(),
      this._expandItem,
      this._collapseItem,
    );
  }

  /** Build a toggle row: label text on left, ✓ on right when active. */
  _toggleRow(label, checked) {
    const el = document.createElement('div');
    el.className = 'load-menu-item settings-toggle-row';
    el.dataset.active = String(checked);

    const labelEl = document.createElement('span');
    labelEl.className = 'settings-toggle-label';
    labelEl.textContent = label;

    const check = document.createElement('span');
    check.className = 'settings-toggle-check';
    check.dataset.role = 'check';
    check.textContent = checked ? '\u2713' : '';

    el.append(labelEl, check);
    return el;
  }

  _setToggle(row, value) {
    row.dataset.active = String(value);
    row.querySelector('[data-role="check"]').textContent = value ? '\u2713' : '';
  }

  /** Update the autosave row label (e.g. "Autosave · 14:32") */
  setAutosaveLabel(text) {
    this._autosaveRow.querySelector('.settings-toggle-label').textContent = text;
  }

  /**
   * Wire all action callbacks. Tips and Autosave initial states are
   * injected here because they resolve asynchronously from storage.
   *
   * @param {{
   *   initialTips:      boolean,
   *   initialAutosave:  boolean,
   *   onTipsToggle:     (enabled: boolean) => void,
   *   onAutosaveToggle: (enabled: boolean) => void,
   *   onValidateToggle: (enabled: boolean) => void,
   *   onValidate:       () => void,
   *   onExpand:         () => void,
   *   onCollapse:       () => void,
   * }} handlers
   */
  setHandlers({ initialTips, initialAutosave, onTipsToggle, onAutosaveToggle, onValidateToggle, onValidate, onExpand, onCollapse }) {
    this._setToggle(this._tipsRow,     initialTips);
    this._setToggle(this._autosaveRow, initialAutosave);

    this._tipsRow.addEventListener('click', (e) => {
      e.stopPropagation(); // keep menu open on pref toggle
      const next = !this._isActive(this._tipsRow);
      this._setToggle(this._tipsRow, next);
      onTipsToggle(next);
    });

    this._autosaveRow.addEventListener('click', (e) => {
      e.stopPropagation();
      const next = !this._isActive(this._autosaveRow);
      this._setToggle(this._autosaveRow, next);
      onAutosaveToggle(next);
    });

    this._validateLocalRow.addEventListener('click', (e) => {
      e.stopPropagation();
      const next = this._prefs.toggle('validate');
      this._setToggle(this._validateLocalRow, next);
      onValidateToggle(next);
    });

    this._validateExternalRow.addEventListener('click', (e) => {
      e.stopPropagation();
      const next = this._prefs.toggle('validateExternal');
      this._setToggle(this._validateExternalRow, next);
    });

    this._validateItem.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent(AppEvents.CLOSE_DROPDOWNS));
      onValidate();
    });

    this._expandItem.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent(AppEvents.CLOSE_DROPDOWNS));
      onExpand();
    });

    this._collapseItem.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent(AppEvents.CLOSE_DROPDOWNS));
      onCollapse();
    });
  }

  _isActive(row) {
    return row.dataset.active === 'true';
  }
}
