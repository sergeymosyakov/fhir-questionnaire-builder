// ── Narrow-screen panel visibility toggle (builder ↔ preview) ─────────────────
// Below the 768px layout breakpoint, the builder collapses to a narrow rail by
// default (preview full-screen); expanding shows the builder full-screen and
// hides the preview instead. Mirrors SimpleMode's event → class → CSS pattern
// (js/ui/simple-mode.js). Both panels stay mounted and live throughout; no
// persistence yet (issue #75 Phase 3). No-op at ≥768px.
import { AppEvents } from '../events.js';

export class PanelVisibility {
  constructor() {
    this._layout = document.querySelector('.layout');
    this._btn = document.querySelector('[data-mount="panel-toggle-btn"]');
    this._railTab = document.querySelector('[data-mount="left-panel-rail-tab"]');
    this._minimizeBtn = document.querySelector('[data-mount="left-panel-minimize-btn"]');
    document.addEventListener(AppEvents.PANEL_VISIBILITY_CHANGE, e => this._apply(!!e.detail?.leftExpanded));
    this._btn?.addEventListener('click', () => {
      this._dispatch(!this._layout?.classList.contains('layout--left-expanded'));
    });
    this._railTab?.addEventListener('click', () => this._dispatch(true));
    this._minimizeBtn?.addEventListener('click', () => this._dispatch(false));
    this._apply(false);
  }

  _dispatch(leftExpanded) {
    document.dispatchEvent(new CustomEvent(AppEvents.PANEL_VISIBILITY_CHANGE, { detail: { leftExpanded } }));
  }

  _apply(leftExpanded) {
    this._layout?.classList.toggle('layout--left-expanded', leftExpanded);
    if (this._btn) this._btn.textContent = leftExpanded ? '\u{1F441}\uFE0F Preview' : '\u2699\uFE0F Builder';
  }
}

