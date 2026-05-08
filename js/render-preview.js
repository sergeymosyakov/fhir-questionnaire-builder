// ── Right panel: reactive preview ─────────────────────────────────────────────
import {
  effect,
  age, gender, bmi, pregnant, smoker, proc, comorb,
  testMode, tree, values, autoFilledIds, _formTick,
  evalRule, calcFormOk, isDescendant, isMandatory
} from './state.js';
import { evaluateNode } from './eval.js';

// ── Interactive control for preview ──────────────────────────────────────────
function buildControl(node, iconEl, onAfterChange, isAuto) {
  const updateOwnIcon = () => {
    if (!iconEl) return;
    const ok = calcFormOk(node);
    iconEl.className   = ok ? 'icon-ok' : 'icon-fail';
    iconEl.textContent = ok ? '\u2714' : '\u2718';
  };

  const onChange = () => {
    updateOwnIcon();
    if (onAfterChange) onAfterChange();
  };

  const wrap = document.createElement('span');
  wrap.style.cssText = 'display:inline-flex;align-items:center;gap:5px;';

  if (node.itemType === 'checkbox') {
    const el = document.createElement('input');
    el.type    = 'checkbox';
    el.checked = !!values[node.id];

    let badge = null;
    if (isAuto) {
      badge = document.createElement('span');
      badge.className = 'auto-badge';
      badge.title = 'Pre-filled from patient data. You can override.';
      badge.textContent = '\uD83E\uDD16';
    }

    el.onchange = () => {
      values[node.id] = el.checked;
      autoFilledIds.delete(node.id);
      if (badge) { badge.style.opacity = '0.35'; badge.title = 'Was pre-filled, now manually set.'; }
      onChange();
      _formTick.value++;
    };
    wrap.appendChild(el);
    if (badge) wrap.appendChild(badge);

  } else if (node.itemType === 'number') {
    const el = document.createElement('input');
    el.type = 'number'; el.style.width = '80px';
    el.value = values[node.id] !== undefined ? values[node.id] : '';
    el.oninput = () => { values[node.id] = el.value; onChange(); };
    wrap.appendChild(el);

  } else if (node.itemType === 'select') {
    const el = document.createElement('select');
    let firstOpt = null;
    for (const o of (node.options || '').split(',')) {
      const t = o.trim(); if (!t) continue;
      const opt = document.createElement('option');
      opt.value = t; opt.textContent = t;
      if (!firstOpt) firstOpt = t;
      el.appendChild(opt);
    }
    if (values[node.id] !== undefined) el.value = values[node.id];
    else if (firstOpt) { values[node.id] = firstOpt; }
    el.onchange = () => { values[node.id] = el.value; onChange(); _formTick.value++; };
    wrap.appendChild(el);

  } else {
    const el = document.createElement('input');
    el.type = 'text'; el.style.width = '120px';
    el.value = values[node.id] !== undefined ? values[node.id] : '';
    el.oninput = () => { values[node.id] = el.value; onChange(); };
    wrap.appendChild(el);
  }

  return wrap;
}

// ── Reactive preview effect ───────────────────────────────────────────────────
// effect() re-runs when tree structure, patient data, or node config changes.
// Form value changes (user typing) are handled imperatively via updateIcon()
// inside buildControl — no effect re-run needed.
effect(() => {
  void _formTick.value; // subscribe: re-run when checkbox/select changes
  const ctx = {
    age:      age.value,
    gender:   gender.value,
    bmi:      bmi.value,
    pregnant: pregnant.value,
    smoker:   smoker.value,
    proc:     proc.value,
    comorb:   comorb.value.toLowerCase()
  };
  const tMode = testMode.value;

  const lform = document.getElementById('lform');
  lform.innerHTML = '';

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
    msg.style.cssText = 'color:#999; font-size:13px; padding:12px;';
    msg.textContent = 'No visible groups/items.';
    lform.appendChild(msg);
  }

  const mandatoryItems = visible.filter(r => !r.disabled && r.node.type === 'item' && isMandatory(r.node) && r.node.successValue !== '');
  const hasMandatory = mandatoryItems.length > 0;

  let finalOk = hasMandatory && visible.filter(r => !r.disabled).every(res => {
    if (res.node.type === 'item') return res.ok && calcFormOk(res.node);
    return res.ok;
  });

  const groupIconMap = new Map();

  function renderPreviewNode(res, container) {
    if (!res) return;
    if (!res.visible && !res.showDimmed) return;

    // Dimmed: enableWhen condition not yet met
    if (!res.visible && res.showDimmed) {
      const row = document.createElement('div');
      row.className = 'lform-item lform-waiting';
      row.dataset.previewId = res.node.id;
      row.title = 'Click to navigate to builder node';
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => {
        const target = document.querySelector('[data-node-id="' + res.node.id + '"]');
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('node-flash');
        setTimeout(() => target.classList.remove('node-flash'), 1000);
      });
      const ph = document.createElement('span');
      ph.style.cssText = 'width:20px;flex-shrink:0;display:inline-block;';
      row.appendChild(ph);
      const label = document.createElement('span');
      label.style.color = '#aaa';
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
      row.className = 'lform-item lform-disabled';
      row.dataset.previewId = res.node.id;
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => {
        const target = document.querySelector('[data-node-id="' + res.node.id + '"]');
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('node-flash');
        setTimeout(() => target.classList.remove('node-flash'), 1000);
      });
      const naIcon = document.createElement('span');
      naIcon.className = 'icon-na';
      naIcon.textContent = '\u2014';
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
      if (descendantItems.length === 0) {
        hasCondition = false;
        displayOk    = true;
      } else {
        hasCondition = true;
        const itemOk = k => k.ok && calcFormOk(k.node);
        displayOk = res.node.logicWithParent === 'OR'
          ? descendantItems.some(itemOk)
          : descendantItems.every(itemOk);
      }
    } else {
      hasCondition = res.node.itemType !== 'display' && isMandatory(res.node) && res.node.successValue !== '';
      displayOk    = res.ok && calcFormOk(res.node);
    }

    const row = document.createElement('div');
    row.className = 'lform-item';
    row.dataset.previewId = res.node.id;
    if (tMode) row.classList.add(displayOk ? 'success' : 'error');
    row.title = 'Click to navigate to builder node';
    row.style.cursor = 'pointer';
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
      ph.style.cssText = 'width:20px; flex-shrink:0; display:inline-block;';
      row.appendChild(ph);
    }
    res._iconEl = iconEl;

    const isEmptyGroup = res.node.type === 'group' && res.node.children.length === 0;

    const idTag = document.createElement('span');
    idTag.className = 'preview-linkid';
    idTag.textContent = res.node.id;
    idTag.title = 'FHIR linkId — use as: values[\'' + res.node.id + '\']';
    row.appendChild(idTag);

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
      if (res.node.itemType !== 'display') {
        const isAuto = autoFilledIds.has(res.node.id);
        row.appendChild(buildControl(res.node, iconEl, () => updateGroupIcons(), isAuto));
      }
    }

    container.appendChild(row);

    if (res.node.type === 'group' && res.node.children.length > 0) {
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

      const descendants = visible.filter(r =>
        r.node.type === 'item' && !r.disabled && isDescendant(r.node.id, res.node)
      );
      if (iconEl) groupIconMap.set(res.node.id, { icon: iconEl, descendants, node: res.node });
    }
  }

  for (const node of tree) {
    const res = resultMap.get(node.id);
    if (res) renderPreviewNode(res, lform);
  }

  function updateGroupIcons() {
    for (const [, { icon, descendants, node }] of groupIconMap.entries()) {
      if (descendants.length === 0) continue;
      const itemOk = k => k.ok && calcFormOk(k.node);
      const ok = node.logicWithParent === 'OR'
        ? descendants.some(itemOk)
        : descendants.every(itemOk);
      icon.className   = ok ? 'icon-ok' : 'icon-fail';
      icon.textContent = ok ? '\u2714' : '\u2718';
    }
  }

  const finalEl = document.getElementById('finalResult');
  if (!anyVisible) {
    finalEl.style.display = 'none';
    finalEl.className = 'final-result';
  } else if (!hasMandatory) {
    finalEl.style.display = 'block';
    finalEl.textContent = '— No required fields defined';
    finalEl.className = 'final-result';
  } else {
    finalEl.style.display = 'block';
    finalEl.textContent = (finalOk ? '✓ PASS' : '✗ FAIL') + ' — ' + (finalOk ? 'All required fields complete' : 'Required fields incomplete');
    finalEl.className = 'final-result ' + (finalOk ? 'pass' : 'fail');
  }
});
