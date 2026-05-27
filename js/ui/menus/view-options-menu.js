import { DropdownMenu } from '../dropdown-menu.js';

export class ViewOptionsMenu extends DropdownMenu {
  constructor() {
    super({
      btnId:    'viewOptionsBtn',
      menuId:   'viewOptionsMenu',
      wrapId:   'viewOptionsWrap',
      label:    '&#x2699;&#xFE0F; View &#x25BE;',
      testid:   'view-options-btn',
      tipTitle: 'View Options',
      tipBody:  'Toggle display of preview elements: linkId, prefix, badges, and hidden items.',
    });

    this._wrap.style.display = 'none';
    this._buildMenu();

    // Prevent clicks inside the checkbox menu from closing it
    this._menu.addEventListener('click', e => e.stopPropagation());
  }

  _buildMenu() {
    const checks = [
      ['viewOptionLinkId', 'Show linkId', 'view-option-linkid', 'showLinkId'],
      ['viewOptionPrefix', 'Show prefix', 'view-option-prefix', 'showPrefix'],
      ['viewOptionBadges', 'Show badges', 'view-option-badges', 'showBadges'],
      ['viewOptionHidden', 'Show hidden', 'view-option-hidden', 'showHiddenItems'],
    ];
    checks.forEach(([inputId, label, testid, key]) => {
      const row = this._checkItem(inputId, label, testid);
      row.querySelector('input').addEventListener('change', e => {
        document.dispatchEvent(new CustomEvent('view-pref-change', { detail: { key, value: e.target.checked } }));
      });
      this._menu.appendChild(row);
    });
  }
}
