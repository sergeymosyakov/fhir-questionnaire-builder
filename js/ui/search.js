// ── Preview search ────────────────────────────────────────────────────────────
// Searches visible preview rows (modes 'preview' / 'patient') by text content,
// or the FHIR JSON <pre> (mode 'json') with live syntax-highlighted marks.
//
// PreviewSearch is instantiable per surface (app shell OR embedded widget): pass
// its DOM elements + the session bus. The module also self-inits one app-shell
// instance bound to the shared [data-mount] nodes and re-exports refresh() so
// existing callers (app.js chrome, PreviewForm) keep working unchanged.

import { AppEvents } from '../events.js';
import { defaultBus } from '../core/events/bus.js';
import { highlightJson, highlightJsonWithSearch } from '../utils.js';

export class PreviewSearch {
  /**
   * @param {object}   opts
   * @param {object}   opts.els   { input, prevBtn, nextBtn, counter, lform, fhirJsonView, searchWrap }
   * @param {EventBus} [opts.bus] channel for PREVIEW_MODE_CHANGE (defaults to page bus)
   * @param {string}   [opts.previewMode] initial mode seed
   */
  constructor({ els, bus = defaultBus, previewMode = 'preview' }) {
    this._el          = els;
    this._bus         = bus;
    this._matches     = [];
    this._idx         = -1;
    this._previewMode = previewMode;
    this._ac          = new AbortController();
    this._bus.on(AppEvents.PREVIEW_MODE_CHANGE, e => { this._previewMode = e.detail.mode; }, { signal: this._ac.signal });
    this._wire();
  }

  _wire() {
    const el  = this._el;
    const sig = { signal: this._ac.signal };
    el.input.addEventListener('input', () => this._onInput(), sig);
    el.input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); this._navigate(+1); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); this._navigate(-1); }
      if (e.key === 'Escape')    { el.input.value = ''; this._clear(); }
    }, sig);
    el.nextBtn.addEventListener('click', () => this._navigate(+1), sig);
    el.prevBtn.addEventListener('click', () => this._navigate(-1), sig);

    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        if (el.searchWrap && el.searchWrap.style.display === 'none') return;
        e.preventDefault();
        el.input.focus();
        el.input.select();
      }
    }, sig);
  }

  /** Remove the document-level (Ctrl+F) + bus listeners this search owns. */
  destroy() { this._ac.abort(); }

  // Called by preview-form.js after every re-render so stale references update.
  refresh() {
    if (this._el.input.value.trim()) this._onInput();
  }

  // ── Dispatch by mode ────────────────────────────────────────────────────────
  _onInput() {
    const q = this._el.input.value.trim().toLowerCase();
    this._clearHighlights();

    if (!q) { this._clear(); return; }

    if (this._previewMode === 'json') this._onInputJson(q);
    else this._onInputRows(q);
  }

  // ── Rows mode (preview / patient) ───────────────────────────────────────────
  _onInputRows(q) {
    const rows = [...this._el.lform.querySelectorAll('[data-preview-id]')];
    this._matches = rows.filter(row => row.textContent.toLowerCase().includes(q));

    if (this._matches.length === 0) {
      this._idx = -1;
      this._el.counter.textContent = 'No results';
      this._el.counter.classList.add('search-counter--empty');
      this._el.input.classList.add('search-input--empty');
      return;
    }

    this._el.input.classList.remove('search-input--empty');
    this._el.counter.classList.remove('search-counter--empty');
    this._matches.forEach(m => m.classList.add('search-match'));
    this._idx = 0;
    this._activate();
  }

  // ── JSON mode ───────────────────────────────────────────────────────────────
  _onInputJson(q) {
    // textContent always gives the raw JSON regardless of what innerHTML contains
    const raw = this._el.fhirJsonView.textContent;
    const { html, count } = highlightJsonWithSearch(raw, q);
    this._el.fhirJsonView.innerHTML = html;

    if (count === 0) {
      this._idx = -1;
      this._el.counter.textContent = 'No results';
      this._el.counter.classList.add('search-counter--empty');
      this._el.input.classList.add('search-input--empty');
      return;
    }

    this._el.input.classList.remove('search-input--empty');
    this._el.counter.classList.remove('search-counter--empty');
    this._matches = [...this._el.fhirJsonView.querySelectorAll('mark.search-match')];
    this._idx = 0;
    this._activateJson();
  }

  // ── Navigation ──────────────────────────────────────────────────────────────
  _navigate(dir) {
    if (this._matches.length === 0) return;
    if (this._idx >= 0 && this._idx < this._matches.length) {
      this._matches[this._idx].classList.remove('search-match--active');
    }
    this._idx = (this._idx + dir + this._matches.length) % this._matches.length;
    if (this._previewMode === 'json') this._activateJson();
    else this._activate();
  }

  _activate() {
    const el = this._matches[this._idx];
    el.classList.add('search-match--active');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    this._el.counter.textContent = (this._idx + 1) + ' / ' + this._matches.length;
    this._el.counter.classList.remove('search-counter--empty');
  }

  _activateJson() {
    this._matches.forEach((m, i) => m.classList.toggle('search-match--active', i === this._idx));
    this._matches[this._idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
    this._el.counter.textContent = (this._idx + 1) + ' / ' + this._matches.length;
    this._el.counter.classList.remove('search-counter--empty');
  }

  // ── Clear ───────────────────────────────────────────────────────────────────
  _clearHighlights() {
    if (this._previewMode === 'json' && this._el.fhirJsonView.querySelector('mark.search-match')) {
      // Re-render without marks; textContent gives raw JSON before re-render
      const raw = this._el.fhirJsonView.textContent;
      this._el.fhirJsonView.innerHTML = highlightJson(raw);
    } else {
      this._matches.forEach(m => {
        m.classList.remove('search-match');
        m.classList.remove('search-match--active');
      });
    }
    this._matches = [];
    this._idx = -1;
  }

  _clear() {
    this._clearHighlights();
    this._el.counter.textContent = '';
    this._el.counter.classList.remove('search-counter--empty');
    this._el.input.classList.remove('search-input--empty');
  }
}

// ── App-shell singleton ─────────────────────────────────────────────────────────
let _appInstance = null;

export function init() {
  const els = {
    input:        document.querySelector('[data-mount="search-input"]'),
    prevBtn:      document.querySelector('[data-mount="search-prev-btn"]'),
    nextBtn:      document.querySelector('[data-mount="search-next-btn"]'),
    counter:      document.querySelector('[data-mount="search-counter"]'),
    lform:        document.querySelector('[data-mount="preview-lform"]'),
    fhirJsonView: document.querySelector('[data-mount="fhir-json-view"]'),
    searchWrap:   document.querySelector('[data-mount="search-wrap"]'),
  };
  if (!els.input) return; // no app-shell search DOM (e.g. widget-only page)
  _appInstance = new PreviewSearch({ els, bus: defaultBus });
}

export function refresh() {
  _appInstance?.refresh();
}

// Self-initialize the app-shell instance on import.
if (typeof document !== 'undefined') init();
