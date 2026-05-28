// ── Panel resize drag ─────────────────────────────────────────────────────────
// Manages the horizontal drag handle between left and right panels.
// Persists the panel width to storage across sessions.
import * as storage from '../storage/storage.js';

export class PanelResizer {
  /**
   * @param {object} opts
   * @param {HTMLElement} opts.resizer   — the drag handle element
   * @param {HTMLElement} opts.panel     — the panel whose width is controlled
   * @param {string}      opts.storageKey
   * @param {number}      [opts.min]    — minimum panel width in px (default 200)
   * @param {function}    [opts.max]    — returns max width in px (default 70vw)
   */
  constructor({ resizer, panel, storageKey, min = 200, max = () => window.innerWidth * 0.7 }) {
    this._resizer    = resizer;
    this._panel      = panel;
    this._storageKey = storageKey;
    this._min        = min;
    this._max        = max;
    this._bind();
  }

  /** Restore saved width from storage. Returns `this` for chaining. */
  async init() {
    let saved;
    try { saved = await storage.getItem(this._storageKey); } catch { /* private mode / quota */ }
    if (saved) this._panel.style.width = saved + 'px';
    return this;
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
        try { storage.setItem(this._storageKey, parseInt(this._panel.style.width)); } catch { /* ignore */ }
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }
}
