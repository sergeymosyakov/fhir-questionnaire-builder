// ── LanguageMenu ──────────────────────────────────────────────────────────────
// Dropdown in the preview toolbar that switches the questionnaire display
// language. Shows only when the loaded questionnaire has at least one translation.
//
// Default state: button shows "🌐 Original ▾" and is the only menu item.
// When translations are added/loaded: button shows current language label,
// menu lists Original + every translated language.
//
// data-testid: lang-menu-btn, lang-menu-item-{code} (code = '' for original)
// ─────────────────────────────────────────────────────────────────────────────
import { AppEvents } from '../../events.js';
import { DropdownMenu } from '../dropdown-menu.js';

export class LanguageMenu extends DropdownMenu {
  constructor() {
    super({
      btnId:    'langMenuBtn',
      menuId:   'langMenu',
      label:    '🌐 Original &#x25BE;',
      btnClass: 'btn-fhir',
      testid:   'lang-menu-btn',
    });

    this._activeLang = '';
    // Hidden until translations exist
    this._wrap.style.display = 'none';

    this._menu.className = 'load-menu load-menu--right';

    // Rebuild menu when language changes (reflects active state)
    document.addEventListener(AppEvents.LANGUAGE_CHANGED, e => {
      this._activeLang = e.detail?.lang ?? '';
      this._syncButton();
    });
  }

  /**
   * Rebuild the menu items.
   * @param {object|null} translations  — questDoc.translations ({ [lang]: {...} })
   *                                      or null to clear
   */
  rebuild(translations) {
    this._menu.innerHTML = '';
    this._activeLang = '';
    this._syncButton();

    const langs = Object.keys(translations || {});
    if (!langs.length) {
      if (this._wrap) this._wrap.style.display = 'none';
      return;
    }

    if (this._wrap) this._wrap.style.display = '';

    // "Original" — always first
    this._addItem('', 'Original', 'lang-menu-item-original');

    // One item per translated language
    const { SUPPORTED_LANGUAGES } = window._translationModule || {};
    for (const lang of langs) {
      const label = SUPPORTED_LANGUAGES?.get(lang) || lang;
      this._addItem(lang, label, `lang-menu-item-${lang}`);
    }

    this._syncChecked();
  }

  _addItem(lang, label, testid) {
    const item = this._item(testid, label, testid);
    item.classList.add('load-menu-item--checkable');
    item.dataset.lang = lang;
    item.addEventListener('click', () => {
      this.close();
      document.dispatchEvent(new CustomEvent(AppEvents.LANGUAGE_CHANGED, { detail: { lang } }));
    });
    this._menu.appendChild(item);
  }

  _syncButton() {
    if (!this._btn) return;
    const { SUPPORTED_LANGUAGES } = window._translationModule || {};
    const label = this._activeLang
      ? (SUPPORTED_LANGUAGES?.get(this._activeLang) || this._activeLang)
      : 'Original';
    this._btn.innerHTML = `🌐 ${label} &#x25BE;`;
    this._syncChecked();
  }

  _syncChecked() {
    this._menu.querySelectorAll('[data-lang]').forEach(item => {
      item.classList.toggle('load-menu-item--checked', item.dataset.lang === this._activeLang);
    });
  }
}

export const languageMenu = new LanguageMenu();
