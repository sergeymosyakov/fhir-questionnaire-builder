// ── Simple / Advanced builder view mode ───────────────────────────────────────
// Toggles the `builder--simple` class on the left panel, which hides advanced
// (modal-opening) node action links via CSS while keeping the Add ▾ menu, the
// delete button and the tree structure visible. The choice persists in
// localStorage. Default mode: advanced (all controls visible).
//
// State flow (event-driven, single source of truth):
//   - MoreMenu (or any control) dispatches BUILDER_VIEW_MODE_CHANGE { mode }.
//   - This class applies the class + persists.
//   - On construction it re-dispatches the saved/default mode so the menu can
//     reflect the current state (also cached by EventState for late listeners).
import { AppEvents } from '../events.js';

const STORAGE_KEY  = 'builderViewMode';
const DEFAULT_MODE = 'advanced';

export class SimpleMode {
  constructor() {
    this._root = document.querySelector('[data-mount="left-panel"]');
    document.addEventListener(AppEvents.BUILDER_VIEW_MODE_CHANGE, e => this._apply(e.detail?.mode));

    let saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* storage unavailable */ }
    const mode = saved === 'advanced' || saved === 'simple' ? saved : DEFAULT_MODE;
    document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_VIEW_MODE_CHANGE, { detail: { mode } }));
  }

  _apply(mode) {
    if (mode !== 'simple' && mode !== 'advanced') return;
    this._root?.classList.toggle('builder--simple', mode === 'simple');
    try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* storage unavailable */ }
  }
}
