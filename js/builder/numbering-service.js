// ── NumberingService ──────────────────────────────────────────────────────────
// Owns the current renumber format and exposes formatSeg().
// Listens to AppEvents.RENUMBER_FORMAT_CHANGED — no DI, no setters needed.
// Import the singleton `numberingService` directly wherever formatSeg is needed.
import { AppEvents } from '../events.js';

// ── Pure converters ───────────────────────────────────────────────────────────
function _toRoman(n) {
  const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  const syms = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
  let r = '';
  for (let i = 0; i < vals.length; i++) while (n >= vals[i]) { r += syms[i]; n -= vals[i]; }
  return r;
}

function _toLetter(n) {
  let r = '';
  while (n > 0) { r = String.fromCharCode(64 + ((n - 1) % 26 + 1)) + r; n = Math.floor((n - 1) / 26); }
  return r;
}

class NumberingService {
  #format = 'numbers';

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener(AppEvents.RENUMBER_FORMAT_CHANGED, e => {
        this.#format = e.detail?.format ?? 'numbers';
      });
    }
  }

  /** Format segment index n according to the current renumber format. */
  formatSeg(n) {
    return this.#format === 'roman' ? _toRoman(n)
      : this.#format === 'letters' ? _toLetter(n)
        : String(n);
  }
}

export const numberingService = new NumberingService();
