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
    this._tipsRow             = this._checkItem('settings-tips-check',              'Tips');
    this._autosaveRow         = this._checkItem('settings-autosave-check',          'Autosave');
    this._validateLocalRow    = this._checkItem('settings-validate-local-check',    'Local validation');
    this._validateExternalRow = this._checkItem('settings-validate-external-check', 'Server validation');

    // Set initial checked states
    this._inp(this._validateLocalRow).checked    = this._prefs.get('validate');
    this._inp(this._validateExternalRow).checked = this._prefs.get('validateExternal');

    // ── Section label: Tools ───────────────────────────────────────────────
    this._validateItem = this._item('validateItem',
      'Validate',
      'validate-item');
    this._expandItem = this._item('expandAllItem',
      '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="menu-item-icon"><path d="M2 6 L2 2 L6 2 M10 2 L14 2 L14 6 M14 10 L14 14 L10 14 M6 14 L2 14 L2 10"/></svg>Expand all',
      'expand-all-item');
    this._collapseItem = this._item('collapseAllItem',
      '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="menu-item-icon"><path d="M6 2 L6 6 L2 6 M10 2 L10 6 L14 6 M14 10 L10 10 L10 14 M6 14 L6 10 L2 10"/></svg>Collapse all',
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

  /** Get the checkbox input inside a row built by _checkItem. */
  _inp(row) { return row.querySelector('input'); }

  /** Update the autosave row label (e.g. "Autosave · 14:32") */
  setAutosaveLabel(text) {
    this._autosaveRow.querySelector('span').textContent = text;
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
   *   onValidate:       () => void,
   *   onExpand:         () => void,
   *   onCollapse:       () => void,
   * }} handlers
   */
  setHandlers({ initialTips, initialAutosave, onTipsToggle, onAutosaveToggle, onValidate, onExpand, onCollapse }) {
    this._inp(this._tipsRow).checked     = initialTips;
    this._inp(this._autosaveRow).checked = initialAutosave;

    // Keep menu open on checkbox toggle (stop click from bubbling to backdrop)
    [this._tipsRow, this._autosaveRow, this._validateLocalRow, this._validateExternalRow]
      .forEach(row => row.addEventListener('click', e => e.stopPropagation()));

    this._inp(this._tipsRow).addEventListener('change', e => onTipsToggle(e.target.checked));
    this._inp(this._autosaveRow).addEventListener('change', e => onAutosaveToggle(e.target.checked));

    this._inp(this._validateLocalRow).addEventListener('change', e => {
      const enabled = e.target.checked;
      this._prefs.set('validate', enabled);
      document.dispatchEvent(new CustomEvent(AppEvents.VALIDATOR_TOGGLE, { detail: { id: 'local', enabled } }));
    });

    this._inp(this._validateExternalRow).addEventListener('change', e => {
      const enabled = e.target.checked;
      this._prefs.set('validateExternal', enabled);
      document.dispatchEvent(new CustomEvent(AppEvents.VALIDATOR_TOGGLE, { detail: { id: 'external', enabled } }));
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
    return this._inp(row).checked;
  }
}
