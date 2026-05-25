// ── Right panel: reactive preview ─────────────────────────────────────────────
import {
  effect,
  tree, values, getValue, setValue,
  calcFormOk, isMandatory,
  rawFhir, questVariables, CHECKABLE_TYPES
} from './state.js';
import { _formTick, _bulkUpdate } from './render-bus.js';

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
import { buildControl as _buildControl } from './controls/index.js';
import * as search from './ui/search.js';
import * as statusBadge from './ui/status-badge.js';
import * as explainModal from './ui/explain-modal.js';
import * as progress from './ui/progress.js';

const fhirpath  = window.fhirpath;
const DOMPurify = window.DOMPurify;

// Set label text: use sanitized XHTML when available, plain text otherwise.
function _setNodeLabel(el, node) {
  if (node._renderXhtml && DOMPurify) {
    el.innerHTML = DOMPurify.sanitize(node._renderXhtml);
  } else {
    el.textContent = node.title;
  }
}

// Last computed FHIRPath context — updated by _reCalc(), read by Explain click handlers.
let _lastCtx = { fp: null, qr: null, env: {} };

// Safe allowlist for node._renderStyle — only these CSS properties are applied.
const _STYLE_ALLOWLIST = new Set(['font-weight','font-style','color','font-size','text-decoration']);
function _applyRenderStyle(el, raw) {
  if (!raw) return;
  raw.split(';').forEach(part => {
    const sep = part.indexOf(':');
    if (sep < 1) return;
    const prop = part.slice(0, sep).trim().toLowerCase();
    const val  = part.slice(sep + 1).trim();
    if (_STYLE_ALLOWLIST.has(prop) && val) el.style.setProperty(prop, val);
  });
}

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
    _lastCtx = { fp: fhirpath, qr, env };
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

  return _buildControl(node, { getValue, setValue, onChange, _reCalc: reCalcAndRefresh, _formTick });
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
    const fakeNode = i === 0 ? node : { ...node, id: rk };
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

  function renderPreviewNode(res, container) {
    if (!res) return;
    if (!res.visible && !res.showDimmed) return;

    const isPatient = _previewMode === 'patient';
    // Hidden items (sdc-questionnaire-hidden): excluded in patient view and when toggle is off.
    if (res.hidden && (isPatient || !_viewPrefs.showHiddenItems)) return;

    // Dimmed: enableWhen condition not yet met
    if (!res.visible && res.showDimmed) {
      // Patient view: don't show waiting/dimmed items — form reflects only live visible items.
      if (isPatient) return;
      // 'hidden' disabledDisplay: remove entirely from view (including children)
      if (res.node._disabledDisplay === 'hidden') return;
      const row = document.createElement('div');
      row.className = 'lform-item lform-waiting preview-row--pointer';
      row.dataset.previewId = res.node.id;
      row.dataset.tipTitle = 'Click to navigate to builder node';
      row.addEventListener('click', () => _scrollToBuilder(res.node.id));
      const ph = document.createElement('span');
      ph.className = 'preview-icon-ph';
      row.appendChild(ph);
      const label = document.createElement('span');
      label.className = 'preview-label--dim';
      label.textContent = (res.node.type === 'group' ? 'Group: ' : 'Item: ') + res.node.title;
      row.appendChild(label);
      const hint = document.createElement('span');
      hint.className = 'preview-condition-hint preview-condition-waiting';
      const _dimText = res.node._enableWhenText || res.node.enableWhenExpression || 'condition not met';
      hint.textContent = '\uD83D\uDD12 ' + _dimText;
      if (res.node.enableWhenExpression) {
        hint.classList.add('preview-condition-hint--explain');
        hint.dataset.tipTitle = 'Visibility condition';
        hint.dataset.tipBody  = 'Not met. FHIRPath: ' + res.node.enableWhenExpression + '\n\nClick to explain.';
        hint.dataset.tipFhir  = 'sdc-questionnaire-enableWhenExpression';
        hint.dataset.tipSpec  = 'SDC';
        const _expr = res.node.enableWhenExpression;
        hint.addEventListener('click', e => {
          e.stopPropagation();
          if (_lastCtx.fp) explainModal.show(_expr, _lastCtx.fp, _lastCtx.qr, _lastCtx.env);
        });
      } else {
        hint.dataset.tipTitle = 'Visibility condition';
        hint.dataset.tipBody  = 'Not yet met: ' + _dimText + '\n\nThis label is auto-generated from the enableWhen condition. To change it \u2014 edit the Show When panel in the builder.';
        hint.dataset.tipFhir  = 'Questionnaire.item.enableWhen[]';
        hint.dataset.tipSpec  = 'R4';
      }
      row.appendChild(hint);
      container.appendChild(row);
      // Also render children of dimmed groups as disabled so every builder node
      // has a corresponding preview row (keeps counts in sync).
      if (res.node.type === 'group' && res.node.children.length > 0) {
        const nested = document.createElement('div');
        nested.className = 'preview-nested';
        for (const ch of res.node.children) {
          const childRes = resultMap.get(ch.id);
          if (childRes) renderPreviewNode(childRes, nested);
        }
        if (nested.childElementCount > 0) container.appendChild(nested);
      }
      return;
    }

    // Disabled: group conditionRule not met → N/A
    if (res.disabled) {
      // Patient view: skip disabled items entirely.
      if (isPatient) return;
      const row = document.createElement('div');
      row.className = 'lform-item lform-disabled preview-row--pointer';
      row.dataset.previewId = res.node.id;
      row.addEventListener('click', () => _scrollToBuilder(res.node.id));
      const naIcon = document.createElement('span');
      naIcon.className = 'icon-na';
      row.appendChild(naIcon);
      const label = document.createElement('span');
      if (res.node.type === 'group') label.className = 'group-label';
      label.textContent = (res.node.type === 'group' ? 'Group: ' : 'Item: ') + res.node.title;
      row.appendChild(label);
      container.appendChild(row);
      if (res.node.type === 'group' && res.node.children.length > 0) {
        const nested = document.createElement('div');
        nested.className = 'preview-nested';
        for (const ch of res.node.children) {
          const childRes = resultMap.get(ch.id);
          if (childRes) renderPreviewNode(childRes, nested);
        }
        if (nested.childElementCount > 0) container.appendChild(nested);
      }
      return;
    }

    let hasCondition, displayOk;
    if (res.node.type === 'group') {
      const descendantItems = visible.filter(r =>
        r.node.type === 'item' && !r.disabled && !r.hidden && isDescendant(r.node.id, res.node)
      );
      // Only count items that actually have a checkable condition right now
      const relevantItems = descendantItems.filter(r =>
        (isMandatory(r.node) && CHECKABLE_TYPES.has(r.node.itemType)) ||
        (r.node._calculatedExpr && r.node._readOnly && r.node.itemType === 'checkbox') ||
        r.node.constraint?.length > 0 ||
        (r.node._minValue !== undefined || r.node._maxValue !== undefined)
      );
      if (relevantItems.length === 0) {
        hasCondition = false;
        displayOk    = true;
      } else {
        hasCondition = true;
        const itemOk = k => k.ok && calcFormOk(k.node) && (!k.node.constraint?.length || evalConstraints(k.node, ctx.fp, ctx.qr, _cEnv));
        displayOk = res.node.logicWithParent === 'OR'
          ? relevantItems.some(itemOk)
          : relevantItems.every(itemOk);
      }
    } else {
      // Item has a condition if:
      // - is mandatory checkable type (must be filled/valid), OR
      // - is optional URL (format validation always applies), OR
      // - is a readOnly boolean calc node after Test
      const _constraintPass = res.node.constraint?.length
        ? evalConstraints(res.node, ctx.fp, ctx.qr, _cEnv) : true;
      hasCondition = res.node.itemType !== 'display' && (
        (CHECKABLE_TYPES.has(res.node.itemType) && (isMandatory(res.node) || res.node.itemType === 'url')) ||
        (res.node._calculatedExpr && res.node._readOnly && res.node.itemType === 'checkbox') ||
        (res.node.constraint?.length > 0) ||
        (res.node._minValue !== undefined || res.node._maxValue !== undefined)
      );
      displayOk    = res.ok && calcFormOk(res.node) && _constraintPass;
    }

    const row = document.createElement('div');
    row.className = 'lform-item';
    row.dataset.previewId = res.node.id;
    if (res.node.type === 'item' && res.node.itemType === 'display' && res.node._displayCategory) {
      row.classList.add('lform-item--' + res.node._displayCategory);
    }
    // sdc-questionnaire-hidden: add dashed border to the root hidden node
    if (res.hiddenRoot) row.classList.add('lform-item--hidden');
    if (!isPatient) {
      const navBtn = document.createElement('span');
      navBtn.className = 'preview-nav-btn';
      navBtn.dataset.testid = 'preview-nav-btn';
      navBtn.textContent = '\u2197'; // ↗
      navBtn.dataset.tipTitle = 'Go to builder node';
      navBtn.dataset.tipBody  = 'Scroll and highlight the corresponding node in the builder panel.';
      navBtn.addEventListener('click', e => { e.stopPropagation(); _scrollToBuilder(res.node.id); });
      row.appendChild(navBtn);
    }

    let iconEl = null;
    if (!isPatient) {
      // Hidden items are excluded from PASS/FAIL — always show neutral placeholder icon
      if (hasCondition && !res.hidden) {
        iconEl = document.createElement('span');
        iconEl.className   = displayOk ? 'icon-ok' : 'icon-fail';
        iconEl.textContent = displayOk ? '\u2713' : '\u2717';
        row.appendChild(iconEl);
      } else {
        const ph = document.createElement('span');
        ph.className = 'preview-icon-ph';
        row.appendChild(ph);
      }
    }
    res._iconEl = iconEl;

    const isEmptyGroup = res.node.type === 'group' && res.node.children.length === 0;

    const idTag = document.createElement('span');
    idTag.className = 'preview-linkid';
    idTag.dataset.testid = 'preview-linkid';
    idTag.textContent = res.node.id;
    const _it = res.node.itemType;
    const _valExample = _it === 'checkbox' ? 'true / false'
      : _it === 'integer'  ? '42 (valueInteger)'
      : _it === 'decimal'  ? '3.14 (valueDecimal)'
      : _it === 'number'   ? '42'
      : _it === 'date'     ? '"2024-01-15"'
      : _it === 'select' || _it === 'radio' || _it === 'open-choice' ? '"option-code"'
      : _it === 'quantity' ? '{ value: 70, unit: "kg" }'
      : '"text value"';
    idTag.dataset.tipTitle = 'linkId: ' + res.node.id;
    idTag.dataset.tipBody  =
      'In visibility rules:  values[\'' + res.node.id + '\']\n' +
      'Expected value:  ' + _valExample +
      (_it ? '\nItem type:  ' + _it : '') +
      '\nClick to copy linkId to clipboard.';
    idTag.dataset.tipFhir = 'Questionnaire.item.linkId';
    idTag.dataset.tipSpec  = 'R4';
    idTag.style.cursor = 'pointer';
    idTag.addEventListener('click', e => {
      e.stopPropagation();
      navigator.clipboard.writeText(res.node.id).catch(() => {});
      idTag.textContent = '✓ copied';
      setTimeout(() => { idTag.textContent = res.node.id; }, 1200);
    });
    if (_viewPrefs.showLinkId && !isPatient) row.appendChild(idTag);

    // HIDDEN badge for sdc-questionnaire-hidden root nodes
    if (res.hiddenRoot && !isPatient) {
      const hiddenBadge = document.createElement('span');
      hiddenBadge.className = 'preview-hidden-badge';
      hiddenBadge.textContent = 'HIDDEN';
      hiddenBadge.dataset.tipTitle = 'sdc-questionnaire-hidden';
      hiddenBadge.dataset.tipBody  = 'This item is permanently hidden from patients. It still participates in calculatedExpression logic. Controls are disabled in preview.';
      hiddenBadge.dataset.tipFhir  = 'sdc-questionnaire-hidden';
      hiddenBadge.dataset.tipSpec  = 'SDC';
      row.appendChild(hiddenBadge);
    }

    if (res.node._prefix && _viewPrefs.showPrefix) {
      const prefixEl = document.createElement('span');
      prefixEl.className = 'preview-prefix';
      prefixEl.textContent = res.node._prefix;
      row.appendChild(prefixEl);
    }

    const label = document.createElement('span');
    if (isEmptyGroup) {
      label.className = 'display-info-label';
      _setNodeLabel(label, res.node);
    } else if (res.node.type === 'group') {
      label.className = 'group-label';
      _setNodeLabel(label, res.node);
    } else if (res.node.itemType === 'display' && res.node._displayCategory === 'help') {
      label.className = 'display-help-wrap';
      const helpToggle = document.createElement('button');
      helpToggle.type = 'button';
      helpToggle.className = 'display-help-toggle';
      helpToggle.dataset.testid = 'display-help-toggle';
      helpToggle.textContent = '? Help';
      const helpContent = document.createElement('span');
      helpContent.className = 'display-help-content';
      helpContent.dataset.testid = 'display-help-content';
      helpContent.textContent = res.node.title;
      helpToggle.addEventListener('click', () => {
        const open = helpContent.classList.toggle('display-help-content--open');
        helpToggle.classList.toggle('display-help-toggle--open', open);
      });
      label.append(helpToggle, helpContent);
    } else {
      _setNodeLabel(label, res.node);
    }
    if (res.node._renderStyle) _applyRenderStyle(label, res.node._renderStyle);
    if (res.node.type === 'item' && res.node.itemType === 'display' && res.node._displayCategory && res.node._displayCategory !== 'help') {
      const catIcon = document.createElement('span');
      catIcon.className = 'display-cat-icon display-cat-icon--' + res.node._displayCategory;
      catIcon.dataset.testid = 'display-category-icon';
      catIcon.textContent = res.node._displayCategory === 'instructions' ? '\u2139' : '\u26A0';
      catIcon.dataset.tipTitle = res.node._displayCategory === 'instructions' ? 'Instructions' : 'Security notice';
      catIcon.dataset.tipBody  = 'questionnaire-displayCategory: ' + res.node._displayCategory;
      catIcon.dataset.tipFhir  = 'item.extension[questionnaire-displayCategory].valueCodeableConcept.coding[0].code';
      catIcon.dataset.tipSpec  = 'R4';
      row.appendChild(catIcon);
    }
    row.appendChild(label);

    // ── Support links (questionnaire-supportLink) ───────────────────────────
    if (res.node._supportLinks && res.node._supportLinks.length) {
      const validLinks = res.node._supportLinks.filter(u => u && u.trim());
      if (isPatient) {
        // Patient view: explicit "More info ↗" button per link
        for (const url of validLinks) {
          const btn = document.createElement('a');
          btn.className = 'support-link-patient-btn';
          btn.dataset.testid = 'support-link-patient-btn';
          btn.href = url;
          btn.target = '_blank';
          btn.rel = 'noopener noreferrer';
          btn.textContent = 'More info \u2197';
          row.appendChild(btn);
        }
      } else {
        // Builder preview: one 🔗 icon per link with tooltip
        for (const url of validLinks) {
          const icon = document.createElement('a');
          icon.className = 'support-link-icon';
          icon.dataset.testid = 'support-link-icon';
          icon.href = url;
          icon.target = '_blank';
          icon.rel = 'noopener noreferrer';
          icon.textContent = '\uD83D\uDD17';
          icon.dataset.tipTitle = 'Support link';
          icon.dataset.tipBody  = url;
          icon.dataset.tipFhir  = 'Questionnaire.item.extension[questionnaire-supportLink]';
          icon.dataset.tipSpec  = 'R4';
          icon.addEventListener('click', e => e.stopPropagation());
          row.appendChild(icon);
        }
      }
    }

    if (!isPatient && res.node.type === 'group' && !isEmptyGroup) {
      const isOr = res.node.logicWithParent === 'OR';
      const lb = document.createElement('span');
      lb.className = 'preview-logic-badge preview-logic-' + (isOr ? 'or' : 'and');
      lb.textContent = isOr ? 'ANY item ✓' : 'ALL items ✓';
      lb.dataset.tipTitle = isOr ? 'Any item passes (OR)' : 'All items required (AND)';
      lb.dataset.tipBody = isOr
        ? 'Group is satisfied if at least one child item has a valid answer.\nStored in FHIR as a questionnaire-constraint with key e3a8c2f1…:group-or.'
        : 'Group is satisfied only when all child items have valid answers.\nThis is the default FHIR behaviour — no extra constraint is generated.';
      lb.dataset.tipFhir = isOr ? 'questionnaire-constraint (key: ITLH_NS:group-or)' : 'item.required (default AND)';
      lb.dataset.tipSpec = 'R4';
      row.appendChild(lb);
    }

    if (res.node.type === 'item' && res.node.itemType !== 'display' && !res.node._readOnly) {
      if (res.node.mandatory === false) {
        if (!isPatient) {
          const badge = document.createElement('span');
          badge.className = 'preview-optional-badge';
          badge.dataset.testid = 'preview-optional-badge';
          badge.textContent = 'optional';
          badge.dataset.tipTitle = 'Optional field';
          badge.dataset.tipBody = 'This field is not required — the questionnaire response is valid without an answer.';
          badge.dataset.tipFhir = 'item.required: false';
          badge.dataset.tipSpec = 'R4';
          row.appendChild(badge);
        }
      } else {
        const star = document.createElement('span');
        star.className = 'preview-required-star';
        star.dataset.testid = 'preview-required-star';
        star.textContent = '*';
        star.dataset.tipTitle = 'Required field';
        star.dataset.tipBody  = 'This item is marked as required (item.required = true) and must be answered.';
        star.dataset.tipFhir  = 'Questionnaire.item.required';
        star.dataset.tipSpec  = 'R4';
        label.appendChild(star);
      }
    }

    const _visHintText = res.node._enableWhenText || res.node.enableWhenExpression;
    if (!isPatient && _visHintText) {
      const hint = document.createElement('span');
      hint.className = 'preview-condition-hint';
      hint.textContent = '\uD83D\uDC41\uFE0F ' + _visHintText;
      if (res.node.enableWhenExpression) {
        hint.classList.add('preview-condition-hint--explain');
        hint.dataset.tipTitle = 'Visibility condition';
        hint.dataset.tipBody  = 'FHIRPath: ' + res.node.enableWhenExpression + '\n\nClick to explain.';
        hint.dataset.tipFhir  = 'sdc-questionnaire-enableWhenExpression';
        hint.dataset.tipSpec  = 'SDC';
        const _expr = res.node.enableWhenExpression;
        hint.addEventListener('click', () => {
          if (_lastCtx.fp) explainModal.show(_expr, _lastCtx.fp, _lastCtx.qr, _lastCtx.env);
        });
      } else {
        hint.dataset.tipTitle = 'Visibility condition';
        hint.dataset.tipBody  = 'This item is shown only when: ' + _visHintText + '\n\nThis label is auto-generated from the enableWhen condition. To change it \u2014 edit the Show When panel in the builder.';
        hint.dataset.tipFhir  = 'Questionnaire.item.enableWhen[]';
        hint.dataset.tipSpec  = 'R4';
      }
      row.appendChild(hint);
    }

    if (!isPatient && res.node.constraint?.length) {
      const _cEnvLocal = ctx.envVars || {};
      const _constraintOk = evalConstraints(res.node, ctx.fp, ctx.qr, _cEnvLocal);
      const cb = document.createElement('span');
      cb.className = 'preview-constraint-badge' + (_constraintOk ? '' : ' preview-constraint-badge--fail');
      const _msgs = res.node.constraint.filter(c => c.severity === 'error').map(c => c.human || c.expression || c.key).filter(Boolean);
      cb.textContent = _constraintOk ? '\u26A0\uFE0F constraint' : '\u2718 constraint';
      cb.title = _msgs.length ? _msgs.join('\n') : 'questionnaire-constraint';
      cb.dataset.tipTitle = _constraintOk ? 'Has constraint' : 'Constraint: FAIL';
      cb.dataset.tipBody  = _msgs.length ? _msgs.join('\n') : 'questionnaire-constraint on this item';
      cb.dataset.tipFhir  = 'Questionnaire.item.extension[questionnaire-constraint]';
      cb.dataset.tipSpec  = 'R4';
      const _firstExpr = res.node.constraint.find(c => c.expression?.trim())?.expression;
      if (_firstExpr) {
        cb.classList.add('preview-condition-hint--explain');
        cb.dataset.tipBody += '\n\nClick to explain.';
        cb.addEventListener('click', () => {
          if (_lastCtx.fp) explainModal.show(_firstExpr, _lastCtx.fp, _lastCtx.qr, _lastCtx.env);
        });
      }
      row.appendChild(cb);
    }

    if (!isPatient && res.node._readOnly && !res.node._calculatedExpr) {
      const rb = document.createElement('span');
      rb.className = 'preview-meta-badge';
      rb.textContent = '\uD83D\uDD12 read-only';
      rb.dataset.tipTitle = 'Read-only field';
      rb.dataset.tipBody  = 'This field is marked readOnly in the FHIR Questionnaire. It cannot be edited by the user.';
      rb.dataset.tipFhir  = 'Questionnaire.item.readOnly';
      rb.dataset.tipSpec  = 'R4';
      row.appendChild(rb);
    }

    if (!isPatient && res.node._initialValue !== undefined && res.node._initialValue !== '') {
      const ib = document.createElement('span');
      ib.className = 'preview-meta-badge preview-meta-badge--init';
      ib.textContent = '\u21BA default';
      ib.dataset.tipTitle = 'Has default value';
      ib.dataset.tipBody  = 'Pre-filled from Questionnaire.item.initial[]. User can change it unless the field is readOnly.';
      ib.dataset.tipFhir  = 'Questionnaire.item.initial[]';
      ib.dataset.tipSpec  = 'R4';
      row.appendChild(ib);
    }

    if (res.node.type === 'item') {
      if (res.node.itemType !== 'display' && !res.node._readOnly && !res.node._calculatedExpr) {
        if (res.node.repeats && res.node.itemType !== 'checkbox') {
          row.appendChild(buildRepeatControls(res.node, iconEl, () => updateGroupIcons()));
        } else {
          row.appendChild(buildControl(res.node, iconEl, () => updateGroupIcons()));
        }
      }
      // readOnly field without calculatedExpression: show value (or placeholder) as disabled-looking span
      if (res.node._readOnly && !res.node._calculatedExpr) {
        const val = getValue(res.node.id);
        const vb = document.createElement('span');
        vb.className = 'preview-readonly-value';
        vb.dataset.testid = 'preview-readonly-value';
        vb.textContent = (val !== undefined && val !== null && val !== '') ? String(val) : '\u2014';
        row.appendChild(vb);
      }
      // calc-badge: show for readOnly nodes with calculatedExpression
      if (res.node._calculatedExpr && res.node._readOnly) {
        const badge = document.createElement('span');
        badge.dataset.calcId   = res.node.id;
        badge.dataset.calcType = res.node.itemType;
        if (isPatient) {
          // Patient view: show computed value as plain readable text, no explain UI.
          const s = getValue(res.node.id);
          badge.className = 'preview-calc-value';
          badge.textContent = (s !== undefined && s !== '') ? String(s) : '\u2014';
        } else if (res.node.itemType === 'checkbox') {
          const calcVal = getValue(res.node.id);
          badge.className = 'calc-badge ' + (calcVal ? 'calc-true' : 'calc-false') + ' calc-badge--explain';
          badge.textContent = calcVal ? '\u2713 true' : '\u2717 false';
          badge.dataset.tipTitle = 'Calculated value';
          badge.dataset.tipBody  = 'FHIRPath: ' + res.node._calculatedExpr + '\n\nClick to explain.';
          badge.dataset.tipFhir  = 'sdc-questionnaire-calculatedExpression';
          badge.dataset.tipSpec  = 'SDC';
          const _expr = res.node._calculatedExpr;
          badge.addEventListener('click', () => {
            if (_lastCtx.fp) explainModal.show(_expr, _lastCtx.fp, _lastCtx.qr, _lastCtx.env);
          });
        } else {
          const s = getValue(res.node.id);
          badge.className = 'preview-calc-value';
          badge.textContent = (s !== undefined && s !== '') ? String(s) : '\u2014';
        }
        row.appendChild(badge);
      }
    }

    // Add collapse toggle for groups with children
    if (res.node.type === 'group' && res.node.children.length > 0) {
      const collapsed = collapsedGroups.has(res.node.id);
      const toggle = document.createElement('span');
      toggle.className = 'preview-collapse-toggle';
      toggle.textContent = collapsed ? '\u25B6' : '\u25BC';
      toggle.title = collapsed ? 'Expand section' : 'Collapse section';
      toggle.addEventListener('click', e => {
        e.stopPropagation();
        if (collapsedGroups.has(res.node.id)) collapsedGroups.delete(res.node.id);
        else collapsedGroups.add(res.node.id);
        _formTick.value++;
      });
      row.insertBefore(toggle, row.firstChild);
    }

    // Disable all interactive controls for hidden items (sdc-questionnaire-hidden)
    if (res.hidden && res.node.type === 'item') {
      row.querySelectorAll('input, select, textarea').forEach(el => { el.disabled = true; });
    }
    // Hidden groups: wrap header + nested in a single div so the dashed border spans the whole group
    let _appendTarget = container;
    if (res.hiddenRoot && res.node.type === 'group') {
      const hiddenWrap = document.createElement('div');
      hiddenWrap.className = 'lform-item--hidden';
      container.appendChild(hiddenWrap);
      row.classList.remove('lform-item--hidden');
      _appendTarget = hiddenWrap;
    }
    _appendTarget.appendChild(row);

    if (res.node.type === 'group' && res.node.children.length > 0) {
      const descendants = visible.filter(r =>
        r.node.type === 'item' && !r.disabled && !r.hidden && isDescendant(r.node.id, res.node)
      );
      if (iconEl) groupIconMap.set(res.node.id, { icon: iconEl, descendants, node: res.node });

      if (!collapsedGroups.has(res.node.id)) {
        const nested = document.createElement('div');
        nested.className = 'preview-nested';
        const logic = res.node.logicWithParent || 'AND';
        let firstVisible = true;
        for (const ch of res.node.children) {
          const childRes = resultMap.get(ch.id);
          // Skip hidden children when the toggle is off — prevents orphan AND/OR separators
          if (childRes && childRes.hidden && (_previewMode === 'patient' || !_viewPrefs.showHiddenItems)) continue;
          if (childRes && (childRes.visible || childRes.showDimmed)) {
            if (!firstVisible && childRes.visible) {
              const sep = document.createElement('div');
              sep.className = 'logic-separator logic-separator-' + logic.toLowerCase();
              sep.textContent = logic;
              nested.appendChild(sep);
            }
            renderPreviewNode(childRes, nested);
            if (childRes.visible) firstVisible = false;
          }
        }
        if (nested.childElementCount > 0) _appendTarget.appendChild(nested);
      }
    }
  }

  const frag = document.createDocumentFragment();
  if (visible.length === 0) {
    const msg = document.createElement('div');
    msg.className = 'preview-no-visible';
    msg.textContent = 'No visible groups/items.';
    frag.appendChild(msg);
  }

  for (const node of tree) {
    const res = resultMap.get(node.id);
    if (res) renderPreviewNode(res, frag);
  }
  lform.appendChild(frag);
  if (_scrollPanel) _scrollPanel.scrollTop = _savedScroll;

  // Restore focus to the input that was active before the DOM rebuild
  if (_focusInfo) {
    const row = lform.querySelector('[data-preview-id="' + _focusInfo.previewId + '"]');
    if (row) {
      const inputs = Array.from(row.querySelectorAll('input, textarea, select'));
      const el = inputs[_focusInfo.inputIndex];
      if (el) {
        el.focus();
        try { el.setSelectionRange(_focusInfo.selStart, _focusInfo.selEnd); } catch (_) { /* non-text inputs throw — ignore */ }
      }
    }
  }

  function updateGroupIcons() {
    for (const [, { icon, descendants, node }] of groupIconMap.entries()) {
      const relevant = descendants.filter(r =>
        (isMandatory(r.node) && CHECKABLE_TYPES.has(r.node.itemType)) ||
        (r.node._calculatedExpr && r.node._readOnly && r.node.itemType === 'checkbox') ||
        r.node.constraint?.length > 0 ||
        (r.node._minValue !== undefined || r.node._maxValue !== undefined)
      );
      if (relevant.length === 0) {
        icon.className   = 'icon-ok';
        icon.textContent = '\u2713';
        continue;
      }
      const itemOk = k => k.ok && calcFormOk(k.node) && (!k.node.constraint?.length || evalConstraints(k.node, ctx.fp, ctx.qr, ctx.envVars || {}));
      const ok = node.logicWithParent === 'OR'
        ? relevant.some(itemOk)
        : relevant.every(itemOk);
      icon.className   = ok ? 'icon-ok' : 'icon-fail';
      icon.textContent = ok ? '\u2713' : '\u2717';
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
