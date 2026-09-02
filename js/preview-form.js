// ── Right panel: reactive preview form ─────────────────────────────────────────
import { _rc as _defaultRc } from './preview/render-ctx.js';
import { BaseNode } from './nodes/index.js';
import { GroupNode } from './nodes/group-node.js';
import { AppEvents, EventState } from './events.js';
import { highlightJson } from './utils.js';
import { evaluateNode } from './eval.js';
import { buildQR } from './fhir/qr-builder.js';
import { evalCalcNodes, buildVarEnv, evalInitialExprNodes, buildCalcCache } from './fhir/calc.js';
import { buildFHIRObject } from './fhir/export.js';
import { calcFormOk, isMandatory, evalConstraints, CHECKABLE_TYPES } from './fhir/form-checks.js';
import { importQRAnswers } from './fhir/qr-import.js';
import { populateFromServer } from './fhir/sdc-populate.js';
import { structureMapPopulate } from './fhir/sdc-structuremap-populate.js';
import { resolveCqlInitialValues } from './fhir/sdc-cql-eval.js';
import { getResourceByReference } from './fhir/fhir-search.js';
import { serverConfig, CONFIG_KEYS } from './fhir/server-config.js';
import { ensureLoggedIn } from './fhir/oauth-client.js';
import { startScheduler } from './fhir/oauth-scheduler.js';
import { defaultSession } from './core/session.js';

import './ui/modals/explain-modal.js';

const fhirpath = window.fhirpath;

function _yield() {
  if (typeof document !== 'undefined' && document.hidden) {
    return new Promise(resolve => setTimeout(resolve, 0));
  }
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

export class PreviewForm {
  /**
   * @param {object} deps — injected state
   * @param {object} deps.questDoc
   * @param {object} deps.answerStore
   */
  constructor(opts = {}) {
    // Session (questDoc + answerStore + bus) — injectable; defaults to the app session.
    this._session = opts.session || defaultSession;
    this._bus = this._session.bus;
    // Render context — injectable per instance; defaults to the app singleton.
    this._rc = opts.rc || _defaultRc;
    this._rc.bus = this._bus; // nodes wire preview-scoped listeners on this session bus
    // Progress overlay is an app-level concern — injectable; defaults to a no-op
    // (app supplies the real one via opts.progress) so preview-form stays free of
    // the self-initialising progress module.
    this._progress = opts.progress || { show() {}, hide() {} };
    // Notifications (errors/info) — injectable; defaults to silent no-op so a
    // headless widget with no host listener doesn't force a page-blocking toast.
    // The app supplies the real toast-based notifier (js/ui/toast.js); the
    // widget supplies one that emits 'error'/'info' events instead.
    this._notify = opts.notify || { error() {}, info() {} };
    // Preview-panel chrome — injectable; a headless widget uses the no-op defaults.
    // The app supplies the real search / status-badge / language-menu via chrome so
    // preview-form stays free of self-initialising app-shell modules.
    this._chrome = { search: { refresh() {} }, statusBadge: { update() {} }, languageMenu: { rebuild() {} }, ...(opts.chrome || {}) };
    // Primary render mount — injectable; defaults to the app's preview-lform.
    this._mountEl = opts.mountEl || null;
    // Optional JSON-view element (widget provides its own; app uses the shell one).
    this._jsonEl = opts.jsonEl || null;
    const _rc = this._rc;
    this._tree            = null;
    this._answerStore     = null;
    this._rawFhir         = null;
    this._questVariables  = null;
    this._calcFormOk      = null;

    this._viewPrefs     = opts.viewPrefs || { showLinkId: true, showPrefix: true, showBadges: true, showHiddenItems: true };
    this._previewMode   = opts.previewMode || 'preview';
    this._lastCtx       = { fp: null, qr: null, env: {} };
    this._preQR         = null;
    this._preEnvVars    = null;
    this._renderVersion = 0;
    this._renderTimer    = null;   // debounce handle for RESPONSE_CHANGED
    this._calcCache      = null;   // { nodeMap, order } — cached dep-graph, invalidated on REINIT_FORM
    this._pendingCtx     = null;   // result of last _reCalc(), consumed by next _asyncRender
    this._lastVisibleSig = null;   // nodesSig\trepSig fingerprint; fast/partial path when unchanged
    this._lastRepCounts  = null;   // Map<nodeId, length> — used by partial rebuild to detect which row changed
    this._lastRepDataSz  = null;   // Map<nodeId, JSON-length> — detects data changes inside instances (e.g. enableWhen in gtable)
    this._els            = {};

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
      this._calcFormOk    = (node, path) => calcFormOk(node, answerStore, path);
      _rc.instancePath    = [];
      _rc.translations    = questDoc.translations;
      _rc.calcFormOk      = node => this._calcFormOk(node, _rc.instancePath);
      _rc.updateGroupIcons = () => GroupNode.updateAll(_rc);
      _rc.getValue        = id => answerStore.get(id, _rc.instancePath);
      _rc.getAll          = id => answerStore.getAll(id, _rc.instancePath);
      _rc.set             = (id, v) => answerStore.set(id, v, _rc.instancePath);
      _rc.remove          = id => answerStore.remove(id, _rc.instancePath);
      _rc.instanceCount   = (id, p) => answerStore.instanceCount(id, p);
      _rc.addInstance     = (id, p) => answerStore.addInstance(id, p);
      _rc.removeInstance  = (id, i, p) => answerStore.removeInstance(id, i, p);
      _rc.evalChildren    = (children, p) => {
        const r = [];
        for (const ch of children) evaluateNode(ch, _rc.ctx, r, false, p);
        return r;
      };
    };
    if (opts.session) {
      // Explicit session (embedded widget): wire data synchronously.
      _initData({ questDoc: this._session.questDoc, answerStore: this._session.answerStore });
    } else {
      const cached = EventState.get(AppEvents.APP_CONTEXT_READY);
      if (cached?.questDoc) _initData(cached);
      else this._bus.on(AppEvents.APP_CONTEXT_READY, e => _initData(e.detail), { once: true });
    }

    // ── Event listeners ─────────────────────────────────────────────────────
    this._bus.on(AppEvents.VIEW_PREF_CHANGE,   e => this._onViewPrefChange(e));
    this._bus.on(AppEvents.PREVIEW_MODE_CHANGE,e => this._onPreviewModeChange(e));
    this._bus.on(AppEvents.REINIT_FORM,        e => this.reinitForm({ silent: e.detail?.silent }));
    this._bus.on(AppEvents.QUESTIONNAIRE_LOADED, () => {
      this._els.lform?.closest('.right-panel-body')?.scrollTo({ top: 0 });
      // Rebuild unconditionally here (not inside _asyncRender which may be cancelled)
      this._chrome.languageMenu.rebuild(this._rawFhir?.translations);
    });
    this._bus.on(AppEvents.BUILDER_NAVIGATE,   e => {
      this._bus.dispatch(AppEvents.PREVIEW_NAVIGATE_TO, { id: e.detail.id });
    });
    this._bus.on(AppEvents.RESPONSE_CHANGED, () => {
      ++this._renderVersion;
      clearTimeout(this._renderTimer);
      this._renderTimer = setTimeout(() => this._asyncRender(this._renderVersion), 30);
    });
    // Builder-side structural changes (modal apply, type change, expression edit)
    // dispatch CALC_RECALC_REQUESTED. Invalidate all render caches so the next
    // _asyncRender does a full rebuild rather than taking the fast/partial path.
    this._bus.on(AppEvents.CALC_RECALC_REQUESTED, () => {
      this._lastVisibleSig = null;
      this._lastRepCounts  = null;
      this._lastRepDataSz  = null;
      this._calcCache      = null;
    });
    // QR answers load does not dispatch REINIT_FORM — reset caches so the next
    // _asyncRender takes the full-rebuild path and re-renders all controls.
    this._bus.on(AppEvents.QR_LOADED, () => {
      this._lastVisibleSig = null;
      this._lastRepCounts  = null;
      this._lastRepDataSz  = null;
    });
    this._bus.on(AppEvents.EXPAND_ALL_PREVIEW,   () => { this._lastVisibleSig = null; this._lastRepCounts = null; this._lastRepDataSz = null; this._asyncRender(++this._renderVersion); });
    this._bus.on(AppEvents.COLLAPSE_ALL_PREVIEW, () => { this._lastVisibleSig = null; this._lastRepCounts = null; this._lastRepDataSz = null; this._asyncRender(++this._renderVersion); });
    this._bus.on(AppEvents.SDC_POPULATE_REQUESTED, e => this._populate(e.detail.patientRef));
    this._bus.on(AppEvents.STRUCTUREMAP_POPULATE_REQUESTED, e => this._structureMapPopulate(e.detail.patientRef));
    this._bus.on(AppEvents.LANGUAGE_CHANGED, e => {
      _rc.activeLanguage  = e.detail?.lang ?? '';
      _rc.translations    = this._rawFhir?.translations ?? {};
      this._lastVisibleSig = null; this._lastRepCounts = null; this._lastRepDataSz = null;  // text content changes — full rebuild required
      this._asyncRender(++this._renderVersion);
    });

    // mount() needs shell wraps created by mountHeaderActions() (app only); the
    // widget mounts manually after setup.
    if (opts.session) {
      // Widget: caller mounts after setup.
    } else if (EventState.get(AppEvents.APP_CONTEXT_READY)) {
      this.mount();
    } else {
      this._bus.on(AppEvents.APP_CONTEXT_READY, () => this.mount(), { once: true });
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  getLastCtx() { return this._lastCtx; }

  collapseAll() {
    this._bus.dispatch(AppEvents.COLLAPSE_ALL_PREVIEW);
  }

  expandAll() {
    this._bus.dispatch(AppEvents.EXPAND_ALL_PREVIEW);
  }

  /** Stop pending work. Session-bus listeners are released when the session is
   *  dereferenced; this just cancels the debounced render timer. */
  destroy() {
    clearTimeout(this._renderTimer);
  }

  mount() {
    const elements = {
      lform:           this._mountEl || document.querySelector('[data-mount="preview-lform"]'),
      fhirJsonView:    this._jsonEl || document.querySelector('[data-mount="fhir-json-view"]'),
      leftPanelBody:   document.querySelector('[data-mount="left-panel-body"]'),
      viewOptionsWrap: document.querySelector('[data-mount="viewOptionsWrap"]'),
      previewModeWrap: document.querySelector('[data-mount="previewModeWrap"]'),
      searchWrap:      document.querySelector('[data-mount="search-wrap"]'),
    };
    this._els = elements;

    const syncToolbarVisibility = () => {
      const d = this._tree.length > 0 ? '' : 'none';
      if (elements.viewOptionsWrap) elements.viewOptionsWrap.style.display = d;
      if (elements.searchWrap)      elements.searchWrap.style.display      = d;
      if (elements.previewModeWrap) elements.previewModeWrap.style.display = d;
    };
    syncToolbarVisibility();
    this._bus.on(AppEvents.QUESTIONNAIRE_LOADED,  syncToolbarVisibility);
    this._bus.on(AppEvents.QUESTIONNAIRE_NEW,     syncToolbarVisibility);
    this._bus.on(AppEvents.QUESTIONNAIRE_CLEARED, syncToolbarVisibility);
    // Clearing the form empties the tree but (unlike load) doesn't dispatch
    // QUESTIONNAIRE_LOADED — rebuild here so the preview reflects the empty tree.
    this._bus.on(AppEvents.QUESTIONNAIRE_CLEARED, () => {
      this._lastVisibleSig = null;
      this._lastRepCounts  = null;
      this._lastRepDataSz  = null;
      this._asyncRender(++this._renderVersion);
    });

    const lform = elements.lform;
    if (lform) {
      lform.classList.toggle('preview--no-badges', !this._viewPrefs.showBadges);
      lform.classList.toggle('preview--no-linkid', !this._viewPrefs.showLinkId);
      lform.classList.toggle('preview--no-prefix', !this._viewPrefs.showPrefix);
      lform.classList.toggle('preview--no-hidden', !this._viewPrefs.showHiddenItems);
      lform.classList.toggle('patient-view', this._previewMode === 'patient');
      lform.style.display = this._previewMode === 'json' ? 'none' : '';
    }
    if (elements.fhirJsonView) {
      elements.fhirJsonView.style.display = this._previewMode === 'json' ? '' : 'none';
    }

    // Initial render (shows placeholder when tree is empty)
    this._asyncRender(++this._renderVersion);
  }

  async reinitForm({ silent = false } = {}) {
    if (!fhirpath) return;
    const progress = this._progress;
    // Questionnaire structure changed — all cached state is stale.
    this._calcCache      = null;
    this._pendingCtx     = null;
    this._lastVisibleSig = null;
    this._lastRepCounts  = null;
    this._lastRepDataSz  = null;
    if (!silent) progress.show('Building questionnaire response\u2026');
    await _yield();
    const base = { resourceType: 'Questionnaire', item: [] };
    const qr = buildQR(base, this._answerStore.toValueMap());
    if (!silent) progress.show('Evaluating variables…');
    await _yield();
    const envVars = buildVarEnv(this._questVariables, qr, fhirpath);
    if (!silent) progress.show('Evaluating CQL expressions…');
    await _yield();
    const questJson = buildFHIRObject(this._session.questDoc);
    const cqlValues = await resolveCqlInitialValues(questJson, this._tree, envVars);
    if (!silent) progress.show('Applying initial values…');
    await _yield();
    const initMap = this._answerStore.toValueMap();
    evalInitialExprNodes(this._tree, qr, fhirpath, initMap, envVars, cqlValues);
    this._answerStore.merge(initMap);
    // Rebuild qr from the now-merged answers, using the real item defs (questJson,
    // not the empty `base` stub above) — the `qr` above reflects the pre-init
    // snapshot, so an enableWhenExpression/calculatedExpression evaluated against it
    // during the upcoming render would miss values initialExpression just wrote
    // (notably a CQL-computed value driving a downstream enableWhenExpression).
    this._preQR = buildQR(questJson, this._answerStore.toValueMap());
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
    this._lastVisibleSig = null; this._lastRepCounts = null;  // display mode changed — full rebuild
    this._asyncRender(++this._renderVersion);
  }

  _onPreviewModeChange(e) {
    this._previewMode = e.detail.mode;
    const lform = this._els.lform;
    lform?.classList.toggle('patient-view', this._previewMode === 'patient');
    if (lform) {
      const isJson = this._previewMode === 'json';
      lform.style.display                    = isJson ? 'none' : '';
      if (this._els.fhirJsonView) this._els.fhirJsonView.style.display = isJson ? '' : 'none';
    }
    this._lastVisibleSig = null; this._lastRepCounts = null;  // mode change — full rebuild
    this._asyncRender(++this._renderVersion);
  }

  _reCalc() {
    if (fhirpath) {
      let qr, envVars;
      const base = buildFHIRObject(this._session.questDoc);
      if (this._preQR) {
        qr = this._preQR; envVars = this._preEnvVars;
        this._preQR = null; this._preEnvVars = null;
      } else {
        qr = buildQR(base, this._answerStore.toValueMap());
        envVars = buildVarEnv(this._questVariables, qr, fhirpath);
      }
      const calcMap = this._answerStore.toValueMap();
      // Reuse cached dep-graph order (stable until questionnaire structure changes).
      if (!this._calcCache) {
        this._calcCache = buildCalcCache(this._tree, this._questVariables);
      }
      evalCalcNodes(this._tree, qr, fhirpath, calcMap, envVars, base, this._calcCache);
      this._answerStore.merge(calcMap);
      const env = { resource: qr, ...envVars };
      this._lastCtx.fp = fhirpath; this._lastCtx.qr = qr; this._lastCtx.env = env;
      this._bus.dispatch(AppEvents.FHIRPATH_CTX_UPDATED, { fp: fhirpath, qr, env });
      this._bus.dispatch(AppEvents.REFRESH_EXPR_ICONS);
      const ctx = { fp: fhirpath, qr, envVars };
      // Stash so the next _asyncRender (triggered by RESPONSE_CHANGED) can reuse
      // this result instead of running evalCalcNodes a second time.
      this._pendingCtx = ctx;
      return ctx;
    }
    return { fp: null, qr: null, envVars: {} };
  }

  _buildControl(node, iconEl, onAfterChange) {
    const _rc = this._rc;
    const isPatient = this._previewMode === 'patient';
    const path = _rc.instancePath && _rc.instancePath.length ? _rc.instancePath.slice() : undefined;
    const updateOwnIcon = () => {
      const ok = this._calcFormOk(node, path);
      if (iconEl) {
        iconEl.className   = ok ? 'icon-ok' : 'icon-fail';
        iconEl.textContent = ok ? '\u2713' : '\u2717';
      }
      if (isPatient && node._previewEl) {
        node._previewEl.classList.toggle('lform-item--invalid', !ok);
      }
    };
    const onChange = () => { updateOwnIcon(); if (onAfterChange) onAfterChange(); };
    const reCalcAndRefresh = () => {
      this._reCalc();
      this._bus.dispatch(AppEvents.REFRESH_CALC_BADGES);
    };
    const ctx = {
      getValue: id => this._answerStore.get(id, path),
      setValue: (id, v) => this._bus.dispatch(AppEvents.ANSWER_SET, { id, value: v, path }),
      onChange, _reCalc: reCalcAndRefresh,
      bus: this._bus,
      fhirBase: this._fhirBase(),
      corsProxy: this._session.config?.corsProxy ?? serverConfig.get(CONFIG_KEYS.CORS_PROXY),
      _fpCtx: this._lastCtx,
    };
    const el = node.buildControl(ctx);
    this._applyA11yLabels(el, node);
    // Inline validation errors are assertive live regions so screen readers
    // announce them when they appear/change (a11y).
    if (el && typeof el.querySelectorAll === 'function') {
      el.querySelectorAll('.ctrl-err').forEach(e => {
        e.setAttribute('role', 'alert');
        e.setAttribute('aria-live', 'assertive');
      });
    }
    return el;
  }

  // Give every native form control an accessible name derived from the item
  // title when it lacks one (a11y: WCAG 4.1.2 / label). Controls that already
  // carry aria-label / aria-labelledby or sit inside a <label> are left as-is.
  _applyA11yLabels(controlEl, node) {
    if (!controlEl || typeof controlEl.querySelectorAll !== 'function') return;
    const label = String(node.title || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!label) return;
    controlEl.querySelectorAll('input, select, textarea').forEach(f => {
      if (f.type === 'hidden') return;
      if (f.getAttribute('aria-label') || f.getAttribute('aria-labelledby')) return;
      if (f.id && controlEl.querySelector(`label[for="${f.id}"]`)) return;
      if (typeof f.closest === 'function' && f.closest('label')) return;
      f.setAttribute('aria-label', label);
    });
  }

  async _asyncRender(version) {
    const _rc = this._rc;
    const progress = this._progress;
    const { search, statusBadge, languageMenu } = this._chrome;
    // Reuse the context stashed by the last _reCalc() call (e.g. from a node's
    // _reCalc callback) so we don't run evalCalcNodes a second time per change.
    const ctx = this._pendingCtx || this._reCalc();
    this._pendingCtx = null;
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
            'Or start from scratch: click <strong>+ Add Root Group</strong> in the left panel.<br><br>' +
            'New here? Read the <a href="docs.html#/quick-tour" data-testid="preview-placeholder-docs-link">Quick tour</a> \u2014 five minutes, end to end.' +
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

    // ── Signature: nodesSig (which nodes visible + rendering-relevant properties) ────
    // Include display-affecting properties so any builder-side change forces a full
    // rebuild even when the visible node set is unchanged.
    const nodesSig  = visible.map(r => {
      const n = r.node;
      return `${n.id}|${n.title ?? ''}|${n.itemType ?? ''}|${n.mandatory ?? ''}|${n.logicWithParent ?? ''}|${n._prefix ?? ''}|${n._choiceOrientation ?? ''}|${n._previewCollapsed ? 'c' : 'e'}`;
    }).join('\0');
    const repNodes  = results.filter(r => r.visible && r.node.repeats);
    const curCounts = new Map(repNodes.map(r => [r.node.id, this._answerStore.data[r.node.id]?.length ?? 1]));
    // Also track JSON size of instance data so enableWhen changes INSIDE instances
    // (e.g. inside a gtable row) force a partial rebuild rather than a fast path.
    const dataSzOf  = id => { const d = this._answerStore.data[id]; return d ? JSON.stringify(d).length : 0; };
    const curDataSz = new Map(repNodes.map(r => [r.node.id, dataSzOf(r.node.id)]));
    const repSig    = repNodes.map(r => `${curCounts.get(r.node.id)}:${curDataSz.get(r.node.id)}`).join(',');
    const visibleSig = nodesSig + '\t' + repSig;

    const [prevNodesSig = '', prevRepSig = ''] = (this._lastVisibleSig ?? '\t').split('\t');
    const hasDOM = lform.children.length > 0;

    if (nodesSig === prevNodesSig && hasDOM) {
      _rc.ctx = ctx; _rc.resultMap = resultMap; _rc.cEnv = _cEnv;
      _rc.visible = visible;

      if (repSig === prevRepSig) {
        // ── Fast path: only values changed ────────────────────────────────
        // REFRESH_CALC_BADGES already updated badge elements in-place.
        // Refresh validity icons and meta outputs without touching the DOM.
        for (const r of results) {
          if (!r.visible) continue;
          const iconEl = r.node._iconEl;
          if (!iconEl || !document.contains(iconEl)) continue;
          const { displayOk } = r.node._evalCondition?.(r, _rc) ?? { displayOk: true };
          iconEl.className   = displayOk ? 'icon-ok' : 'icon-fail';
          iconEl.textContent = displayOk ? '\u2713' : '\u2717';
        }
        GroupNode.updateAll(_rc);
        statusBadge.update({ visible, ctx });
        search.refresh();
        this._updateJsonView();
        progress.hide();
        this._bus.dispatch(AppEvents.PREVIEW_RENDER_DONE);
        return;
      }

      // ── Partial rebuild: only repeat counts changed (+ Add another / × Remove)
      // Rebuild only the rows whose count changed — no lform.innerHTML = '',
      // no scroll save/restore, no flash.
      _rc.previewMode  = this._previewMode;
      _rc.translations = this._rawFhir?.translations ?? {};
      _rc.instancePath = [];

      for (const r of repNodes) {
        const curLen  = curCounts.get(r.node.id);
        const prevLen = this._lastRepCounts?.get(r.node.id) ?? 1;
        const curSz   = curDataSz.get(r.node.id);
        const prevSz  = this._lastRepDataSz?.get(r.node.id) ?? 0;
        if (curLen === prevLen && curSz === prevSz) continue;      // unchanged

        const oldRow = r.node._previewEl;
        if (!oldRow || !document.contains(oldRow)) continue;      // safety guard

        // Repeating groups render their instances (rg-instances / gtable table) as a
        // SIBLING of the header row in the parent container — not inside the header.
        // Capture this sibling BEFORE the replace so we can remove it afterward,
        // otherwise the old instances div remains in the DOM alongside the new one.
        const oldSibling = oldRow.nextElementSibling;

        const newFrag = document.createDocumentFragment();
        BaseNode.dispatch(r, newFrag, _rc);
        oldRow.replaceWith(newFrag);                               // surgical swap

        // Remove orphaned old instances / gtable sibling left behind by replaceWith.
        if (oldSibling && (
          oldSibling.dataset.rgGroup  === r.node.id ||
          oldSibling.dataset.gtableId === r.node.id
        )) {
          oldSibling.remove();
        }
      }

      this._lastVisibleSig = visibleSig;
      this._lastRepCounts  = curCounts;
      this._lastRepDataSz  = curDataSz;
      // Refresh icons across all visible items (a repeat add may change required state)
      for (const r of results) {
        if (!r.visible) continue;
        const iconEl = r.node._iconEl;
        if (!iconEl || !document.contains(iconEl)) continue;
        const { displayOk } = r.node._evalCondition?.(r, _rc) ?? { displayOk: true };
        iconEl.className   = displayOk ? 'icon-ok' : 'icon-fail';
        iconEl.textContent = displayOk ? '\u2713' : '\u2717';
      }
      GroupNode.updateAll(_rc);
      statusBadge.update({ visible, ctx });
      search.refresh();
      this._updateJsonView();
      progress.hide();
      this._bus.dispatch(AppEvents.PREVIEW_RENDER_DONE);
      return;
    }

    // ── Full rebuild: visible set changed ─────────────────────────────────────
    this._lastVisibleSig = visibleSig;
    this._lastRepCounts  = curCounts;

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
    _rc.translations = this._rawFhir?.translations ?? {};
    _rc.instancePath = [];

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
    // Rebuild language menu in case translations changed (e.g. after translate modal apply)
    languageMenu.rebuild(this._rawFhir?.translations);
    progress.hide();
    this._bus.dispatch(AppEvents.PREVIEW_RENDER_DONE);
  }

  /**
   * FHIR base URL — session config override always wins. Falls back to the
   * app's global Settings-configured server only for the app's own default
   * session; a widget session must get its FHIR base passed in via config —
   * it never silently inherits whatever the host page's app Settings has.
   */
  _fhirBase() {
    const fromConfig = this._session.config?.fhirBaseUrl;
    if (fromConfig) return fromConfig;
    return this._session === defaultSession ? serverConfig.get(CONFIG_KEYS.FHIR_BASE) : '';
  }

  /**
   * Auth header for widget-initiated FHIR calls, when the host manages its own
   * auth (e.g. the host's own app is already logged into the FHIR server) and
   * hands the widget a token via config.getAuthToken() instead of letting the
   * widget run its own OAuth flow. Per-instance — nothing is cached/stored
   * here, so multiple widgets on one page never share or clobber a token.
   * Returns null (meaning "use the default OAuth/debug-bridge resolution")
   * when the app's own session is rendering, or no getAuthToken was supplied.
   */
  async _resolveAuthHeader() {
    if (this._session === defaultSession) return null;
    const getAuthToken = this._session.config?.getAuthToken;
    if (typeof getAuthToken !== 'function') return null;
    const token = await getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /** Call $populate on the configured FHIR server and load the resulting answers. */
  async _populate(patientRef) {
    const progress = this._progress;
    const fhirBase = this._fhirBase();
    if (!fhirBase) { this._notify.error('FHIR Base Server not configured.'); return; }

    // Called first (before any other await) so a login popup, if needed,
    // still counts as triggered by the original button click. OAuth is an
    // app-global concern (config + token storage keyed only by FHIR_BASE/
    // SDC_SERVER, backed by the app's own Settings) — a widget session (which
    // may be one of several on the page, each with its own fhirBaseUrl) must
    // never engage it, or instances would read/overwrite each other's tokens.
    if (this._session === defaultSession) {
      const serverKey = serverConfig.get(CONFIG_KEYS.SDC_SERVER) ? 'SDC_SERVER' : 'FHIR_BASE';
      try {
        await ensureLoggedIn(serverKey);
        startScheduler(serverKey);
      } catch (err) {
        if (err.message !== 'login-cancelled') this._notify.error(`Login failed: ${err.message}`);
        return;
      }
    }

    progress.show('Populating from server\u2026');
    try {
      const questJson = buildFHIRObject(this._session.questDoc);
      const authHeader = await this._resolveAuthHeader();
      const qr = await populateFromServer(fhirBase, questJson, patientRef, { authHeader });
      const values = this._answerStore.toValueMap();
      const { loaded } = importQRAnswers(qr, values, this._tree);
      this._answerStore.replaceAll(values);
      this._bus.dispatch(AppEvents.REINIT_FORM);
      this._notify.info(`Pre-filled ${loaded} answer${loaded !== 1 ? 's' : ''} from server.`);
    } catch (err) {
      this._notify.error(err.message);
    } finally {
      progress.hide();
    }
  }

  /**
   * Run the questionnaire's sourceStructureMap against a resource fetched from
   * the FHIR server (e.g. Patient), producing a QuestionnaireResponse to
   * pre-fill answers — the StructureMap-based alternative to $populate.
   */
  async _structureMapPopulate(patientRef) {
    const progress = this._progress;
    const fhirBase = this._fhirBase();
    if (!fhirBase) { this._notify.error('FHIR Base Server not configured.'); return; }

    // Called first (before any other await) so a login popup, if needed,
    // still counts as triggered by the original button click. See _populate's
    // comment: OAuth is app-global (Settings-backed), so a widget session
    // (possibly one of several, each with its own fhirBaseUrl) skips it.
    if (this._session === defaultSession) {
      try {
        await ensureLoggedIn('FHIR_BASE');
        startScheduler('FHIR_BASE');
      } catch (err) {
        if (err.message !== 'login-cancelled') this._notify.error(`Login failed: ${err.message}`);
        return;
      }
    }

    progress.show('Running StructureMap population\u2026');
    try {
      const questJson = buildFHIRObject(this._session.questDoc);
      const authHeader = await this._resolveAuthHeader();
      const sourceResource = await getResourceByReference(patientRef, { fhirBase, authHeader });
      const { qr, warnings } = structureMapPopulate(questJson, sourceResource);
      if (!qr) { this._notify.error(warnings.join(' ') || 'StructureMap produced no output.'); return; }
      const values = this._answerStore.toValueMap();
      const { loaded } = importQRAnswers(qr, values, this._tree);
      this._answerStore.replaceAll(values);
      this._bus.dispatch(AppEvents.REINIT_FORM);
      this._notify.info(`Pre-filled ${loaded} answer${loaded !== 1 ? 's' : ''} via StructureMap.`);
    } catch (err) {
      this._notify.error(err.message);
    } finally {
      progress.hide();
    }
  }

  _updateJsonView() {
    if (this._previewMode !== 'json') return;
    if (!this._els.fhirJsonView) return;
    const q = buildFHIRObject(this._session.questDoc);
    this._els.fhirJsonView.innerHTML = highlightJson(JSON.stringify(q, null, 2));
    this._chrome.search.refresh();
  }
}
