// ── UserMenu ──────────────────────────────────────────────────────────────────
// Signed-in user avatar + "Sign out" dropdown, shown in the top panel.
// Extends DropdownMenu — inherits toggle/active-state/header/close-dropdowns
// logic instead of duplicating it (was a bespoke implementation in AuthPanel).
import { DropdownMenu, DESKTOP_MIN_WIDTH } from '../dropdown-menu.js';

export class UserMenu extends DropdownMenu {
  constructor() {
    super({
      btnClass: 'btn-fhir auth-user-btn',
      menuTitle: 'Account',
      testid:   'user-menu-btn',
    });
    this._onSignOut = null;

    this._wrap.classList.add('top-panel-auth');
    this._wrap.style.display = 'none'; // hidden until signed in

    this._avatar = document.createElement('img');
    this._avatar.className = 'auth-user-avatar';
    this._avatar.alt = '';
    this._avatar.width = 18;
    this._avatar.height = 18;

    this._name = document.createElement('span');
    this._name.className = 'auth-user-name';

    const chevron = document.createElement('span');
    chevron.innerHTML = '&#x25BE;';
    this._btn.append(this._avatar, this._name, chevron);

    // .top-panel has overflow-x:auto — position:fixed (via CSS) escapes the clipping.
    this._menu.classList.add('load-menu--escape-clip', 'auth-user-menu');

    this._signOutItem = this._item(null, 'Sign out', 'sign-out-btn');
    this._signOutItem.addEventListener('click', () => { this.close(); this._onSignOut?.(); });
    this._menu.appendChild(this._signOutItem);
  }

  /** Desktop-only: anchor below the button, right-edge aligned. Below
      DESKTOP_MIN_WIDTH the shared mobile .load-menu rule takes over (see
      PatientPresetMenu for the identical pattern). */
  _onOpen() {
    if (window.innerWidth < DESKTOP_MIN_WIDTH) return;
    const r = this._btn.getBoundingClientRect();
    this._menu.style.top      = (r.bottom + 4) + 'px';
    this._menu.style.right    = (window.innerWidth - r.right) + 'px';
    this._menu.style.minWidth = r.width + 'px';
  }

  /** @param {object|null} user  Supabase user, or null when signed out. */
  setUser(user) {
    if (user) {
      this._wrap.style.display = 'inline-flex';
      this._avatar.src = user.user_metadata?.avatar_url || '';
      this._name.textContent = user.user_metadata?.user_name || user.email || '';
    } else {
      this._wrap.style.display = 'none';
    }
  }

  /** @param {function(): void} fn  Called after the menu closes on "Sign out" click. */
  setSignOutHandler(fn) { this._onSignOut = fn; }
}
