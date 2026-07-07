// ── More menu (⋯) ────────────────────────────────────────────────────────────
// Consolidates Undo, Redo, Help and Settings into a single "⋯" dropdown button.
// Undo and Redo buttons keep their data-mount attributes so UndoRedo class
// can find and wire them as usual.
import { DropdownMenu } from '../dropdown-menu.js';
import { AppEvents, EventState }    from '../../events.js';

export class MoreMenu extends DropdownMenu {
  constructor() {
    super({
      btnId:    'moreBtn',
      menuId:   'moreMenu',
      wrapId:   'moreWrap',
      label:    'More &#x25BE;',
      testid:   'more-btn',
      tipTitle: 'More',
      tipBody:  'View mode, tree controls, Undo, Redo, Help and Settings.',
    });

    this._menu.className += ' load-menu--right';
    this._buildMenu();

    document.addEventListener(AppEvents.BUILDER_VIEW_MODE_CHANGE, e => this._reflectMode(e.detail?.mode));
    this._reflectMode(EventState.get(AppEvents.BUILDER_VIEW_MODE_CHANGE)?.mode);
  }

  _reflectMode(mode) {
    if (!this._simpleItem || !this._advancedItem) return;
    this._simpleItem.classList.toggle('load-menu-item--checked',   mode === 'simple');
    this._advancedItem.classList.toggle('load-menu-item--checked', mode === 'advanced');
  }

  _buildMenu() {
    // ── View mode: Simple / Advanced ──────────────────────────────────────────
    this._simpleItem = this._item('moreSimpleItem', 'Simple', 'view-simple-item');
    this._simpleItem.classList.add('load-menu-item--checkable');
    this._simpleItem.dataset.tipTitle = 'Simple view';
    this._simpleItem.dataset.tipBody  = 'Hides advanced per-item controls (States, Show When, Answer Type, Expression, etc.), leaving only Add group/item, rename and delete.';
    this._simpleItem.addEventListener('click', () => {
      this.close();
      document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_VIEW_MODE_CHANGE, { detail: { mode: 'simple' } }));
    });

    this._advancedItem = this._item('moreAdvancedItem', 'Advanced', 'view-advanced-item');
    this._advancedItem.classList.add('load-menu-item--checkable');
    this._advancedItem.dataset.tipTitle = 'Advanced view';
    this._advancedItem.dataset.tipBody  = 'Shows every per-item control (all modal action links) on the builder tree.';
    this._advancedItem.addEventListener('click', () => {
      this.close();
      document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_VIEW_MODE_CHANGE, { detail: { mode: 'advanced' } }));
    });

    // ── Tree controls: Expand all / Collapse all ──────────────────────────────
    const expandItem = this._item(null, '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="menu-item-icon"><path d="M2 6 L2 2 L6 2 M10 2 L14 2 L14 6 M14 10 L14 14 L10 14 M6 14 L2 14 L2 10"/></svg>Expand all', 'expand-all-btn');
    expandItem.dataset.tipTitle = 'Expand all';
    expandItem.dataset.tipBody  = 'Shows all children under every group in the builder tree.';
    expandItem.addEventListener('click', () => {
      this.close();
      document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_EXPAND_ALL));
    });

    const collapseItem = this._item(null, '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="menu-item-icon"><path d="M6 2 L6 6 L2 6 M10 2 L10 6 L14 6 M14 10 L10 10 L10 14 M6 14 L6 10 L2 10"/></svg>Collapse all', 'collapse-all-btn');
    collapseItem.dataset.tipTitle = 'Collapse all';
    collapseItem.dataset.tipBody  = 'Hides children under every group in the builder tree.';
    collapseItem.addEventListener('click', () => {
      this.close();
      document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_COLLAPSE_ALL));
    });

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

    this._menu.append(
      this._simpleItem, this._advancedItem, this._sep(),
      expandItem, collapseItem, this._sep(),
      this._undoItem, this._redoItem, sep,
      this._helpItem, this._settingsItem,
    );
  }
}
