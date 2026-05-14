// ── Right panel: reactive preview ─────────────────────────────────────────────
import {
  effect,
  tree, values, _formTick, _bulkUpdate, showLinkId, showPrefix,
  calcFormOk, isMandatory,
  rawFhir, questVariables, CHECKABLE_TYPES
} from './state.js';
import { isDescendant, findAncestorGroupIds } from './utils.js';
import { evaluateNode } from './eval.js';
import { evalConstraints } from './state.js';
import { buildQR } from './fhir/qr-builder.js';
import { evalCalcNodes, buildVarEnv } from './fhir/calc.js';
import { buildControl as _buildControl } from './controls/index.js';
import * as search from './ui/search.js';
import * as statusBadge from './ui/status-badge.js';

const fhirpath = window.fhirpath;

// Persists across re-renders (not reactive)
const collapsedGroups = new Set();

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

function _scrollToPreview(id) {
  const target = document.querySelector('[data-preview-id="' + id + '"]');
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.classList.add('preview-flash');
  setTimeout(() => target.classList.remove('preview-flash'), 1000);
}

function _reCalc() {
  if (fhirpath) {
    const base = rawFhir.value ? JSON.parse(JSON.stringify(rawFhir.value)) : { resourceType: 'Questionnaire', item: [] };
    const qr = buildQR(base, values);
    const envVars = buildVarEnv(questVariables, qr, fhirpath);
    evalCalcNodes(tree, qr, fhirpath, values, envVars);
    return { fp: fhirpath, qr, envVars };
  }
  return { fp: null, qr: null, envVars: {} };
}

// Update all visible calc-badge elements from current values[] without a full DOM rebuild.
function refreshCalcBadges() {
  document.querySelectorAll('[data-calc-id]').forEach(badge => {
    const id   = badge.dataset.calcId;
    const type = badge.dataset.calcType;
    if (type === 'checkbox') {
      const v = values[id];
      badge.className   = 'calc-badge ' + (v ? 'calc-true' : 'calc-false');
      badge.textContent = v ? '\u2713 true' : '\u2717 false';
    } else {
      const s = values[id];
      badge.className   = 'calc-badge' + (s !== undefined && s !== '' ? ' calc-true' : '');
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
    iconEl.textContent = ok ? '\u2714' : '\u2718';
  };
  const onChange = () => { updateOwnIcon(); if (onAfterChange) onAfterChange(); };

  // Wrap _reCalc so calc badges update in-place after every oninput.
  const reCalcAndRefresh = () => { _reCalc(); refreshCalcBadges(); };

  return _buildControl(node, { values, onChange, _reCalc: reCalcAndRefresh, _formTick });
}

// ── Reactive preview effect ───────────────────────────────────────────────────
// effect() re-runs when tree structure, patient data, or node config changes.
// Form value changes (user typing) are handled imperatively via updateIcon()
// inside buildControl — no effect re-run needed.
effect(() => {
  void _formTick.value; // subscribe: re-run when checkbox/select changes
  if (_bulkUpdate.value) return; // mass mutation in progress — skip full render
  const ctx = _reCalc(); // evaluate calcExpression fields; get fp/qr/envVars for enableWhen
  const lform = document.getElementById('lform');
  lform.innerHTML = '';

  if (tree.length === 0) {
    const placeholder = document.createElement('div');
    placeholder.className = 'preview-placeholder';
    placeholder.innerHTML =
      '<div class="preview-placeholder-icon">📋</div>' +
      '<div class="preview-placeholder-title">No questionnaire loaded</div>' +
      '<div class="preview-placeholder-hint">Use <strong>⬆ Load ▾</strong> to open a sample or upload your own FHIR R4 Questionnaire JSON,<br>or build one from scratch using <strong>+ Add Root Group</strong> in the left panel.</div>';
    lform.appendChild(placeholder);
    statusBadge.update({ anyVisible: false, hasCriteria: false, finalOk: false, failingItems: [] });
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

  if (visible.length === 0) {
    const msg = document.createElement('div');
    msg.className = 'preview-no-visible';
    msg.textContent = 'No visible groups/items.';
    lform.appendChild(msg);
  }

  const mandatoryItems = visible.filter(r => !r.disabled && r.node.type === 'item' &&
    isMandatory(r.node) && CHECKABLE_TYPES.has(r.node.itemType)
  );
  const hasMandatory = mandatoryItems.length > 0;

  // calc nodes: visible, non-disabled items with a calculatedExpression
  const calcItems = visible.filter(r => !r.disabled && r.node.type === 'item' && r.node._calculatedExpr && r.node._readOnly && r.node.itemType === 'checkbox');
  const hasCalc = calcItems.length > 0;
  const calcAllOk = calcItems.every(r => values[r.node.id] === true);

  // constraint items: visible, non-disabled items with questionnaire-constraint[]
  const _cEnv = ctx.envVars || {};
  const constraintItems = visible.filter(r => !r.disabled && r.node.type === 'item' && r.node.constraint?.length);
  const hasConstraints = constraintItems.length > 0;
  const constraintsAllOk = constraintItems.every(r => evalConstraints(r.node, ctx.fp, ctx.qr, _cEnv));

  const formItemsOk = visible.filter(r => !r.disabled).every(res => {
    if (res.node.type === 'item') return res.ok && calcFormOk(res.node);
    return res.ok;
  });
  let finalOk = (hasMandatory ? formItemsOk : true) && (hasCalc ? calcAllOk : true) &&
    (!hasConstraints || constraintsAllOk) &&
    (hasMandatory || hasCalc || hasConstraints);
  const failingItems = [
    ...mandatoryItems.filter(r => !r.ok || !calcFormOk(r.node)).map(r => ({ title: r.node.title, id: r.node.id })),
    ...calcItems.filter(r => values[r.node.id] !== true).map(r => ({ title: r.node.title, id: r.node.id })),
    ...constraintItems.filter(r => !evalConstraints(r.node, ctx.fp, ctx.qr, _cEnv)).map(r => ({ title: r.node.title, id: r.node.id }))
  ];

  const groupIconMap = new Map();

  function renderPreviewNode(res, container) {
    if (!res) return;
    if (!res.visible && !res.showDimmed) return;

    // Dimmed: enableWhen condition not yet met
    if (!res.visible && res.showDimmed) {
      const row = document.createElement('div');
      row.className = 'lform-item lform-waiting preview-row--pointer';
      row.dataset.previewId = res.node.id;
      row.title = 'Click to navigate to builder node';
      row.addEventListener('click', () => {
        const target = document.querySelector('[data-node-id="' + res.node.id + '"]');
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('node-flash');
        setTimeout(() => target.classList.remove('node-flash'), 1000);
      });
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
      row.appendChild(hint);
      container.appendChild(row);
      return;
    }

    // Disabled: group conditionRule not met → N/A
    if (res.disabled) {
      const row = document.createElement('div');
      row.className = 'lform-item lform-disabled preview-row--pointer';
      row.dataset.previewId = res.node.id;
      row.addEventListener('click', () => {
        const target = document.querySelector('[data-node-id="' + res.node.id + '"]');
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('node-flash');
        setTimeout(() => target.classList.remove('node-flash'), 1000);
      });
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
        r.node.type === 'item' && !r.disabled && isDescendant(r.node.id, res.node)
      );
      // Only count items that actually have a checkable condition right now
      const relevantItems = descendantItems.filter(r =>
        (isMandatory(r.node) && CHECKABLE_TYPES.has(r.node.itemType)) ||
        (r.node._calculatedExpr && r.node._readOnly && r.node.itemType === 'checkbox')
      );
      if (relevantItems.length === 0) {
        hasCondition = false;
        displayOk    = true;
      } else {
        hasCondition = true;
        const itemOk = k => k.ok && calcFormOk(k.node);
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
        (res.node.constraint?.length > 0)
      );
      displayOk    = res.ok && calcFormOk(res.node) && _constraintPass;
    }

    const row = document.createElement('div');
    row.className = 'lform-item preview-row--pointer';
    row.dataset.previewId = res.node.id;
    row.title = 'Click to navigate to builder node';
    row.addEventListener('click', () => {
      const target = document.querySelector('[data-node-id="' + res.node.id + '"]');
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('node-flash');
      setTimeout(() => target.classList.remove('node-flash'), 1000);
    });

    let iconEl = null;
    if (hasCondition) {
      iconEl = document.createElement('span');
      iconEl.className   = displayOk ? 'icon-ok' : 'icon-fail';
      iconEl.textContent = displayOk ? '\u2714' : '\u2718';
      row.appendChild(iconEl);
    } else {
      const ph = document.createElement('span');
      ph.className = 'preview-icon-ph';
      row.appendChild(ph);
    }
    res._iconEl = iconEl;

    const isEmptyGroup = res.node.type === 'group' && res.node.children.length === 0;

    const idTag = document.createElement('span');
    idTag.className = 'preview-linkid';
    idTag.textContent = res.node.id;
    const _it = res.node.itemType;
    const _valExample = _it === 'checkbox' ? 'true / false'
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
    if (showLinkId.value) row.appendChild(idTag);

    if (res.node._prefix && showPrefix.value) {
      const prefixEl = document.createElement('span');
      prefixEl.className = 'preview-prefix';
      prefixEl.textContent = res.node._prefix;
      row.appendChild(prefixEl);
    }

    const label = document.createElement('span');
    if (isEmptyGroup) {
      label.className = 'display-info-label';
      label.textContent = res.node.title;
    } else if (res.node.type === 'group') {
      label.className = 'group-label';
      label.textContent = res.node.title;
    } else {
      label.textContent = res.node.title;
    }
    if (res.node._renderStyle) label.style.cssText = res.node._renderStyle;
    row.appendChild(label);

    if (res.node.type === 'group' && !isEmptyGroup) {
      const isOr = res.node.logicWithParent === 'OR';
      const lb = document.createElement('span');
      lb.className = 'preview-logic-badge preview-logic-' + (isOr ? 'or' : 'and');
      lb.textContent = isOr ? 'ANY item ✓' : 'ALL items ✓';
      lb.title = isOr
        ? 'Group passes if at least one item inside is satisfied (OR)'
        : 'Group passes only if all items inside are satisfied (AND)';
      row.appendChild(lb);
    }

    if (res.node.type === 'item' && res.node.itemType !== 'display' && !res.node._readOnly) {
      if (res.node.mandatory === false) {
        const badge = document.createElement('span');
        badge.className = 'preview-optional-badge';
        badge.textContent = 'optional';
        badge.title = 'This field is not required';
        row.appendChild(badge);
      } else {
        const star = document.createElement('span');
        star.className = 'preview-required-star';
        star.textContent = '*';
        star.title = 'Required field';
        label.appendChild(star);
      }
    }

    const _visHintText = res.node._enableWhenText || res.node.enableWhenExpression;
    if (_visHintText) {
      const hint = document.createElement('span');
      hint.className = 'preview-condition-hint';
      hint.title = 'Visible when: ' + _visHintText;
      hint.textContent = '\uD83D\uDC41\uFE0F ' + _visHintText;
      row.appendChild(hint);
    }

    if (res.node.constraint?.length) {
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
      row.appendChild(cb);
    }

    if (res.node._readOnly && !res.node._calculatedExpr) {
      const rb = document.createElement('span');
      rb.className = 'preview-meta-badge';
      rb.textContent = '\uD83D\uDD12 read-only';
      rb.dataset.tipTitle = 'Read-only field';
      rb.dataset.tipBody  = 'This field is marked readOnly in the FHIR Questionnaire. It cannot be edited by the user.';
      rb.dataset.tipFhir  = 'Questionnaire.item.readOnly';
      rb.dataset.tipSpec  = 'R4';
      row.appendChild(rb);
    }

    if (res.node._initialValue !== undefined && res.node._initialValue !== '') {
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
      if (res.node.itemType !== 'display' && !res.node._readOnly) {
        row.appendChild(buildControl(res.node, iconEl, () => updateGroupIcons()));
      }
      // plain text value for readOnly fields without a calculatedExpression
      if (res.node._readOnly && !res.node._calculatedExpr) {
        const val = values[res.node.id];
        if (val !== undefined && val !== null && val !== '') {
          const vb = document.createElement('span');
          vb.className = 'preview-readonly-value';
          vb.textContent = String(val);
          row.appendChild(vb);
        }
      }
      // calc-badge: show for readOnly nodes with calculatedExpression
      if (res.node._calculatedExpr && res.node._readOnly) {
        const badge = document.createElement('span');
        badge.dataset.calcId   = res.node.id;
        badge.dataset.calcType = res.node.itemType;
        badge.dataset.tipTitle = 'Calculated value';
        badge.dataset.tipBody  = 'Auto-computed by FHIRPath:\n' + res.node._calculatedExpr;
        badge.dataset.tipFhir  = 'sdc-questionnaire-calculatedExpression';
        badge.dataset.tipSpec  = 'SDC';
        if (res.node.itemType === 'checkbox') {
          const calcVal = values[res.node.id];
          badge.className = 'calc-badge ' + (calcVal ? 'calc-true' : 'calc-false');
          badge.textContent = calcVal ? '\u2713 true' : '\u2717 false';
        } else {
          const s = values[res.node.id];
          badge.className = 'calc-badge' + (s !== undefined && s !== '' ? ' calc-true' : '');
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

    container.appendChild(row);

    if (res.node.type === 'group' && res.node.children.length > 0) {
      const descendants = visible.filter(r =>
        r.node.type === 'item' && !r.disabled && isDescendant(r.node.id, res.node)
      );
      if (iconEl) groupIconMap.set(res.node.id, { icon: iconEl, descendants, node: res.node });

      if (!collapsedGroups.has(res.node.id)) {
        const nested = document.createElement('div');
        nested.className = 'preview-nested';
        const logic = res.node.logicWithParent || 'AND';
        let firstVisible = true;
        for (const ch of res.node.children) {
          const childRes = resultMap.get(ch.id);
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
        if (nested.childElementCount > 0) container.appendChild(nested);
      }
    }
  }

  for (const node of tree) {
    const res = resultMap.get(node.id);
    if (res) renderPreviewNode(res, lform);
  }

  function updateGroupIcons() {
    for (const [, { icon, descendants, node }] of groupIconMap.entries()) {
      const relevant = descendants.filter(r =>
        (isMandatory(r.node) && CHECKABLE_TYPES.has(r.node.itemType)) ||
        (r.node._calculatedExpr && r.node._readOnly && r.node.itemType === 'checkbox')
      );
      if (relevant.length === 0) {
        icon.className   = 'icon-ok';
        icon.textContent = '\u2714';
        continue;
      }
      const itemOk = k => k.ok && calcFormOk(k.node);
      const ok = node.logicWithParent === 'OR'
        ? relevant.some(itemOk)
        : relevant.every(itemOk);
      icon.className   = ok ? 'icon-ok' : 'icon-fail';
      icon.textContent = ok ? '\u2714' : '\u2718';
    }
  }

  statusBadge.update({ anyVisible, hasCriteria: hasMandatory || hasCalc, finalOk, failingItems });
  search.refresh();
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

document.getElementById('previewCollapseAllBtn').addEventListener('click', () => {
  for (const id of _collectGroupIds(tree)) collapsedGroups.add(id);
  _formTick.value++;
});

document.getElementById('previewExpandAllBtn').addEventListener('click', () => {
  collapsedGroups.clear();
  _formTick.value++;
});

// Dedicated effect: show collapse/expand, search, and badge toggles only when tree has content
effect(() => {
  const d = tree.length > 0 ? '' : 'none';
  document.getElementById('showLinkIdBtn').style.display = d;
  document.getElementById('showPrefixBtn').style.display = d;
  document.getElementById('previewCollapseAllBtn').style.display = d;
  document.getElementById('previewExpandAllBtn').style.display = d;
  document.getElementById('searchWrap').style.display = d;
});
