// ── Renderer widget public entry ──────────────────────────────────────────────
// Embeddable FHIR Questionnaire renderer (the "right side" of the builder).
// Composes a Core session (own bus + questDoc + answerStore) with a headless,
// widget-mode PreviewForm (no shell chrome). Everything the host needs to affect
// display is passed via config / the public API; nothing is read from globals.
import { createSession } from '../core/session.js';
import { createRenderCtx } from '../preview/render-ctx.js';
import { importFHIR } from '../fhir/import.js';
import { importQRAnswers } from '../fhir/qr-import.js';
import { buildQR } from '../fhir/qr-builder.js';
import { AppEvents } from '../events.js';
import { PreviewForm } from '../preview-form.js';
import { PreviewSearch } from '../ui/search.js';
import { StatusBadge } from '../ui/status-badge.js';

// Headless chrome — the widget renders no toolbar/menus; the host owns UI.
const NOOP_CHROME = {
  search:      { refresh() {} },
  statusBadge: { update() {} },
  languageMenu:{ rebuild() {} },
};

// Tiny per-instance event emitter (scoped — NOT the global document bus).
class Emitter {
  constructor() { this._map = new Map(); }
  on(type, cb)  { (this._map.get(type) ?? this._map.set(type, new Set()).get(type)).add(cb); return this; }
  off(type, cb) { this._map.get(type)?.delete(cb); return this; }
  emit(type, detail) { for (const cb of this._map.get(type) ?? []) cb(detail); }
}

/**
 * Embeddable questionnaire renderer.
 *
 * @param {HTMLElement} mountEl
 * @param {{ questionnaire?: object, response?: object, config?: object }} [opts]
 *   config: { language?, previewMode?, viewPrefs?, onProgress? }
 */
export class QuestionnaireRenderer {
  constructor(mountEl, { questionnaire = null, response = null, config = {} } = {}) {
    this.mountEl  = mountEl;
    this._config  = config;
    this._emitter = new Emitter();
    this._session = createSession(config);
    const bus = this._session.bus;

    // Progress is host-owned: forward to config.onProgress, else no-op.
    const progress = config.onProgress
      ? { show: m => config.onProgress(m), hide: () => config.onProgress(null) }
      : { show() {}, hide() {} };

    // Build the widget's own render surface inside the host mount: an optional
    // toolbar (search + validation badge, opt-in via config), an lform + a JSON
    // view, so every preview mode (patient / preview / json) works headless.
    mountEl.innerHTML = '';
    this._lformEl = document.createElement('div');
    this._lformEl.className = 'preview-card';
    this._jsonEl = document.createElement('pre');
    this._jsonEl.className = 'fhir-json-view';
    this._jsonEl.style.display = 'none';

    const chrome = this._buildChrome(config, bus);
    mountEl.append(this._lformEl, this._jsonEl);

    // Widget defaults: no go-to-builder arrow (there is no builder); Explain off
    // (needs app-shell modal infra). Both opt-in via config for host control.
    const rc = createRenderCtx();
    rc.showNavBtn  = !!config.navButton;
    rc.showExplain = !!config.explain;

    this._renderer = new PreviewForm({
      session:     this._session,
      rc,
      chrome,
      progress,
      mountEl:     this._lformEl,
      jsonEl:      this._jsonEl,
      previewMode: config.previewMode,
      viewPrefs:   config.viewPrefs,
    });

    // Surface host events off the session bus.
    this._offs = [
      bus.on(AppEvents.RESPONSE_CHANGED, () => this._emitter.emit('response-changed', this.getResponse())),
      bus.on(AppEvents.PREVIEW_RENDER_DONE, () => this._emitter.emit('render')),
      bus.on(AppEvents.LANGUAGE_CHANGED, e => this._emitter.emit('language-changed', e.detail?.lang ?? '')),
    ];

    this._renderer.mount();
    if (questionnaire) this._loadQuestionnaire(questionnaire);
    if (response) this.setResponse(response);
    if (config.language) this.setLanguage(config.language);
    Promise.resolve().then(() => this._emitter.emit('ready'));
  }

  _loadQuestionnaire(questionnaire) {
    importFHIR(questionnaire, { questDoc: this._session.questDoc, bus: this._session.bus });
  }

  // Opt-in preview chrome (config.search / config.validation). Builds the toolbar
  // DOM inside the host mount and wires per-instance PreviewSearch / StatusBadge
  // against this widget's own session bus + answer store.
  _buildChrome(config, bus) {
    const wantSearch     = !!config.search;
    const wantValidation = !!config.validation;
    if (!wantSearch && !wantValidation) return NOOP_CHROME;

    const toolbar = document.createElement('div');
    toolbar.className = 'fhir-toolbar';

    let search = NOOP_CHROME.search;
    if (wantSearch) {
      const searchWrap = document.createElement('div');
      searchWrap.className = 'search-wrap';
      const input = document.createElement('input');
      input.type = 'search';
      input.className = 'search-input';
      input.placeholder = '\uD83D\uDD0D Search\u2026';
      input.autocomplete = 'off';
      input.setAttribute('data-testid', 'preview-search-input');
      const prevBtn = document.createElement('button');
      prevBtn.type = 'button'; prevBtn.className = 'search-nav-btn'; prevBtn.textContent = '\u2191';
      const nextBtn = document.createElement('button');
      nextBtn.type = 'button'; nextBtn.className = 'search-nav-btn'; nextBtn.textContent = '\u2193';
      const counter = document.createElement('span');
      counter.className = 'search-counter';
      searchWrap.append(input, prevBtn, nextBtn, counter);
      toolbar.appendChild(searchWrap);
      search = new PreviewSearch({
        els: { input, prevBtn, nextBtn, counter, lform: this._lformEl, fhirJsonView: this._jsonEl, searchWrap },
        bus,
        previewMode: config.previewMode,
      });
    }

    const sep = document.createElement('span');
    sep.className = 'fhir-toolbar-sep';
    toolbar.appendChild(sep);

    let statusBadge = NOOP_CHROME.statusBadge;
    if (wantValidation) {
      const wrap = document.createElement('span');
      wrap.className = 'status-badge-wrap';
      wrap.style.display = 'none';
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'status-badge';
      btn.setAttribute('data-testid', 'status-badge-btn');
      const dropdown = document.createElement('div');
      dropdown.className = 'status-dropdown';
      dropdown.style.display = 'none';
      wrap.append(btn, dropdown);
      toolbar.appendChild(wrap);
      statusBadge = new StatusBadge({
        els: { btn, dropdown, wrap },
        bus,
        getStore: () => this._session.answerStore,
      });
    }

    this.mountEl.appendChild(toolbar);
    return { search, statusBadge, languageMenu: NOOP_CHROME.languageMenu };
  }

  on(type, cb)  { this._emitter.on(type, cb);  return this; }
  off(type, cb) { this._emitter.off(type, cb); return this; }

  /** Current answers as a FHIR QuestionnaireResponse. */
  getResponse() {
    const base = this._session.questDoc.rawFhir || { resourceType: 'Questionnaire', item: [] };
    return buildQR(base, this._session.answerStore.toValueMap());
  }

  /** Load answers from a QuestionnaireResponse and re-render. */
  setResponse(qr) {
    const values = this._session.answerStore.toValueMap();
    importQRAnswers(qr, values, this._session.questDoc.tree);
    this._session.answerStore.replaceAll(values);
    this._session.bus.dispatch(AppEvents.QR_LOADED, {});
    this._session.bus.dispatch(AppEvents.RESPONSE_CHANGED);
  }

  /** Switch the active preview language ('' = source). */
  setLanguage(lang) {
    this._session.bus.dispatch(AppEvents.LANGUAGE_CHANGED, { lang });
  }

  setConfig(partial) {
    Object.assign(this._config, partial);
    if (partial.language !== undefined) this.setLanguage(partial.language);
  }

  destroy() {
    this._offs?.forEach(off => off());
    this._offs = null;
    if (this.mountEl) this.mountEl.innerHTML = '';
    this._emitter = null;
  }
}
