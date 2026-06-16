// ── Renumber control ──────────────────────────────────────────────────────────
// Wraps the renumber format dropdown and the Renumber button: wires click,
// shows progress, listens to RENUMBER_PROGRESS / RENUMBER_DONE events.
import { createCustomSelect } from './custom-select.js';
import * as progress from './progress.js';
import { AppEvents } from '../events.js';

export class RenumberControl {
  /**
   * @param {HTMLElement} formatWrap  — container for the format dropdown
   * @param {HTMLElement} btn         — the Renumber button
   * @param {object} deps
   * @param {Function} deps.renumberAll  — async renumber action
   */
  constructor(formatWrap, btn, { renumberAll }) {
    this._btn = btn;

    const sel = createCustomSelect({
      items: [
        { value: 'numbers', label: '1 · 2 · 3' },
        { value: 'roman',   label: 'I · II · III' },
        { value: 'letters', label: 'A · B · C' },
      ],
      value: 'numbers',
      className: 'sc-trigger--sm',
      testid: 'renumber-format',
      onChange: v => {
        document.dispatchEvent(new CustomEvent(AppEvents.RENUMBER_FORMAT_CHANGED,
          { detail: { format: v || 'numbers' } }));
      },
    });
    sel.el.dataset.tipTitle = 'Prefix format';
    sel.el.dataset.tipBody  = 'Format used by Renumber: numeric (1, 1.1), Roman numerals (I, I.I), or letters (A, A.A). Does not affect linkId — only item.prefix.';
    sel.el.dataset.tipFhir  = 'Questionnaire.item.prefix';
    sel.el.dataset.tipSpec  = 'R4 · optional';
    formatWrap.appendChild(sel.el);

    btn.onclick = async () => {
      btn.disabled = true;
      progress.show('Renumbering…');
      const onProgress = e => progress.update(e.detail.done, e.detail.total);
      const cleanup = () => {
        progress.hide();
        btn.disabled = false;
        document.removeEventListener(AppEvents.RENUMBER_PROGRESS, onProgress);
        document.removeEventListener(AppEvents.RENUMBER_DONE, cleanup);
      };
      document.addEventListener(AppEvents.RENUMBER_PROGRESS, onProgress);
      document.addEventListener(AppEvents.RENUMBER_DONE, cleanup);
      try { await renumberAll(); } catch { cleanup(); }
    };
  }
}
