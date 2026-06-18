// ── Right panel: reactive preview form ─────────────────────────────────────────
import { _rc } from './preview/render-ctx.js';
import { BaseNode } from './nodes/index.js';
import { GroupNode } from './nodes/group-node.js';
import { AppEvents, EventState } from './events.js';
import { highlightJson } from './utils.js';
import { evaluateNode } from './eval.js';
import { buildQR } from './fhir/qr-builder.js';
import { evalCalcNodes, buildVarEnv, evalInitialExprNodes } from './fhir/calc.js';
import { buildFHIRObject } from './fhir/export.js';
import { calcFormOk, isMandatory, evalConstraints, CHECKABLE_TYPES } from './fhir/form-checks.js';
import { importQRAnswers } from './fhir/qr-import.js';
import { populateFromServer } from './fhir/sdc-populate.js';
import { serverConfig, CONFIG_KEYS } from './fhir/server-config.js';
import { showError, showInfo } from './ui/toast.js';

import * as search from './ui/search.js';
import * as statusBadge from './ui/status-badge.js';
import './ui/modals/explain-modal.js';
import * as progress from './ui/progress.js';

const fhirpath = window.fhirpath;

function _yield() {
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

let _instance = null;

export class PreviewForm {
  /**
   * @param {object} deps — injected state
   * @param {object} deps.questDoc
   * @param {object} deps.answerStore
   */
  constructor() {
    _instance = this;
    this._tree            = null;
    this._answerStore     = null;
    this._rawFhir         = null;
    this._questVariables  = null;
    this._calcFormOk      = null;

    this._viewPrefs     = { showLinkId: true, showPrefix: true, showBadges: true, showHiddenItems: true };
    this._previewMode   = 'preview';
    this._lastCtx       = { fp: null, qr: null, env: {} };
    this._preQR         = null;
    this._preEnvVars    = null;
    this._renderVersion = 0;
    this._els           = {};

    // ── Wire _rc (shared context for node classes) ──────────────────────────
    _rc.viewPrefs        = this._viewPrefs;
    _rc.lastCtx          = this._lastCtx;
    _rc.buildControl     = (node, iconEl, cb) => this._buildControl(node, iconEl, cb);
    _rc.isMandatory      = isMandatory;
    _rc.evalConstraints  = evalConstraints;
    _rc.CHECKABLE_TYPES  = CHECKABLE_TYPES;

    // ── Data wiring deferred until APP_CONTEXT_READY ─────────────────────────
    const _initData = ({ questDoc, answerStore }) => {
      this._tree          = questDoc.tree;
      this._answerStore   = answerStore;
      this._rawFhir       = questDoc;
      this._questVariables = questDoc.variables;
      this._calcFormOk    = node => calcFormOk(node, answerStore);
      _rc.values          = answerStore.data;
      _rc.calcFormOk      = this._calcFormOk;
      _rc.updateGroupIcons = () => GroupNode.updateAll(_rc);
      _rc.getValue        = id => answerStore.get(id);
    };
    const cached = EventState.get(AppEvents.APP_CONTEXT_READY);
    if (cached?.questDoc) {
      _initData(cached);
    } else {
      document.addEventListener(AppEvents.APP_CONTEXT_READY, e => _initData(e.detail), { once: true });
    }

    // ── Event listeners ─────────────────────────────────────────────────────
    document.addEventListener(AppEvents.VIEW_PREF_CHANGE,   e => this._onViewPrefChange(e));
    document.addEventListener(AppEvents.PREVIEW_MODE_CHANGE,e => this._onPreviewModeChange(e));
    document.addEventListener(AppEvents.REINIT_FORM,        e => this.reinitForm({ silent: e.detail?.silent }));
    document.addEventListener(AppEvents.QUESTIONNAIRE_LOADED, () => {
      this._els.lform?.closest('.right-panel-body')?.scrollTo({ top: 0 });
    });
    document.addEventListener(AppEvents.BUILDER_NAVIGATE,   e => {
      document.dispatchEvent(new CustomEvent(AppEvents.PREVIEW_NAVIGATE_TO, { detail: { id: e.detail.id } }));
    });
    document.addEventListener(AppEvents.RESPONSE_CHANGED, () => this._asyncRender(++this._renderVersion));
    document.addEventListener(AppEvents.EXPAND_ALL_PREVIEW,   () => this._asyncRender(++this._renderVersion));
    document.addEventListener(AppEvents.COLLAPSE_ALL_PREVIEW, () => this._asyncRender(++this._renderVersion));
    document.addEventListener(AppEvents.SDC_POPULATE_REQUESTED, e => this._populate(e.detail.patientRef));

    // mount() needs viewOptionsWrap/previewModeWrap which are created by mountHeaderActions()
    // — defer until APP_CONTEXT_READY which fires after mountHeaderActions()
    if (EventState.get(AppEvents.APP_CONTEXT_READY)) {
      this.mount();
    } else {
      document.addEventListener(AppEvents.APP_CONTEXT_READY, () => this.mount(), { once: true });
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  getLastCtx() { return this._lastCtx; }

  collapseAll() {
    document.dispatchEvent(new CustomEvent(AppEvents.COLLAPSE_ALL_PREVIEW));
  }

  expandAll() {
    document.dispatchEvent(new CustomEvent(AppEvents.EXPAND_ALL_PREVIEW));
  }

  mount() {
    const elements = {
      lform:           document.querySelector('[data-mount="preview-lform"]'),
      fhirJsonView:    document.querySelector('[data-mount="fhir-json-view"]'),
      leftPanelBody:   document.querySelector('[data-mount="left-panel-body"]'),
      viewOptionsWrap: document.querySelector('[data-mount="viewOptionsWrap"]'),
      previewModeWrap: document.querySelector('[data-mount="previewModeWrap"]'),
      searchWrap:      document.querySelector('[data-mount="search-wrap"]'),
    };
    this._els = elements;

    const syncToolbarVisibility = () => {
      const d = this._tree.length > 0 ? '' : 'none';
      elements.viewOptionsWrap.style.display = d;
      elements.searchWrap.style.display      = d;
      elements.previewModeWrap.style.display = d;
    };
    syncToolbarVisibility();
    document.addEventListener(AppEvents.QUESTIONNAIRE_LOADED,  syncToolbarVisibility);
    document.addEventListener(AppEvents.QUESTIONNAIRE_NEW,     syncToolbarVisibility);
    document.addEventListener(AppEvents.QUESTIONNAIRE_CLEARED, syncToolbarVisibility);

    elements.lform.classList.toggle('preview--no-badges', !this._viewPrefs.showBadges);
    elements.lform.classList.toggle('preview--no-linkid', !this._viewPrefs.showLinkId);
    elements.lform.classList.toggle('preview--no-prefix', !this._viewPrefs.showPrefix);
    elements.lform.classList.toggle('preview--no-hidden', !this._viewPrefs.showHiddenItems);
    elements.lform.classList.toggle('patient-view', this._previewMode === 'patient');
    elements.lform.style.display        = this._previewMode === 'json' ? 'none' : '';
    elements.fhirJsonView.style.display = this._previewMode === 'json' ? '' : 'none';

    // Initial render (shows placeholder when tree is empty)
    this._asyncRender(++this._renderVersion);
  }

  async reinitForm({ silent = false } = {}) {
    if (!fhirpath) return;
    if (!silent) progress.show('Building questionnaire response\u2026');
    await _yield();
    const base = this._rawFhir.value
      ? JSON.parse(JSON.stringify(this._rawFhir.value))
      : { resourceType: 'Questionnaire', item: [] };
    const qr = buildQR(base, this._answerStore.data);
    if (!silent) progress.show('Evaluating variables…');
    await _yield();
    const envVars = buildVarEnv(this._questVariables, qr, fhirpath);
    if (!silent) progress.show('Applying initial values…');
    await _yield();
    evalInitialExprNodes(this._tree, qr, fhirpath, this._answerStore.data, envVars);
    this._preQR = qr;
    this._preEnvVars = envVars;
    if (!silent) progress.show('Refreshing preview\u2026');
    await _yield();
    this._asyncRender(++this._renderVersion);
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _onViewPrefChange(e) {
    this._viewPrefs[e.detail.key] = e.detail.value;
    const lform = this._els.lform;
    if (!lform) return;
    const cls = {
      showBadges:      'preview--no-badges',
      showLinkId:      'preview--no-linkid',
      showPrefix:      'preview--no-prefix',
      showHiddenItems: 'preview--no-hidden',
    }[e.detail.key];
    if (cls) lform.classList.toggle(cls, !e.detail.value);
    this._asyncRender(++this._renderVersion);
  }

  _onPreviewModeChange(e) {
    this._previewMode = e.detail.mode;
    const lform = this._els.lform;
    lform?.classList.toggle('patient-view', this._previewMode === 'patient');
    if (lform) {
      const isJson = this._previewMode === 'json';
      lform.style.display                    = isJson ? 'none' : '';
      this._els.fhirJsonView.style.display   = isJson ? '' : 'none';
    }
    this._asyncRender(++this._renderVersion);
  }

  _reCalc() {
    if (fhirpath) {
      let qr, envVars;
      const base = this._rawFhir.value
        ? JSON.parse(JSON.stringify(this._rawFhir.value))
        : buildFHIRObject();
      if (this._preQR) {
        qr = this._preQR; envVars = this._preEnvVars;
        this._preQR = null; this._preEnvVars = null;
      } else {
        qr = buildQR(base, this._answerStore.data);
        envVars = buildVarEnv(this._questVariables, qr, fhirpath);
      }
      evalCalcNodes(this._tree, qr, fhirpath, this._answerStore.data, envVars, base);
      const env = { resource: qr, ...envVars };
      this._lastCtx.fp = fhirpath; this._lastCtx.qr = qr; this._lastCtx.env = env;
      document.dispatchEvent(new CustomEvent(AppEvents.FHIRPATH_CTX_UPDATED, { detail: { fp: fhirpath, qr, env } }));
      document.dispatchEvent(new CustomEvent(AppEvents.REFRESH_EXPR_ICONS));
      return { fp: fhirpath, qr, envVars };
    }
    return { fp: null, qr: null, envVars: {} };
  }

  _buildControl(node, iconEl, onAfterChange) {
    const isPatient = this._previewMode === 'patient';
    const updateOwnIcon = () => {
      if (iconEl) {
        const ok = this._calcFormOk(node);
        iconEl.className   = ok ? 'icon-ok' : 'icon-fail';
        iconEl.textContent = ok ? '\u2713' : '\u2717';
      }
      if (isPatient && node._previewEl) {
        const ok = this._calcFormOk(node);
        node._previewEl.classList.toggle('lform-item--invalid', !ok);
      }
    };
    const onChange = () => { updateOwnIcon(); if (onAfterChange) onAfterChange(); };
    const reCalcAndRefresh = () => {
      this._reCalc();
      document.dispatchEvent(new CustomEvent(AppEvents.REFRESH_CALC_BADGES));
    };
    const ctx = {
      getValue: id => this._answerStore.get(id),
      setValue: (id, v) => document.dispatchEvent(new CustomEvent(AppEvents.ANSWER_SET, { detail: { id, value: v } })),
      onChange, _reCalc: reCalcAndRefresh,
      _fpCtx: this._lastCtx,
    };
    return node.buildControl(ctx);
  }

  async _asyncRender(version) {
    const ctx = this._reCalc();
    await _yield();
    if (version !== this._renderVersion) { progress.hide(); return; }

    if (this._tree.length === 0) {
      const lform = this._els.lform;
      if (lform) {
        lform.innerHTML = '';
        const placeholder = document.createElement('div');
        placeholder.className = 'preview-placeholder';
        placeholder.dataset.testid = 'preview-placeholder';
        placeholder.innerHTML =
          '<div class="preview-placeholder-icon">\uD83D\uDCCB</div>' +
          '<div class="preview-placeholder-title">No questionnaire loaded</div>' +
          '<div class="preview-placeholder-hint">' +
            'Use <strong>Questionnaires \u25BE</strong> in the toolbar to load a questionnaire:<br>' +
            '<strong>From file\u2026</strong> \u2014 upload a FHIR R4 or STU3 JSON file from your computer,<br>' +
            '<strong>From Library\u2026</strong> \u2014 pick one of the built-in samples,<br>' +
            '<strong>From Cloud\u2026</strong> \u2014 access your saved questionnaires (sign in required).<br>' +
            'Or start from scratch: click <strong>+ Add Root Group</strong> in the left panel.' +
          '</div>';
        lform.appendChild(placeholder);
      }
      statusBadge.update({ visible: [], ctx: null });
      progress.hide();
      return;
    }

    const results = [];
    for (const node of this._tree) evaluateNode(node, ctx, results);
    const visible   = results.filter(r => r.visible);
    const resultMap = new Map(results.map(r => [r.node.id, r]));
    const _cEnv     = ctx.envVars || {};

    await _yield();
    if (version !== this._renderVersion) { progress.hide(); return; }

    const lform = this._els.lform;
    if (!lform) { progress.hide(); return; }
    const scrollPanel = lform.closest('.right-panel-body');
    const savedScroll = scrollPanel ? scrollPanel.scrollTop : 0;

    const activeEl = document.activeElement;
    let focusInfo = null;
    if (activeEl && lform.contains(activeEl)) {
      const row = activeEl.closest('[data-preview-id]');
      if (row) {
        const inputs = Array.from(row.querySelectorAll('input, textarea, select'));
        focusInfo = {
          previewId:  row.dataset.previewId,
          inputIndex: inputs.indexOf(activeEl),
          selStart:   activeEl.selectionStart,
          selEnd:     activeEl.selectionEnd,
        };
      }
    }

    lform.innerHTML = '';

    const groupIconMap = new Map();
    _rc.ctx = ctx; _rc.resultMap = resultMap; _rc.cEnv = _cEnv;
    _rc.visible = visible; _rc.groupIconMap = groupIconMap;
    _rc.previewMode = this._previewMode;

    const frag = document.createDocumentFragment();
    for (const node of this._tree) {
      const res = resultMap.get(node.id);
      if (res) BaseNode.dispatch(res, frag, _rc);
    }
    lform.appendChild(frag);

    if (scrollPanel && savedScroll) scrollPanel.scrollTop = savedScroll;

    if (focusInfo) {
      const row = lform.querySelector('[data-preview-id="' + CSS.escape(focusInfo.previewId) + '"]');
      if (row) {
        const inputs = Array.from(row.querySelectorAll('input, textarea, select'));
        const el = inputs[focusInfo.inputIndex];
        if (el) {
          el.focus();
          try { el.setSelectionRange(focusInfo.selStart, focusInfo.selEnd); } catch { /* not all inputs support setSelectionRange */ }
        }
      }
    }

    GroupNode.updateAll(_rc);
    statusBadge.update({ visible, ctx });
    search.refresh();
    this._updateJsonView();
    progress.hide();
    document.dispatchEvent(new CustomEvent(AppEvents.PREVIEW_RENDER_DONE));
  }

  /** Call $populate on the configured FHIR server and load the resulting answers. */
  async _populate(patientRef) {
    const fhirBase = serverConfig.get(CONFIG_KEYS.FHIR_BASE);
    if (!fhirBase) { showError('No FHIR Base Server configured. Open Settings to set one.'); return; }

    progress.show('Populating from server\u2026');
    try {
      const questJson = buildFHIRObject();
      const qr = await populateFromServer(fhirBase, questJson, patientRef);
      const { loaded } = importQRAnswers(qr, this._answerStore.data, this._tree);
      document.dispatchEvent(new CustomEvent(AppEvents.REINIT_FORM));
      showInfo(`Pre-filled ${loaded} answer${loaded !== 1 ? 's' : ''} from server.`);
    } catch (err) {
      showError(err.message);
    } finally {
      progress.hide();
    }
  }

  _updateJsonView() {
    if (this._previewMode !== 'json') return;
    if (!this._els.fhirJsonView) return;
    const q = buildFHIRObject();
    this._els.fhirJsonView.innerHTML = highlightJson(JSON.stringify(q, null, 2));
    search.refresh();
  }
}
