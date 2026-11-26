// Form Check page: asks what to do first (check a form / compare with a saved reference); the matching inputs appear after the choice.
// data-testid registry: check-mode (data-compact), check-mode-check, check-mode-compare
import { AppEvents } from '../events.js';
import { el } from './el.js';

const MODES = [
  { id: 'check', title: 'Check a questionnaire', hint: 'Find calculation results nobody can get, and questions that are never shown.' },
  { id: 'compare', title: 'Compare with a saved reference', hint: 'Find out whether an edit changed what the form calculates.' },
];

export class CheckModeSwitch {
  constructor() {
    this.mount = document.querySelector('[data-mount="check-mode"]');
    if (!this.mount) return;
    this.box = el('div', 'check-mode', null, 'check-mode');
    this.box.setAttribute('role', 'group');
    this.box.setAttribute('aria-label', 'What do you want to do?');
    this.tabs = new Map(MODES.map((m) => {
      const tab = el('button', 'check-mode-tab', null, `check-mode-${m.id}`);
      tab.type = 'button';
      tab.setAttribute('aria-pressed', 'false');
      tab.append(el('strong', null, m.title), el('span', 'check-mode-hint', m.hint));
      tab.addEventListener('click', () => this._choose(m.id));
      this.box.append(tab);
      return [m.id, tab];
    }));
    this.mount.append(this.box);
    document.addEventListener(AppEvents.CHECK_REPORT_SHOWN, () => this._done());
    document.addEventListener(AppEvents.CHECK_RESET, () => { this._select(null); delete this.box.dataset.compact; });
  }

  _select(mode) {
    for (const [id, tab] of this.tabs) tab.setAttribute('aria-pressed', String(id === mode));
  }

  _choose(mode) {
    this._select(mode);
    document.dispatchEvent(new CustomEvent(AppEvents.CHECK_MODE_CHANGED, { detail: { mode } }));
  }

  // A report is showing: the choice shrinks to a tab strip above it, the way back to the inputs. Nothing is pressed: the inputs are closed.
  _done() {
    this._select(null);
    this.box.dataset.compact = 'true';
  }
}
