// ── Builder meta-row (id/prefix) visibility toggle ───────────────────────────
// Toggles the `builder--hide-props` class on the left panel, which hides the
// id/prefix row on every builder node via CSS. The choice persists in
// localStorage. Default: visible (shown).
//
// State flow (event-driven, single source of truth):
//   - gear menu item dispatches BUILDER_META_ROW_CHANGE { visible }.
//   - This class applies the class + persists.
//   - On construction it re-dispatches the saved/default state so the gear menu
//     items can reflect the current state via EventState.
import { AppEvents } from '../events.js';

const STORAGE_KEY   = 'builderShowProps';
const DEFAULT_STATE = true; // show by default

export class BuilderMetaToggle {
  constructor() {
    this._root = document.querySelector('[data-mount="left-panel"]');
    document.addEventListener(AppEvents.BUILDER_META_ROW_CHANGE, e => this._apply(e.detail?.visible ?? DEFAULT_STATE));

    let saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* storage unavailable */ }
    // parse: 'true' → true, 'false' → false, null → default
    const visible = saved === 'false' ? false : DEFAULT_STATE;
    document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_META_ROW_CHANGE, { detail: { visible } }));
  }

  _apply(visible) {
    this._root?.classList.toggle('builder--hide-props', !visible);
    try { localStorage.setItem(STORAGE_KEY, String(visible)); } catch { /* storage unavailable */ }
  }
}
