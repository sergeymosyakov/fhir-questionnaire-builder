// ── Right panel: reactive preview ─────────────────────────────────────────────
import {
  effect,
  tree, values, getValue, setValue,
  calcFormOk, isMandatory,
  rawFhir, questVariables, CHECKABLE_TYPES
} from './state.js';
import { _formTick, _bulkUpdate } from './render-bus.js';
import { _rc } from './preview/render-ctx.js';
import { BaseNode } from './nodes/index.js';
import { GroupNode } from './nodes/group-node.js';
import { AppEvents } from './events.js';
import { highlightJson } from './utils.js';
import { evaluateNode } from './eval.js';
import { evalConstraints } from './state.js';
import { buildQR } from './fhir/qr-builder.js';
import { evalCalcNodes, buildVarEnv, evalInitialExprNodes } from './fhir/calc.js';
import { buildFHIRObject } from './fhir/export.js';

import * as search from './ui/search.js';
import * as statusBadge from './ui/status-badge.js';
import './ui/modals/explain-modal.js';
import * as progress from './ui/progress.js';

// View preferences — UI-only, not domain state.
// Owned here; updated via 'view-pref-change' CustomEvent from app.js.
const _viewPrefs = { showLinkId: true, showPrefix: true, showBadges: true, showHiddenItems: true };
document.addEventListener(AppEvents.VIEW_PREF_CHANGE, e => {
  _viewPrefs[e.detail.key] = e.detail.value;
  if (!_previewElements.lform) return;
  if (e.detail.key === 'showBadges') {
    _previewElements.lform.classList.toggle('preview--no-badges', !e.detail.value);
  } else if (e.detail.key === 'showLinkId') {
    _previewElements.lform.classList.toggle('preview--no-linkid', !e.detail.value);
  } else if (e.detail.key === 'showPrefix') {
    _previewElements.lform.classList.toggle('preview--no-prefix', !e.detail.value);
  } else if (e.detail.key === 'showHiddenItems') {
    _previewElements.lform.classList.toggle('preview--no-hidden', !e.detail.value);
  }
  _formTick.value++;
});

// Preview mode — UI-only, not domain state.
// Owned here; updated via 'preview-mode-change' CustomEvent from app.js.
let _previewMode = 'preview';
document.addEventListener(AppEvents.PREVIEW_MODE_CHANGE, e => {
  _previewMode = e.detail.mode;
  _previewElements.lform?.classList.toggle('patient-view', _previewMode === 'patient');
  if (_previewElements.lform) {
    const isJson = _previewMode === 'json';
    _previewElements.lform.style.display        = isJson ? 'none' : '';
    _previewElements.fhirJsonView.style.display = isJson ? '' : 'none';
  }
  _formTick.value++;
});

const fhirpath  = window.fhirpath;
// window.DOMPurify is loaded globally via <script> in index.html

// Last computed FHIRPath context — stable object, mutated in-place by _reCalc().
// Exposed via getLastCtx() and via _rc.lastCtx for render-node.js click handlers.
const _lastCtx = { fp: null, qr: null, env: {} };

export function getLastCtx() { return _lastCtx; }

// Pre-computed QR/envVars from reinitForm() — consumed once by the next _reCalc() call
// to avoid rebuilding the same objects twice when patient profile changes.
let _preQR = null;
let _preEnvVars = null;

// Yields two animation frames so the browser can paint before heavy work resumes.
function _yield() {
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}


function _reCalc() {
  if (fhirpath) {
    let qr, envVars;
    if (_preQR) {
      // Reuse pre-computed values from reinitForm() to avoid double build.
      qr = _preQR; envVars = _preEnvVars;
      _preQR = null; _preEnvVars = null;
    } else {
      const base = rawFhir.value ? JSON.parse(JSON.stringify(rawFhir.value)) : buildFHIRObject();
      qr = buildQR(base, values);
      envVars = buildVarEnv(questVariables, qr, fhirpath);
    }
    evalCalcNodes(tree, qr, fhirpath, values, envVars);
    const env = { resource: qr, ...envVars };
    _lastCtx.fp = fhirpath; _lastCtx.qr = qr; _lastCtx.env = env;
    document.dispatchEvent(new CustomEvent(AppEvents.REFRESH_EXPR_ICONS));
    return { fp: fhirpath, qr, envVars };
  }
  return { fp: null, qr: null, envVars: {} };
}


// Re-evaluate questionnaire-level variables and all initialExpression fields,
// then tick _formTick to refresh the preview.
// Called on form load and when the user clicks ↺ Re-init in the Variables panel.
export async function reinitForm() {
  if (!fhirpath) return;
  progress.show('Building questionnaire response…');
  await _yield();
  const base = rawFhir.value ? JSON.parse(JSON.stringify(rawFhir.value)) : { resourceType: 'Questionnaire', item: [] };
  const qr = buildQR(base, values);
  progress.show('Evaluating variables…');
  await _yield();
  const envVars = buildVarEnv(questVariables, qr, fhirpath);
  progress.show('Applying initial values…');
  await _yield();
  evalInitialExprNodes(tree, qr, fhirpath, values, envVars);
  // Cache pre-computed QR/envVars — _reCalc() will consume them to skip double build.
  _preQR = qr;
  _preEnvVars = envVars;
  progress.show('Refreshing preview…');
  await _yield();
  _formTick.value++; // triggers effect() → _asyncRender, which calls progress.hide() when done
}

// ── Interactive control for preview ──────────────────────────────────────────
// Thin wrapper: resolves onChange/icon update, delegates DOM construction to
// node.buildControl(ctx) — node always has the correct class prototype.
function buildControl(node, iconEl, onAfterChange) {
  const updateOwnIcon = () => {
    if (!iconEl) return;
    const ok = calcFormOk(node);
    iconEl.className   = ok ? 'icon-ok' : 'icon-fail';
    iconEl.textContent = ok ? '\u2713' : '\u2717';
  };
  const onChange = () => { updateOwnIcon(); if (onAfterChange) onAfterChange(); };

  const reCalcAndRefresh = () => {
    _reCalc();
    document.dispatchEvent(new CustomEvent(AppEvents.REFRESH_CALC_BADGES));
  };

  const ctx = { getValue, setValue, onChange, _reCalc: reCalcAndRefresh, _formTick, _fpCtx: _lastCtx };
  return node.buildControl(ctx);
}

// Set stable refs on _rc — done once at module load, after all local functions are defined.
// Node classes read these via _rc to avoid circular imports on render-preview.js.
_rc.viewPrefs         = _viewPrefs;
_rc.lastCtx           = _lastCtx;
_rc.buildControl      = buildControl;
_rc.values            = values;
_rc.formTick          = _formTick;
// Callback used by item-node.js after control value changes:
_rc.updateGroupIcons  = () => GroupNode.updateAll(_rc);
// State helpers injected to break circular imports in node classes:
_rc.isMandatory    = isMandatory;
_rc.calcFormOk     = calcFormOk;
_rc.evalConstraints = evalConstraints;
_rc.getValue       = getValue;
_rc.CHECKABLE_TYPES = CHECKABLE_TYPES;

// ── Async preview render with yield breaks ───────────────────────────────────
// Splits heavy FHIRPath evaluation (Phase 1) from DOM rebuild (Phase 2) using
// requestAnimationFrame yield points so the browser stays responsive.
// The _renderVersion counter ensures stale renders self-abort.
let _renderVersion = 0;
let _previewElements = {}; // injected via initPreview() from app.js

async function _asyncRender(version) {
  // Phase 1: FHIRPath evaluation — CPU-heavy, no DOM mutations yet
  const ctx = _reCalc();
  await _yield();
  if (version !== _renderVersion) return; // newer render started — abort

  if (tree.length === 0) {
    const lform = _previewElements.lform;
    if (lform) {
      lform.innerHTML = '';
      const placeholder = document.createElement('div');
      placeholder.className = 'preview-placeholder';
      placeholder.dataset.testid = 'preview-placeholder';
      placeholder.innerHTML =
        '<div class="preview-placeholder-icon">📋</div>' +
        '<div class="preview-placeholder-title">No questionnaire loaded</div>' +
        '<div class="preview-placeholder-hint">Use <strong>⬆ Load ▾</strong> to open a sample or upload your own FHIR R4 Questionnaire JSON,<br>or build one from scratch using <strong>+ Add Root Group</strong> in the left panel.</div>';
      lform.appendChild(placeholder);
    }
    statusBadge.update({ visible: [], ctx: null });
    progress.hide();
    return;
  }

  const results = [];
  for (const node of tree) {
    evaluateNode(node, ctx, results);
  }

  const visible   = results.filter(r => r.visible);
  const resultMap = new Map(results.map(r => [r.node.id, r]));
  const _cEnv     = ctx.envVars || {};

  await _yield();
  if (version !== _renderVersion) return; // abort before touching the DOM

  // Phase 2: DOM render — batched into a DocumentFragment for a single reflow
  const lform = _previewElements.lform;
  if (!lform) { progress.hide(); return; }
  const _scrollPanel = lform.closest('.right-panel-body');
  const _savedScroll = _scrollPanel ? _scrollPanel.scrollTop : 0;

  // Save focused element so we can restore focus after rebuilding the DOM
  const _activeEl = document.activeElement;
  let _focusInfo = null;
  if (_activeEl && lform.contains(_activeEl)) {
    const row = _activeEl.closest('[data-preview-id]');
    if (row) {
      const inputs = Array.from(row.querySelectorAll('input, textarea, select'));
      _focusInfo = {
        previewId: row.dataset.previewId,
        inputIndex: inputs.indexOf(_activeEl),
        selStart: _activeEl.selectionStart,
        selEnd: _activeEl.selectionEnd,
      };
    }
  }

  lform.innerHTML = '';

  const groupIconMap = new Map();
  _rc.ctx = ctx; _rc.resultMap = resultMap; _rc.cEnv = _cEnv; _rc.visible = visible; _rc.groupIconMap = groupIconMap; _rc.previewMode = _previewMode;

  // Render root nodes into a DocumentFragment for a single reflow
  const frag = document.createDocumentFragment();
  for (const node of tree) {
    const res = resultMap.get(node.id);
    if (res) BaseNode.dispatch(res, frag, _rc);
  }
  lform.appendChild(frag);

  // Restore scroll position after DOM rebuild
  if (_scrollPanel && _savedScroll) _scrollPanel.scrollTop = _savedScroll;

  // Restore focus after DOM rebuild
  if (_focusInfo) {
    const row = lform.querySelector('[data-preview-id="' + CSS.escape(_focusInfo.previewId) + '"]');
    if (row) {
      const inputs = Array.from(row.querySelectorAll('input, textarea, select'));
      const el = inputs[_focusInfo.inputIndex];
      if (el) {
        el.focus();
        try { el.setSelectionRange(_focusInfo.selStart, _focusInfo.selEnd); } catch { /* not all inputs support setSelectionRange */ }
      }
    }
  }

  GroupNode.updateAll(_rc); // sync group icons with initial values after full DOM build
  statusBadge.update({ visible, ctx });
  search.refresh();
  progress.hide(); // no-op when progress was not shown (normal form interactions)
}

// effect() subscribes to reactive deps and triggers the async render.
// Heavy computation and DOM work happen in _asyncRender() with yield breaks.
effect(() => {
  void _formTick.value;   // main trigger: structure / patient / config changes
  void rawFhir.value;     // trigger on questionnaire data reload
  if (_bulkUpdate.value) return; // mass mutation in progress — skip
  _asyncRender(++_renderVersion); // fire-and-forget; stale renders self-abort
});

// ── Preview DOM init (called once from app.js) ────────────────────────────────
export function collapseAllPreview() {
  document.dispatchEvent(new CustomEvent(AppEvents.COLLAPSE_ALL_PREVIEW));
  _formTick.value++;
}

export function expandAllPreview() {
  document.dispatchEvent(new CustomEvent(AppEvents.EXPAND_ALL_PREVIEW));
  _formTick.value++;
}

export function initPreview(elements) {
  _previewElements = elements;

  // Show toolbar controls only when tree has content
  effect(() => {
    const d = tree.length > 0 ? '' : 'none';
    elements.viewOptionsWrap.style.display = d;
    elements.searchWrap.style.display      = d;
    elements.previewModeWrap.style.display = d;
  });

  // Toggle CSS display modes on the lform container
  // Initial class states (all view options start as checked/visible)
  elements.lform.classList.toggle('preview--no-badges', !_viewPrefs.showBadges);
  elements.lform.classList.toggle('preview--no-linkid', !_viewPrefs.showLinkId);
  elements.lform.classList.toggle('preview--no-prefix', !_viewPrefs.showPrefix);
  elements.lform.classList.toggle('preview--no-hidden', !_viewPrefs.showHiddenItems);
  // Initial display state (preview mode starts as 'preview')
  elements.lform.classList.toggle('patient-view', _previewMode === 'patient');
  elements.lform.style.display        = _previewMode === 'json' ? 'none' : '';
  elements.fhirJsonView.style.display = _previewMode === 'json' ? '' : 'none';

  // JSON view: rebuild content on every form change when in JSON mode.
  effect(() => {
    void _formTick.value;
    if (_previewMode !== 'json') return;
    const q = buildFHIRObject();
    elements.fhirJsonView.innerHTML = highlightJson(JSON.stringify(q, null, 2));
    search.refresh(); // re-apply search marks if a query is active
  });
}
document.addEventListener(AppEvents.REINIT_FORM, reinitForm);
// GroupNode instances self-expand when they are a collapsed ancestor of the target.
// _formTick re-render picks up the new _previewCollapsed=false state.
// Target node's _scrollAfterRender flag (set by PREVIEW_NAVIGATE_TO) fires scroll via rAF in _makePreviewRow.
document.addEventListener(AppEvents.BUILDER_NAVIGATE, e => {
  document.dispatchEvent(new CustomEvent(AppEvents.PREVIEW_NAVIGATE_TO, { detail: { id: e.detail.id } }));
  _formTick.value++;
});
