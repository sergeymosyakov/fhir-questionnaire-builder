// ── Narrow-screen panel visibility toggle (builder ↔ preview) ─────────────────
// Below the 1024px layout breakpoint, exactly one panel is expanded at a time;
// the other collapses to a narrow rail tab. Default: left (builder) = rail,
// right (preview) = full. Each side's rail-tab is the only control — tapping
// the visible (collapsed) side's rail expands it and collapses the other.
// Mirrors SimpleMode's event → class → CSS → localStorage pattern
// (js/ui/simple-mode.js). Both panels stay mounted and live throughout.
// No-op at ≥1024px.
import { AppEvents } from '../events.js';

const STORAGE_KEY    = 'panelLeftExpanded';
const DEFAULT_VALUE  = false; // left collapsed to rail, right (preview) full

export class PanelVisibility {
  constructor() {
    this._layout = document.querySelector('.layout');
    this._leftRailTab = document.querySelector('[data-mount="left-panel-rail-tab"]');
    this._rightRailTab = document.querySelector('[data-mount="right-panel-rail-tab"]');
    document.addEventListener(AppEvents.PANEL_VISIBILITY_CHANGE, e => this._apply(!!e.detail?.leftExpanded));
    this._leftRailTab?.addEventListener('click', () => this._dispatch(true));
    this._rightRailTab?.addEventListener('click', () => this._dispatch(false));

    let saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* storage unavailable */ }
    const leftExpanded = saved === 'true' || saved === 'false' ? saved === 'true' : DEFAULT_VALUE;
    this._dispatch(leftExpanded);
  }

  _dispatch(leftExpanded) {
    document.dispatchEvent(new CustomEvent(AppEvents.PANEL_VISIBILITY_CHANGE, { detail: { leftExpanded } }));
  }

  _apply(leftExpanded) {
    this._layout?.classList.toggle('layout--left-expanded', leftExpanded);
    try { localStorage.setItem(STORAGE_KEY, String(leftExpanded)); } catch { /* storage unavailable */ }
  }
}

