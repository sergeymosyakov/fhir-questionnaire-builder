// ── LOINC / SNOMED term search widget ────────────────────────────────────────
// Self-contained class that mounts into any container element.
//
// Usage:
//   const w = new TermSearch(containerEl, { onSelect });
//   // onSelect({ system, code, display }) called on user pick
//   // w.destroy() to remove from DOM
//
// On first use, shows a Terms of Use acceptance banner (LOINC ToU requirement).
// Acceptance is stored in localStorage so it only shows once per browser.

import { createCustomSelect } from './custom-select.js';

const LOINC_TOU_KEY  = 'loinc-tou-accepted';
const LOINC_SYSTEM   = 'http://loinc.org';
const SNOMED_SYSTEM  = 'http://snomed.info/sct';

const SYSTEM_DEFS = {
  loinc: {
    label:  'LOINC',
    system: LOINC_SYSTEM,
    url: q =>
      `https://clinicaltables.nlm.nih.gov/api/loinc_items/v3/search` +
      `?type=question&terms=${encodeURIComponent(q)}&df=text,LOINC_NUM` +
      `&sf=text,CONSUMER_NAME,RELATEDNAMES2,SHORTNAME&maxList=10`,
    parse: ([, codes,, displays]) =>
      (codes || []).map((code, i) => ({
        code,
        display: displays?.[i]?.[0] ?? code,
        system:  LOINC_SYSTEM,
      })),
  },
  snomed: {
    label:  'SNOMED CT',
    system: SNOMED_SYSTEM,
    url: q =>
      `https://clinicaltables.nlm.nih.gov/api/snomed_codes/v3/search` +
      `?terms=${encodeURIComponent(q)}&df=text&maxList=10`,
    parse: ([, codes,, displays]) =>
      (codes || []).map((code, i) => ({
        code,
        display: displays?.[i]?.[0] ?? code,
        system:  SNOMED_SYSTEM,
      })),
  },
};

export class TermSearch {
  /**
   * @param {HTMLElement} container - parent element; this widget appends to it
   * @param {{ onSelect: function({ system: string, code: string, display: string }): void, testid?: string }} opts
   */
  constructor(container, { onSelect, testid = 'term-search' } = {}) {
    this._onSelect  = onSelect;
    this._debounce  = null;
    this._results   = [];
    this._system    = 'loinc';
    this._resultBox = null;
    this._abortCtrl = null;

    this.el = document.createElement('div');
    this.el.className = 'ts-wrap';
    this.el.dataset.testid = testid;

    if (localStorage.getItem(LOINC_TOU_KEY)) {
      this._renderSearch();
    } else {
      this._renderTou();
    }

    container.appendChild(this.el);
  }

  destroy() {
    clearTimeout(this._debounce);
    this._abortCtrl?.abort();
    this.el.remove();
  }

  // ── Terms of Use acceptance ───────────────────────────────────────────────

  _renderTou() {
    const wrap = document.createElement('div');
    wrap.className = 'ts-tou';

    const p = document.createElement('p');
    p.className = 'ts-tou-text';
    p.appendChild(document.createTextNode(
      'LOINC and SNOMED CT search uses the free '
    ));
    const apiLink = document.createElement('a');
    apiLink.href   = 'https://clinicaltables.nlm.nih.gov/';
    apiLink.target = '_blank';
    apiLink.rel    = 'noopener noreferrer';
    apiLink.textContent = 'NLM Clinical Tables API';
    p.appendChild(apiLink);
    p.appendChild(document.createTextNode(
      '. By proceeding you agree to the '
    ));
    const touLink = document.createElement('a');
    touLink.href   = 'https://loinc.org/license/';
    touLink.target = '_blank';
    touLink.rel    = 'noopener noreferrer';
    touLink.textContent = 'LOINC Terms of Use';
    p.appendChild(touLink);
    p.appendChild(document.createTextNode('.'));

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'modal-btn modal-btn--apply ts-tou-accept';
    btn.textContent = 'Accept & enable search';
    btn.dataset.testid = 'term-search-tou-accept';
    btn.addEventListener('click', () => {
      localStorage.setItem(LOINC_TOU_KEY, '1');
      this.el.innerHTML = '';
      this._renderSearch();
    });

    wrap.append(p, btn);
    this.el.appendChild(wrap);
  }

  // ── Search UI ─────────────────────────────────────────────────────────────

  _renderSearch() {
    const row = document.createElement('div');
    row.className = 'ts-search-row';

    // System selector — custom select (no native <select> per project rules)
    const sysSel = createCustomSelect({
      items:    Object.entries(SYSTEM_DEFS).map(([v, { label }]) => ({ value: v, label })),
      value:    this._system,
      className: 'sc-trigger--sm ts-sys-sel',
      testid:   'term-search-system',
      onChange: v => {
        this._system = v;
        this._clearResults();
        const q = inp.value.trim();
        if (q.length >= 2) this._doSearch(q);
      },
    });
    this._sysSel = sysSel;

    // Search input
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'ts-inp';
    inp.placeholder = 'Type to search\u2026';
    inp.dataset.testid = 'term-search-input';
    inp.setAttribute('autocomplete', 'off');
    inp.setAttribute('spellcheck', 'false');
    inp.addEventListener('input', () => {
      clearTimeout(this._debounce);
      const q = inp.value.trim();
      if (q.length < 2) { this._clearResults(); return; }
      this._debounce = setTimeout(() => this._doSearch(q), 350);
    });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Escape') { this._clearResults(); inp.value = ''; }
    });

    row.append(sysSel.el, inp);

    this._resultBox = document.createElement('div');
    this._resultBox.className = 'ts-results';
    this._resultBox.dataset.testid = 'term-search-results';

    this.el.append(row, this._resultBox);
  }

  // ── Network ───────────────────────────────────────────────────────────────

  async _doSearch(terms) {
    const def = SYSTEM_DEFS[this._system];
    if (!def) return;

    this._abortCtrl?.abort();
    this._abortCtrl = new AbortController();
    this._setLoading(true);

    try {
      const res = await fetch(def.url(terms), { signal: this._abortCtrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this._results = def.parse(data);
      this._renderResults();
    } catch (err) {
      if (err.name === 'AbortError') return;
      this._showStatus('error', 'Search failed. Check your connection.');
    } finally {
      this._setLoading(false);
    }
  }

  // ── Results ───────────────────────────────────────────────────────────────

  _renderResults() {
    const box = this._resultBox;
    if (!box) return;
    box.innerHTML = '';

    if (!this._results.length) {
      const msg = document.createElement('div');
      msg.className = 'ts-no-results';
      msg.textContent = 'No results found.';
      box.appendChild(msg);
      return;
    }

    this._results.forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ts-result-row';
      btn.dataset.testid = 'term-search-result';

      const codeSpan = document.createElement('span');
      codeSpan.className = 'ts-result-code';
      codeSpan.textContent = item.code;          // safe — textContent, not innerHTML

      const displaySpan = document.createElement('span');
      displaySpan.className = 'ts-result-display';
      displaySpan.textContent = item.display;    // safe — textContent, not innerHTML

      btn.append(codeSpan, displaySpan);
      btn.addEventListener('click', () => {
        this._onSelect?.(item);
        this._clearResults();
        const inp = this.el.querySelector('[data-testid="term-search-input"]');
        if (inp) inp.value = '';
      });

      box.appendChild(btn);
    });
  }

  _clearResults() {
    this._results = [];
    if (this._resultBox) this._resultBox.innerHTML = '';
  }

  _setLoading(on) {
    this.el.classList.toggle('ts-loading', on);
    if (on) this._clearResults();
  }

  _showStatus(type, msg) {
    if (!this._resultBox) return;
    this._resultBox.innerHTML = '';
    const el = document.createElement('div');
    el.className = type === 'error' ? 'ts-error' : 'ts-no-results';
    el.textContent = msg;
    this._resultBox.appendChild(el);
  }
}
