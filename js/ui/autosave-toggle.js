// ── Autosave toggle button ────────────────────────────────────────────────────
// Wraps the autosave toggle button: wires click, reflects enabled state and
// last-save time in the button label, and initialises the autosave module.
import * as autosave from './autosave.js';
import { buildFHIRObject } from '../fhir/export.js';

export class AutosaveToggle {
  static _svc = { questDoc: null };

  static configure({ questDoc }) {
    AutosaveToggle._svc.questDoc = questDoc;
  }

  /** @param {HTMLElement} btnEl */
  constructor(btnEl) {
    this._btn = btnEl;
    this._bind();
    autosave.init({
      buildFn:  buildFHIRObject,
      questMeta: AutosaveToggle._svc.questDoc.meta,
      onSaved:  date => this._sync(autosave.isEnabled(), date),
    }).then(() => this._sync(autosave.isEnabled(), null));
  }

  _bind() {
    this._btn.addEventListener('click', () => {
      const next = !autosave.isEnabled();
      autosave.setEnabled(next);
      this._sync(next, null);
    });
  }

  _sync(enabled, lastSaveDate) {
    this._btn.classList.toggle('btn-fhir--active', enabled);
    if (enabled) {
      const label = lastSaveDate
        ? 'autosave \u00b7 '
          + String(lastSaveDate.getHours()).padStart(2, '0') + ':'
          + String(lastSaveDate.getMinutes()).padStart(2, '0')
        : 'autosave';
      this._btn.textContent = label;
    } else {
      this._btn.textContent = 'autosave off';
    }
  }
}
