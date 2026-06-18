// ── More menu (⋯) ────────────────────────────────────────────────────────────
// Consolidates Undo, Redo, Help and Settings into a single "⋯" dropdown button.
// Undo and Redo buttons keep their data-mount attributes so UndoRedo class
// can find and wire them as usual.
import { DropdownMenu } from '../dropdown-menu.js';
import { AppEvents }    from '../../events.js';

export class MoreMenu extends DropdownMenu {
  constructor() {
    super({
      btnId:    'moreBtn',
      menuId:   'moreMenu',
      wrapId:   'moreWrap',
      label:    'More &#x25BE;',
      testid:   'more-btn',
      tipTitle: 'More',
      tipBody:  'Undo, Redo, Help and Settings.',
    });

    this._menu.className += ' load-menu--right';
    this._buildMenu();
  }

  _buildMenu() {
    // ── Undo ────────────────────────────────────────────────────────────────
    this._undoItem = document.createElement('button');
    this._undoItem.type = 'button';
    this._undoItem.className = "load-menu-item";
    this._undoItem.dataset.mount  = 'undo-btn';
    this._undoItem.dataset.testid = 'undo-btn';
    this._undoItem.dataset.tipTitle = 'Undo';
    this._undoItem.dataset.tipBody  = 'Undo the last change (Ctrl+Z).';
    this._undoItem.dataset.tipSpec  = 'Ctrl+Z';
    this._undoItem.innerHTML = '&#x21B6; Undo';
    this._undoItem.disabled = true;
    this._undoItem.addEventListener('click', () =>
      document.dispatchEvent(new CustomEvent(AppEvents.CLOSE_DROPDOWNS)));

    // ── Redo ────────────────────────────────────────────────────────────────
    this._redoItem = document.createElement('button');
    this._redoItem.type = 'button';
    this._redoItem.className = "load-menu-item";
    this._redoItem.dataset.mount  = 'redo-btn';
    this._redoItem.dataset.testid = 'redo-btn';
    this._redoItem.dataset.tipTitle = 'Redo';
    this._redoItem.dataset.tipBody  = 'Redo the last undone change (Ctrl+Y).';
    this._redoItem.dataset.tipSpec  = 'Ctrl+Y';
    this._redoItem.innerHTML = '&#x21B7; Redo';
    this._redoItem.disabled = true;
    this._redoItem.addEventListener('click', () =>
      document.dispatchEvent(new CustomEvent(AppEvents.CLOSE_DROPDOWNS)));

    // ── Separator ────────────────────────────────────────────────────────────
    const sep = this._sep();

    // ── Help ────────────────────────────────────────────────────────────────
    this._helpItem = document.createElement('button');
    this._helpItem.type = 'button';
    this._helpItem.className = "load-menu-item";
    this._helpItem.dataset.mount  = 'help-btn';
    this._helpItem.dataset.testid = 'help-btn';
    this._helpItem.dataset.tipTitle = 'FHIR Field Reference';
    this._helpItem.dataset.tipBody  = 'Open the field reference — find any FHIR R4 / SDC field and where to configure it in the builder UI.';
    this._helpItem.innerHTML = '? FHIR Reference';
    this._helpItem.addEventListener('click', () =>
      document.dispatchEvent(new CustomEvent(AppEvents.CLOSE_DROPDOWNS)));

    // ── Settings ────────────────────────────────────────────────────────────
    this._settingsItem = document.createElement('a');
    this._settingsItem.href   = 'settings.html';
    this._settingsItem.target = '_blank';
    this._settingsItem.className = "load-menu-item";
    this._settingsItem.dataset.testid = 'settings-page-btn';
    this._settingsItem.dataset.tipTitle = 'Settings';
    this._settingsItem.dataset.tipBody  = 'Configure servers (terminology, FHIR base, CORS proxy) and validators.';
    this._settingsItem.innerHTML = '&#x2699; Settings';
    this._settingsItem.addEventListener('click', () =>
      document.dispatchEvent(new CustomEvent(AppEvents.CLOSE_DROPDOWNS)));

    this._menu.append(this._undoItem, this._redoItem, sep, this._helpItem, this._settingsItem);
  }
}
