// ── Panel resize drag ─────────────────────────────────────────────────────────
// Manages the horizontal drag handle between left and right panels.
// Persists the panel width to storage across sessions.
import * as storage from '../storage/storage.js';

const DESKTOP_MIN_WIDTH = 1024; // must match css/layout.css breakpoint

export class PanelResizer {
  /**
   * @param {object} opts
   * @param {string}   opts.storageKey
   * @param {number}   [opts.min]    — minimum panel width in px (default 200)
   * @param {function} [opts.max]    — returns max width in px (default 70vw)
   */
  constructor({ storageKey, min = 200, max = () => window.innerWidth * 0.7 }) {
    this._resizer    = document.querySelector('[data-mount="panel-resizer"]');
    this._panel      = document.querySelector('[data-mount="left-panel"]');
    this._storageKey = storageKey;
    this._min        = min;
    this._max        = max;
    this._savedWidth = null;
    this._bind();
    this._restoreWidth(); // async, fire-and-forget
    window.addEventListener('resize', () => this._applyForViewport());
  }

  /** Restore saved width from storage. */
  async _restoreWidth() {
    let saved;
    try { saved = await storage.getItem(this._storageKey); } catch { /* private mode / quota */ }
    this._savedWidth = saved || null;
    this._applyForViewport();
  }

  // Custom drag width is desktop-only — below the breakpoint the panel must
  // follow the responsive rail/expanded CSS, never a stale inline width.
  _applyForViewport() {
    if (window.innerWidth >= DESKTOP_MIN_WIDTH && this._savedWidth) {
      this._panel.style.width = this._savedWidth + 'px';
    } else {
      this._panel.style.width = '';
    }
  }

  _bind() {
    this._resizer.addEventListener('mousedown', e => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = this._panel.getBoundingClientRect().width;
      this._resizer.classList.add('resizing');

      // Overlay captures pointer events and prevents text selection during drag
      const overlay = document.createElement('div');
      overlay.id = 'resize-overlay';
      overlay.className = 'resize-overlay';
      document.body.appendChild(overlay);

      const onMove = ev => {
        const w = Math.min(this._max(), Math.max(this._min, startW + ev.clientX - startX));
        this._panel.style.width = w + 'px';
      };
      const onUp = () => {
        this._resizer.classList.remove('resizing');
        overlay.remove();
        this._savedWidth = parseInt(this._panel.style.width);
        try { storage.setItem(this._storageKey, this._savedWidth); } catch { /* ignore */ }
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }
}
