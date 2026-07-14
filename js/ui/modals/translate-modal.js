// ── TranslateModal ────────────────────────────────────────────────────────────
// Tools ▾ → Translate questionnaire…
//
// Flow:
//   1. Language picker (custom-select) + Translate button
//   2. Progress bar while translating via translate-api.js
//   3. Review table — original | translated (editable inline)
//   4. Apply → writes to questDoc.translations + dispatches LANGUAGE_CHANGED
//
// data-testid registry:
//   translateModal          backdrop
//   translate-lang-select   language custom-select trigger
//   translate-btn           "Translate" button
//   translate-apply-btn     "Apply" button (saves reviewed translations)
//   translate-cancel-btn    "×" / Cancel button
//   translate-progress      progress bar wrap
//   translate-table         review table

import { Modal }                  from './modal-base.js';
import { createCustomSelect }     from '../custom-select.js';
import { translateBatch, SUPPORTED_LANGUAGES } from '../../fhir/translate-api.js';
import { UI_STRINGS }             from '../../fhir/ui-strings.js';
import { AppEvents }              from '../../events.js';
import { showError }              from '../toast.js';

export class TranslateModal extends Modal {
  constructor() {
    super({ cancelLabel: null, applyLabel: null, maxWidth: '780px', testid: 'translateModal' });
    this._targetLang  = '';
    this._reviewRows  = []; // { key, original, translated, inputEl }
    this._questDoc    = null;
  }

  static configure({ questDoc }) {
    TranslateModal._questDoc = questDoc;
  }

  open() {
    this._questDoc = TranslateModal._questDoc;
    this._targetLang = '';
    this._reviewRows = [];
    this._renderPicker();
    super.open();
  }

  getName() { return 'translateModal'; }

  // ── Phase 1: language picker ───────────────────────────────────────────────
  _renderPicker() {
    const body = this.body;
    body.innerHTML = '';
    // Footer: just Close
    this._setFooterPicker();

    const desc = document.createElement('p');
    desc.className = 'translate-desc';
    desc.textContent = 'Select a target language. All question text and answer labels will be auto-translated using Google Translate. You can review and edit the results before applying.';
    body.appendChild(desc);

    const row = document.createElement('div');
    row.className = 'translate-picker-row';

    const langItems = [...SUPPORTED_LANGUAGES.entries()].map(([code, label]) => ({ value: code, label }));
    const sel = createCustomSelect({
      items:    langItems,
      value:    '',
      testid:   'translate-lang-select',
      className: 'sc-trigger--sm',
      onChange: v => { this._targetLang = v; btn.disabled = !v; },
    });
    sel.el.dataset.tipTitle = 'Target language';
    sel.el.dataset.tipBody  = 'Language to translate the questionnaire into.';
    sel.el.dataset.tipFhir  = 'item._text.extension[translation].lang';
    sel.el.dataset.tipSpec  = 'R4';
    row.appendChild(sel.el);

    const btn = document.createElement('button');
    btn.type      = 'button';
    btn.className = 'modal-btn modal-btn--apply';
    btn.dataset.testid = 'translate-btn';
    btn.textContent = 'Translate';
    btn.disabled  = true;
    btn.addEventListener('click', () => this._startTranslation());
    row.appendChild(btn);

    body.appendChild(row);

    // If translations already exist show a language switcher note
    const existing = Object.keys(this._questDoc?.translations || {});
    if (existing.length) {
      const note = document.createElement('p');
      note.className = 'translate-existing-note';
      const labels = existing.map(l => SUPPORTED_LANGUAGES.get(l) || l).join(', ');
      note.textContent = `Existing translations: ${labels}. Translating again will overwrite only the selected language.`;
      body.appendChild(note);
    }
  }

  // ── Phase 2: translate ─────────────────────────────────────────────────────
  async _startTranslation() {
    const lang     = this._targetLang;
    const qd       = this._questDoc;
    const body     = this.body;
    const sourceLang = qd.meta.language || 'auto';

    // Collect all translatable strings
    const entries = []; // { key: string, original: string }

    // Title
    if (qd.meta.title) entries.push({ key: '__title__', original: qd.meta.title });

    // Walk tree
    function walk(nodes) {
      for (const node of nodes || []) {
        if (node.title) entries.push({ key: node.id, original: node.title });
        // answerOption labels from the node model
        const opts = _getOptionLabels(node);
        for (const { code, display } of opts) {
          if (display) entries.push({ key: node.id + '__' + code, original: display });
        }
        walk(node.children || []);
      }
    }
    walk(qd.tree);

    // UI strings (shown in patient view: buttons, separators, placeholders)
    for (const [key, original] of Object.entries(UI_STRINGS)) {
      entries.push({ key: '__ui__' + key, original, isUi: true });
    }

    if (!entries.length) { showError('No translatable text found.'); return; }

    // Show progress
    body.innerHTML = '';
    const progressWrap = document.createElement('div');
    progressWrap.className = 'translate-progress-wrap';
    progressWrap.dataset.testid = 'translate-progress';

    const progressLabel = document.createElement('div');
    progressLabel.className = 'translate-progress-label';
    progressLabel.textContent = `Translating 0 / ${entries.length}…`;

    const bar = document.createElement('div');
    bar.className = 'translate-progress-bar';
    const fill = document.createElement('div');
    fill.className = 'translate-progress-fill';
    bar.appendChild(fill);

    progressWrap.appendChild(progressLabel);
    progressWrap.appendChild(bar);
    body.appendChild(progressWrap);

    // Translate in batches
    const texts    = entries.map(e => e.original);
    let   done     = 0;
    const results  = [];

    const BATCH = 40;
    for (let i = 0; i < texts.length; i += BATCH) {
      const chunk = texts.slice(i, i + BATCH);
      try {
        const translated = await translateBatch(chunk, lang, sourceLang);
        results.push(...translated);
      } catch (err) {
        showError('Translation failed: ' + err.message);
        this._renderPicker();
        return;
      }
      done += chunk.length;
      progressLabel.textContent = `Translating ${done} / ${entries.length}…`;
      fill.style.width = Math.round((done / entries.length) * 100) + '%';
    }

    // Build review
    this._reviewRows = entries.map((e, idx) => ({ ...e, translated: results[idx] ?? e.original }));
    this._renderReview();
  }

  // ── Phase 3: review table ──────────────────────────────────────────────────
  _renderReview() {
    const body = this.body;
    body.innerHTML = '';
    // Footer: Discard + Apply
    this._setFooterReview();

    const info = document.createElement('p');
    info.className = 'translate-desc';
    info.textContent = 'Review and edit the translations below, then click Apply to save.';
    body.appendChild(info);

    const table = document.createElement('table');
    table.className  = 'translate-table';
    table.dataset.testid = 'translate-table';

    const thead = table.createTHead();
    const hRow  = thead.insertRow();
    ['Original', `Translation (${SUPPORTED_LANGUAGES.get(this._targetLang) || this._targetLang})`]
      .forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        hRow.appendChild(th);
      });

    const tbody = table.createTBody();
    let inUiSection = false;
    this._reviewRows.forEach(row => {
      // Add a separator row before UI strings section
      if (row.isUi && !inUiSection) {
        inUiSection = true;
        const sepRow = tbody.insertRow();
        sepRow.className = 'translate-section-sep';
        const sepCell = document.createElement('td');
        sepCell.colSpan = 2;
        sepCell.className = 'translate-section-label';
        sepCell.textContent = 'UI strings (buttons, separators, placeholders)';
        sepRow.appendChild(sepCell);
      }
      const tr = tbody.insertRow();
      const tdOrig = tr.insertCell();
      tdOrig.className = 'translate-td-orig';
      tdOrig.textContent = row.original;

      const tdTrans = tr.insertCell();
      const inp = document.createElement('textarea');
      inp.className = 'translate-inp';
      inp.rows = 1;
      inp.dataset.testid = 'translate-input-' + row.key;
      inp.value = row.translated;
      inp.addEventListener('input', () => { row.translated = inp.value; });
      tdTrans.appendChild(inp);
      row.inputEl = inp;
    });

    body.appendChild(table);
  }

  // ── Footer helpers ─────────────────────────────────────────────────────────
  _setFooterPicker() {
    this.footer.innerHTML = '';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'modal-btn modal-btn--cancel';
    closeBtn.dataset.testid = 'translateModalClose';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', () => this.close());
    this.footer.appendChild(closeBtn);
  }

  _setFooterReview() {
    this.footer.innerHTML = '';
    const discardBtn = document.createElement('button');
    discardBtn.type = 'button';
    discardBtn.className = 'modal-btn modal-btn--cancel';
    discardBtn.dataset.testid = 'translate-cancel-btn';
    discardBtn.textContent = 'Discard';
    discardBtn.addEventListener('click', () => this._renderPicker());

    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.className = 'modal-btn modal-btn--apply';
    applyBtn.dataset.testid = 'translate-apply-btn';
    applyBtn.textContent = 'Apply translations';
    applyBtn.addEventListener('click', () => this._applyTranslations());

    this.footer.appendChild(discardBtn);
    this.footer.appendChild(applyBtn);
  }

  // ── Phase 4: apply ─────────────────────────────────────────────────────────
  _applyTranslations() {
    const lang = this._targetLang;
    const qd   = this._questDoc;
    if (!qd.translations[lang]) qd.translations[lang] = { title: '', items: {}, opts: {}, ui: {} };
    if (!qd.translations[lang].ui) qd.translations[lang].ui = {};
    const store = qd.translations[lang];

    for (const row of this._reviewRows) {
      const val = row.inputEl?.value ?? row.translated;
      if (row.key === '__title__') {
        store.title = val;
      } else if (row.key.startsWith('__ui__')) {
        store.ui[row.key.slice(6)] = val;   // strip '__ui__' prefix
      } else if (row.key.includes('__')) {
        store.opts[row.key] = val;
      } else {
        store.items[row.key] = val;
      }
    }

    document.dispatchEvent(new CustomEvent(AppEvents.LANGUAGE_CHANGED, { detail: { lang } }));
    this.close();
  }

  // Modal lifecycle — no built-in apply button; actions are in the review footer
  _apply()  { /* handled by _applyTranslations */ }
  _cancel() { this.close(); }
}

// ── Helper: extract answer option codes + labels from a node ─────────────────
function _getOptionLabels(node) {
  if (!node.options && !node._rawAnswerOptions) return [];
  const results = [];
  if (node._rawAnswerOptions) {
    for (const ao of node._rawAnswerOptions) {
      const code    = ao.valueCoding?.code ?? ao.valueString ?? ao.valueInteger?.toString();
      const display = ao.valueCoding?.display ?? ao.valueString ?? ao.valueInteger?.toString();
      if (code) results.push({ code, display: display || '' });
    }
  } else if (node.options) {
    for (const part of node.options.split(',')) {
      const trimmed = part.trim();
      if (trimmed) results.push({ code: trimmed, display: trimmed });
    }
  }
  return results;
}

export const translateModal = new TranslateModal();

// Self-wire: settings-menu dispatches TRANSLATE_REQUESTED
if (typeof document !== 'undefined') {
  document.addEventListener(AppEvents.TRANSLATE_REQUESTED, () => translateModal.open());
}
