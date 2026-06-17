// FileNameDisplay — renders and manages the loaded-file name chip in the preview header.
// Mounts its own DOM into the provided container element.
// Reacts to events:
//   questionnaire-loaded  { detail: { fileName } } → show name
//   questionnaire-new                               → show 'New Questionnaire'
//   questionnaire-cleared                           → hide
// × button dispatches: questionnaire-clear-requested

import { AppEvents } from '../events.js';

export class FileNameDisplay {
  /** @param {HTMLElement} mountEl – element to append the chip into */
  constructor(mountEl) {
    // ── Build DOM ──────────────────────────────────────────────────────────
    this._wrap = document.createElement('span');
    this._wrap.className = 'loaded-file-name-wrap';
    this._wrap.style.display = 'none';

    this._nameEl = document.createElement('span');
    this._nameEl.className = 'loaded-file-name';

    this._btn = document.createElement('button');
    this._btn.type = 'button';
    this._btn.className = 'clear-form-btn';
    this._btn.dataset.testid = 'clear-form-btn';
    this._btn.dataset.tipTitle = 'Clear questionnaire';
    this._btn.dataset.tipBody = 'Removes the current questionnaire from the builder. You will be asked whether to export first.';
    this._btn.textContent = '\u00d7';

    this._wrap.append(this._nameEl, this._btn);
    mountEl.appendChild(this._wrap);

    // ── Events ─────────────────────────────────────────────────────────────
    this._btn.addEventListener('click', () =>
      document.dispatchEvent(new CustomEvent(AppEvents.QUESTIONNAIRE_CLEAR_REQUESTED))
    );

    document.addEventListener(AppEvents.QUESTIONNAIRE_LOADED,  e => this._show(e.detail?.fileName));
    document.addEventListener(AppEvents.QUESTIONNAIRE_NEW,     () => this._show('New Questionnaire'));
    document.addEventListener(AppEvents.QUESTIONNAIRE_CLEARED, () => this._hide());
  }

  // ── Private ───────────────────────────────────────────────────────────────
  _show(name) {
    this._nameEl.textContent  = name || '';
    this._wrap.style.display  = 'inline-flex';
    document.dispatchEvent(new CustomEvent(AppEvents.FILE_NAME_CHANGED, { detail: { name: name || '' } }));
  }

  _hide() {
    this._nameEl.textContent = '';
    this._wrap.style.display = 'none';
    document.dispatchEvent(new CustomEvent(AppEvents.FILE_NAME_CHANGED, { detail: { name: '' } }));
  }

  // ── Public API ────────────────────────────────────────────────────────────
  /** Returns the currently displayed file name. */
  getName() {
    return this._nameEl.textContent;
  }

  /** Imperatively update the displayed name (e.g. after a Save-As rename). */
  setName(name) {
    this._nameEl.textContent = name || '';
    document.dispatchEvent(new CustomEvent(AppEvents.FILE_NAME_CHANGED, { detail: { name: name || '' } }));
  }
}
