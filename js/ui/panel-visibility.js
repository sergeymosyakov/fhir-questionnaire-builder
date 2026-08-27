// ── Narrow-screen panel visibility toggle (builder ↔ preview) ─────────────────
// Below the 768px layout breakpoint, shows either the builder (left) or the
// preview (right) full-screen via a single class toggle — mirrors SimpleMode's
// event → class → CSS pattern (js/ui/simple-mode.js). Both panels stay mounted
// and live throughout; no persistence yet (issue #75 Phase 3). No-op at ≥768px.
import { AppEvents } from '../events.js';

export class PanelVisibility {
  constructor() {
    this._layout = document.querySelector('.layout');
    this._btn = document.querySelector('[data-mount="panel-toggle-btn"]');
    document.addEventListener(AppEvents.PANEL_VISIBILITY_CHANGE, e => this._apply(!!e.detail?.leftExpanded));
    this._btn?.addEventListener('click', () => {
      const next = !this._layout?.classList.contains('layout--left-expanded');
      document.dispatchEvent(new CustomEvent(AppEvents.PANEL_VISIBILITY_CHANGE, { detail: { leftExpanded: next } }));
    });
    this._apply(false);
  }

  _apply(leftExpanded) {
    this._layout?.classList.toggle('layout--left-expanded', leftExpanded);
    if (this._btn) this._btn.textContent = leftExpanded ? '\u{1F441}\uFE0F Preview' : '\u2699\uFE0F Builder';
  }
}
