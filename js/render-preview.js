// ── Right panel: reactive preview ─────────────────────────────────────────────
import { age, gender, bmi, pregnant, smoker, proc, comorb } from './patient.js';
import {
  effect,
  tree, values, autoFilledIds, _formTick, _bulkUpdate, showLinkId, showPrefix,
  evalRule, calcFormOk, isMandatory,
  rawFhir, calcTested, CHECKABLE_TYPES
} from './state.js';
import { isDescendant } from './utils.js';
import { evaluateNode } from './eval.js';
import { buildQR } from './fhir/qr-builder.js';
import { evalCalcNodes } from './fhir/calc.js';
import { buildControl as _buildControl } from './controls/index.js';
import * as search from './ui/search.js';

const fhirpath = window.fhirpath;

// Persists across re-renders (not reactive)
const collapsedGroups = new Set();

function _reCalc() {
  if (calcTested.value && rawFhir.value && fhirpath) {
    const qr = buildQR(JSON.parse(JSON.stringify(rawFhir.value)), values);
    evalCalcNodes(tree, qr, fhirpath, values);
  }
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

  return _buildControl(node, { values, autoFilledIds, onChange, _reCalc, _formTick });
}

// ── Reactive preview effect ───────────────────────────────────────────────────
// effect() re-runs when tree structure, patient data, or node config changes.
// Form value changes (user typing) are handled imperatively via updateIcon()
// inside buildControl — no effect re-run needed.
effect(() => {
  void _formTick.value; // subscribe: re-run when checkbox/select changes
  if (_bulkUpdate.value) return; // mass mutation in progress — skip full render
  const ctx = {
    age:      age.value,
    gender:   gender.value,
    bmi:      bmi.value,
    pregnant: pregnant.value,
    smoker:   smoker.value,
    proc:     proc.value,
    comorb:   comorb.value.toLowerCase()
  };
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
    const _fr = document.getElementById('finalResult');
    _fr.innerHTML = '';
    _fr.className = 'final-result';
    _fr.style.display = 'none';
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
    isMandatory(r.node) && (
      r.node.successValue !== '' ||
      CHECKABLE_TYPES.has(r.node.itemType)
    )
  );
  const hasMandatory = mandatoryItems.length > 0;

  // calc nodes: visible, non-disabled items with a calculatedExpression
  const calcItems = visible.filter(r => !r.disabled && r.node.type === 'item' && r.node._calculatedExpr && r.node._readOnly && r.node.itemType === 'checkbox');
  const hasCalc = calcTested.value && calcItems.length > 0;
  const calcAllOk = calcItems.every(r => values[r.node.id] === true);

  const formItemsOk = visible.filter(r => !r.disabled).every(res => {
    if (res.node.type === 'item') return res.ok && calcFormOk(res.node);
    return res.ok;
  });
  let finalOk = (hasMandatory ? formItemsOk : true) && (hasCalc ? calcAllOk : true) && (hasMandatory || hasCalc);

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
      hint.textContent = '\uD83D\uDD12 ' + res.node._enableWhenText;
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
        (isMandatory(r.node) && r.node.successValue !== '') ||
        (isMandatory(r.node) && CHECKABLE_TYPES.has(r.node.itemType)) ||
        (r.node._calculatedExpr && r.node._readOnly && r.node.itemType === 'checkbox' && calcTested.value)
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
      // - has explicit successValue, OR
      // - is mandatory checkable type (must be filled/valid), OR
      // - is optional URL (format validation always applies), OR
      // - is a readOnly boolean calc node after Test
      hasCondition = res.node.itemType !== 'display' && (
        (isMandatory(res.node) && res.node.successValue !== '') ||
        (CHECKABLE_TYPES.has(res.node.itemType) && (isMandatory(res.node) || res.node.itemType === 'url')) ||
        (res.node._calculatedExpr && res.node._readOnly && res.node.itemType === 'checkbox' && calcTested.value)
      );
      displayOk    = res.ok && calcFormOk(res.node);
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
    idTag.title = 'FHIR linkId \u2014 use as: values[\'' + res.node.id + '\']';
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

    if (res.node.type === 'item' && res.node.itemType !== 'display' && !(res.node._readOnly && res.node._calculatedExpr)) {
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

    if (res.node._enableWhenText) {
      const hint = document.createElement('span');
      hint.className = 'preview-condition-hint';
      hint.title = 'Visible when: ' + res.node._enableWhenText;
      hint.textContent = '\uD83D\uDC41\uFE0F ' + res.node._enableWhenText;
      row.appendChild(hint);
    }

    if (res.node.type === 'item') {
      if (res.node.itemType === 'checkbox' && res.node.conditionRule) {
        if (values[res.node.id] === undefined || autoFilledIds.has(res.node.id)) {
          values[res.node.id] = evalRule(res.node.conditionRule, ctx);
          autoFilledIds.add(res.node.id);
        }
      }
      if (res.node.itemType !== 'display' && !(res.node._readOnly && res.node._calculatedExpr)) {
        const isAuto = autoFilledIds.has(res.node.id);
        row.appendChild(buildControl(res.node, iconEl, () => updateGroupIcons(), isAuto));
      }
      // calc-badge: show for readOnly nodes with calculatedExpression
      if (res.node._calculatedExpr && res.node._readOnly) {
        const badge = document.createElement('span');
        if (res.node.itemType === 'checkbox') {
          // Boolean calc: show ⚡/✓/✗
          if (!calcTested.value) {
            badge.className = 'calc-badge';
            badge.textContent = '\u26A1 pending';
          } else {
            const calcVal = values[res.node.id];
            badge.className = 'calc-badge ' + (calcVal ? 'calc-true' : 'calc-false');
            badge.textContent = calcVal ? '\u2713 true' : '\u2717 false';
          }
        } else {
          // String calc: show the computed value
          badge.className = 'calc-badge';
          const strVal = calcTested.value ? (values[res.node.id] || '—') : '\u26A1 pending';
          badge.textContent = strVal;
          if (calcTested.value && values[res.node.id]) badge.className = 'calc-badge calc-true';
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
        (isMandatory(r.node) && r.node.successValue !== '') ||
        (isMandatory(r.node) && CHECKABLE_TYPES.has(r.node.itemType)) ||
        (r.node._calculatedExpr && r.node._readOnly && r.node.itemType === 'checkbox' && calcTested.value)
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

  const finalEl = document.getElementById('finalResult');
  if (!anyVisible) {
    finalEl.style.display = 'none';
    finalEl.className = 'final-result';
  } else if (!hasMandatory && !hasCalc) {
    finalEl.style.display = 'block';
    finalEl.textContent = '— No required fields defined';
    finalEl.className = 'final-result';
  } else {
    finalEl.style.display = 'block';
    finalEl.textContent = (finalOk ? '✓ PASS' : '✗ FAIL') + ' — ' + (finalOk ? 'All criteria met' : 'Criteria not met');
    finalEl.className = 'final-result ' + (finalOk ? 'pass' : 'fail');
  }
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
