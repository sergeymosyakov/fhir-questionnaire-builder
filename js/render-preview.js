// ── Right panel: reactive preview ─────────────────────────────────────────────
import {
  effect,
  tree, values, getValue, setValue,
  calcFormOk, isMandatory,
  rawFhir, questVariables, CHECKABLE_TYPES
} from './state.js';
import { _formTick, _bulkUpdate } from './render-bus.js';
import { _rc } from './preview/render-ctx.js';
import { renderPreviewNode, updateGroupIcons } from './preview/render-node.js';

// View preferences — UI-only, not domain state.
// Owned here; updated via 'view-pref-change' CustomEvent from app.js.
const _viewPrefs = { showLinkId: true, showPrefix: true, showBadges: true, showHiddenItems: true };
document.addEventListener('view-pref-change', e => {
  _viewPrefs[e.detail.key] = e.detail.value;
  if (e.detail.key === 'showBadges') {
    _previewElements.lform?.classList.toggle('preview--no-badges', !e.detail.value);
  }
  _formTick.value++;
});

// Preview mode — UI-only, not domain state.
// Owned here; updated via 'preview-mode-change' CustomEvent from app.js.
let _previewMode = 'preview';
document.addEventListener('preview-mode-change', e => {
  _previewMode = e.detail.mode;
  _previewElements.lform?.classList.toggle('patient-view', _previewMode === 'patient');
  if (_previewElements.lform) {
    const isJson = _previewMode === 'json';
    _previewElements.lform.style.display        = isJson ? 'none' : '';
    _previewElements.fhirJsonView.style.display = isJson ? '' : 'none';
  }
  _formTick.value++;
});
import { isDescendant, findAncestorGroupIds, highlightJson } from './utils.js';
import { evaluateNode } from './eval.js';
import { evalConstraints } from './state.js';
import { buildQR } from './fhir/qr-builder.js';
import { evalCalcNodes, buildVarEnv, evalInitialExprNodes } from './fhir/calc.js';
import { buildFHIRObject } from './fhir/export.js';

import * as search from './ui/search.js';
import * as statusBadge from './ui/status-badge.js';
import * as explainModal from './ui/explain-modal.js';
import * as progress from './ui/progress.js';

const fhirpath  = window.fhirpath;
const DOMPurify = window.DOMPurify;

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

// Persists across re-renders (not reactive)
const collapsedGroups = new Set();

// Reset collapsedGroups from _collapsible values — call after import / clear form.
// Groups with _collapsible === 'default-closed' start collapsed; all others start expanded.
export function resetCollapsedFromTree(nodes) {
  collapsedGroups.clear();
  function walk(ns) {
    for (const n of ns) {
      if (n.type === 'group') {
        if (n._collapsible === 'default-closed') collapsedGroups.add(n.id);
        walk(n.children || []);
      }
    }
  }
  walk(nodes);
}

// Navigate to a preview node by id, expanding collapsed ancestors if needed.
export function navigateToPreview(id) {
  const ancestors = findAncestorGroupIds(id, tree);
  if (ancestors && ancestors.length > 0) {
    let expanded = false;
    for (const gid of ancestors) {
      if (collapsedGroups.has(gid)) { collapsedGroups.delete(gid); expanded = true; }
    }
    if (expanded) {
      _formTick.value++;
      // wait one microtask for DOM to rebuild before scrolling
      setTimeout(() => _scrollToPreview(id), 50);
      return;
    }
  }
  _scrollToPreview(id);
}

function _scrollToBuilder(nodeId) {
  const target = document.querySelector('[data-node-id="' + nodeId + '"]');
  if (!target) return;
  const panel = _previewElements.leftPanelBody;
  if (panel) {
    const top = target.getBoundingClientRect().top - panel.getBoundingClientRect().top + panel.scrollTop - 10;
    panel.scrollTo({ top, behavior: 'smooth' });
  } else {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  target.classList.add('node-flash');
  setTimeout(() => target.classList.remove('node-flash'), 1000);
}

function _scrollToPreview(id) {
  const target = document.querySelector('[data-preview-id="' + id + '"]');
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.classList.add('preview-flash');
  setTimeout(() => target.classList.remove('preview-flash'), 1000);
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
    refreshExprIcons();
    return { fp: fhirpath, qr, envVars };
  }
  return { fp: null, qr: null, envVars: {} };
}

// Update live-eval icons in the builder panels after every recalculation.
export function refreshExprIcons() {
  const { fp, qr, env } = _lastCtx;
  if (!fp) return;
  document.querySelectorAll('[data-expr-icon]').forEach(el => {
    const expr = el.dataset.exprIcon;
    if (!expr) { el.className = 'expr-live-icon'; el.textContent = ''; return; }
    try {
      const raw = fp.evaluate(qr || {}, expr, env || {});
      const ok  = Array.isArray(raw) ? (raw.length > 0 && raw[0] !== false) : Boolean(raw);
      el.className = 'expr-live-icon ' + (ok ? 'expr-live-icon--ok' : 'expr-live-icon--fail');
      el.textContent = ok ? '\u2713' : '\u2717';
    } catch {
      el.className = 'expr-live-icon expr-live-icon--err';
      el.textContent = '?';
    }
  });
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

// Update all visible calc-badge elements from current values[] without a full DOM rebuild.
function refreshCalcBadges() {
  document.querySelectorAll('[data-calc-id]').forEach(badge => {
    const id   = badge.dataset.calcId;
    const type = badge.dataset.calcType;
    if (type === 'checkbox') {
      const v = getValue(id);
      badge.className   = 'calc-badge ' + (v ? 'calc-true' : 'calc-false') + ' calc-badge--explain';
      badge.textContent = v ? '\u2713 true' : '\u2717 false';
    } else {
      const s = getValue(id);
      badge.className   = 'preview-calc-value';
      badge.textContent = (s !== undefined && s !== '') ? String(s) : '\u2014';
    }
  });
}

// ── Interactive control for preview ──────────────────────────────────────────
// Thin wrapper: resolves onChange/icon update, delegates DOM construction to
// the control registry in js/controls/index.js
function buildControl(node, iconEl, onAfterChange) {
  const updateOwnIcon = () => {
    if (!iconEl) return;
    const ok = calcFormOk(node);
    iconEl.className   = ok ? 'icon-ok' : 'icon-fail';
    iconEl.textContent = ok ? '\u2713' : '\u2717';
  };
  const onChange = () => { updateOwnIcon(); if (onAfterChange) onAfterChange(); };

  // Wrap _reCalc so calc badges update in-place after every oninput.
  const reCalcAndRefresh = () => { _reCalc(); refreshCalcBadges(); };

  return node.buildControl({ getValue, setValue, onChange, _reCalc: reCalcAndRefresh, _formTick });
}

// ── Repeat container: renders N+1 rows with add/remove buttons ────────────────
function buildRepeatControls(node, iconEl, onAfterChange) {
  const id     = node.id;
  const rowKey = i => i === 0 ? id : id + '$$' + i;
  const n      = values[id + '$$n'] || 0;

  const wrap = document.createElement('div');
  wrap.className = 'repeat-wrap';

  for (let i = 0; i <= n; i++) {
    const rk       = rowKey(i);
    const fakeNode = i === 0 ? node : Object.assign(Object.create(Object.getPrototypeOf(node)), node, { id: rk });
    const rowEl    = document.createElement('div');
    rowEl.className = 'repeat-row';

    rowEl.appendChild(buildControl(fakeNode, i === 0 ? iconEl : null, onAfterChange));

    if (n > 0) {
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'repeat-remove-btn';
      rm.textContent = '\xD7';
      rm.dataset.tipTitle = 'Remove this answer';
      rm.dataset.testid = 'repeat-remove-btn';
      const _i = i;
      rm.onclick = () => {
        for (let j = _i; j < n; j++) values[rowKey(j)] = values[rowKey(j + 1)];
        delete values[rowKey(n)];
        values[id + '$$n'] = n - 1;
        _formTick.value++;
      };
      rowEl.appendChild(rm);
    }

    wrap.appendChild(rowEl);
  }

  const maxOccurs = node._maxOccurs;
  const atMax = maxOccurs !== undefined && (n + 1) >= maxOccurs;

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'repeat-add-btn';
  addBtn.textContent = '+ Add another';
  addBtn.dataset.testid = 'repeat-add-btn';
  if (atMax) {
    addBtn.disabled = true;
    addBtn.dataset.tipTitle = 'Maximum ' + maxOccurs + ' answer' + (maxOccurs === 1 ? '' : 's') + ' reached';
  }
  addBtn.onclick = () => { if (!atMax) { values[id + '$$n'] = n + 1; _formTick.value++; } };
  wrap.appendChild(addBtn);

  return wrap;
}

// Set stable refs on _rc — done once at module load, after all local functions are defined.
// render-node.js reads these via _rc to avoid a circular import on render-preview.js.
_rc.viewPrefs         = _viewPrefs;
_rc.lastCtx           = _lastCtx;
_rc.collapsedGroups   = collapsedGroups;
_rc.scrollToBuilder   = _scrollToBuilder;
_rc.buildControl      = buildControl;
_rc.buildRepeatControls = buildRepeatControls;

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
      placeholder.innerHTML =
        '<div class="preview-placeholder-icon">📋</div>' +
        '<div class="preview-placeholder-title">No questionnaire loaded</div>' +
        '<div class="preview-placeholder-hint">Use <strong>⬆ Load ▾</strong> to open a sample or upload your own FHIR R4 Questionnaire JSON,<br>or build one from scratch using <strong>+ Add Root Group</strong> in the left panel.</div>';
      lform.appendChild(placeholder);
    }
    statusBadge.update({ anyVisible: false, hasCriteria: false, finalOk: false, failingItems: [] });
    progress.hide();
    return;
  }

  const results = [];
  let anyVisible = false;
  for (const node of tree) {
    const r = evaluateNode(node, ctx, results);
    if (r.visible) anyVisible = true;
  }

  const visible = results.filter(r => r.visible);
  const resultMap = new Map(results.map(r => [r.node.id, r]));

  // Hidden nodes (sdc-questionnaire-hidden) are excluded from all validation/scoring.
  const mandatoryItems = visible.filter(r => !r.disabled && !r.hidden && r.node.type === 'item' &&
    isMandatory(r.node) && CHECKABLE_TYPES.has(r.node.itemType)
  );
  const hasMandatory = mandatoryItems.length > 0;

  // calc nodes: visible, non-disabled, non-hidden items with a calculatedExpression
  const calcItems = visible.filter(r => !r.disabled && !r.hidden && r.node.type === 'item' && r.node._calculatedExpr && r.node._readOnly && r.node.itemType === 'checkbox');
  const hasCalc = calcItems.length > 0;
  const calcAllOk = calcItems.every(r => getValue(r.node.id) === true);

  // constraint items: visible, non-disabled, non-hidden items with questionnaire-constraint[]
  const _cEnv = ctx.envVars || {};
  const constraintItems = visible.filter(r => !r.disabled && !r.hidden && r.node.type === 'item' && r.node.constraint?.length);
  const hasConstraints = constraintItems.length > 0;
  const constraintsAllOk = constraintItems.every(r => evalConstraints(r.node, ctx.fp, ctx.qr, _cEnv));

  // range items: optional items with minValue/maxValue (mandatory ones are covered by mandatoryItems+calcFormOk)
  const rangeItems = visible.filter(r => !r.disabled && !r.hidden && r.node.type === 'item' &&
    !isMandatory(r.node) && (r.node._minValue !== undefined || r.node._maxValue !== undefined)
  );
  const hasRange = rangeItems.length > 0;
  const rangeAllOk = rangeItems.every(r => calcFormOk(r.node));

  const formItemsOk = visible.filter(r => !r.disabled && !r.hidden).every(res => {
    if (res.node.type === 'item') return res.ok && calcFormOk(res.node);
    return res.ok;
  });
  let finalOk = (hasMandatory ? formItemsOk : true) && (hasCalc ? calcAllOk : true) &&
    (!hasConstraints || constraintsAllOk) &&
    (!hasRange || rangeAllOk) &&
    (hasMandatory || hasCalc || hasConstraints || hasRange);
  const failingItems = [
    ...mandatoryItems.filter(r => !r.ok || !calcFormOk(r.node)).map(r => ({ title: r.node.title, id: r.node.id })),
    ...calcItems.filter(r => getValue(r.node.id) !== true).map(r => ({ title: r.node.title, id: r.node.id })),
    ...constraintItems.filter(r => !evalConstraints(r.node, ctx.fp, ctx.qr, _cEnv)).map(r => ({ title: r.node.title, id: r.node.id })),
    ...rangeItems.filter(r => !calcFormOk(r.node)).map(r => ({ title: r.node.title, id: r.node.id }))
  ];

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

  // Phase 2: render root nodes into a DocumentFragment for a single reflow
  const frag = document.createDocumentFragment();
  for (const node of tree) {
    const res = resultMap.get(node.id);
    if (res) renderPreviewNode(res, frag);
  }
  lform.appendChild(frag);

  // Restore scroll position after DOM rebuild
  if (_scrollPanel && _savedScroll) _scrollPanel.scrollTop = _savedScroll;

  // Restore focus after DOM rebuild
  if (_focusInfo) {
    const row = lform.querySelector('[data-preview-id="' + _focusInfo.previewId + '"]');
    if (row) {
      const inputs = Array.from(row.querySelectorAll('input, textarea, select'));
      const el = inputs[_focusInfo.inputIndex];
      if (el) {
        el.focus();
        try { el.setSelectionRange(_focusInfo.selStart, _focusInfo.selEnd); } catch {}
      }
    }
  }

  updateGroupIcons(); // sync group icons with initial values after full DOM build
  statusBadge.update({ anyVisible, hasCriteria: hasMandatory || hasCalc || hasConstraints || hasRange, finalOk, failingItems });
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

// ── Collapse / Expand all ─────────────────────────────────────────────────────
function _collectGroupIds(nodes, out = []) {
  for (const n of nodes) {
    if (n.type === 'group') {
      out.push(n.id);
      if (n.children) _collectGroupIds(n.children, out);
    }
  }
  return out;
}

// ── Preview DOM init (called once from app.js) ────────────────────────────────
export function initPreview(elements) {
  _previewElements = elements;

  elements.previewCollapseAllBtn.addEventListener('click', () => {
    for (const id of _collectGroupIds(tree)) collapsedGroups.add(id);
    _formTick.value++;
  });
  elements.previewExpandAllBtn.addEventListener('click', () => {
    collapsedGroups.clear();
    _formTick.value++;
  });

  // Show toolbar controls only when tree has content
  effect(() => {
    const d = tree.length > 0 ? '' : 'none';
    elements.showLinkIdBtn.style.display         = d;
    elements.showPrefixBtn.style.display         = d;
    elements.showBadgesBtn.style.display         = d;
    elements.showHiddenBtn.style.display         = d;
    elements.previewCollapseAllBtn.style.display = d;
    elements.previewExpandAllBtn.style.display   = d;
    elements.searchWrap.style.display            = d;
    elements.previewModeWrap.style.display        = d;
  });

  // Toggle CSS display modes on the lform container
  // preview--no-badges initial state (default: badges visible)
  elements.lform.classList.toggle('preview--no-badges', !_viewPrefs.showBadges);
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
