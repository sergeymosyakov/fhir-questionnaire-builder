// ── Tooltip toggle button ─────────────────────────────────────────────────────
// Wraps the tooltip on/off button and the "tooltips off" badge: wires click,
// syncs active state and badge visibility with the tooltip module.
import * as tooltip from './tooltip.js';

export class TooltipToggle {
  /**
   * @param {HTMLElement} btn   — the toggle button
   * @param {HTMLElement} badge — the "tooltips off" badge element
   */
  constructor(btn, badge) {
    this._btn = btn;
    this._badge = badge;

    tooltip.init().then(() => this._sync(tooltip.isEnabled()));

    btn.addEventListener('click', () => {
      const next = !tooltip.isEnabled();
      tooltip.setEnabled(next);
      this._sync(next);
    });
  }

  _sync(enabled) {
    this._btn.classList.toggle('btn-fhir--active', enabled);
    this._badge.style.display = enabled ? 'none' : '';
  }
}
