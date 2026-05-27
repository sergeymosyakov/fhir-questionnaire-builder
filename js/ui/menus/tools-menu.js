import { DropdownMenu } from '../dropdown-menu.js';

export class ToolsMenu extends DropdownMenu {
  constructor() {
    super({
      btnId:    'toolsBtn',
      menuId:   'toolsMenu',
      wrapId:   'toolsWrap',
      label:    '&#x1F6E0;&#xFE0F; Tools &#x25BE;',
      testid:   'tools-btn',
      tipTitle: 'Tools',
      tipBody:  'Validate questionnaire structure, expand or collapse all preview groups.',
    });

    this._menu.className = 'load-menu load-menu--right';
    this._wrap.style.display = 'none';
    this._buildMenu();
  }

  _buildMenu() {
    this._validateItem = this._item('validateItem', '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:5px"><polyline points="1,9 5,13 15,3"/></svg>Validate', 'validate-item');
    this._expandItem   = this._item('expandAllItem',   '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:5px"><path d="M2 6 L2 2 L6 2 M10 2 L14 2 L14 6 M14 10 L14 14 L10 14 M6 14 L2 14 L2 10"/></svg>Expand all', 'expand-all-item');
    this._collapseItem = this._item('collapseAllItem', '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:5px"><path d="M6 2 L6 6 L2 6 M10 2 L10 6 L14 6 M14 10 L10 10 L10 14 M6 14 L6 10 L2 10"/></svg>Collapse all', 'collapse-all-item');

    this._menu.append(
      this._validateItem,
      this._sep(),
      this._expandItem,
      this._collapseItem,
    );
  }

  setHandlers({ onValidate, onExpand, onCollapse }) {
    this._validateItem.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('close-dropdowns'));
      onValidate();
    });

    this._expandItem.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('close-dropdowns'));
      onExpand();
    });

    this._collapseItem.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('close-dropdowns'));
      onCollapse();
    });
  }
}
