// ── Preview node DOM builders ──────────────────────────────────────────────────
// Extracted from render-preview.js. Reads per-render context from _rc (render-ctx.js)
// so this module has no import dependency on render-preview.js (avoids circular refs).

import { isMandatory, calcFormOk, evalConstraints, getValue, CHECKABLE_TYPES } from '../state.js';
import { isDescendant } from '../utils.js';
import * as explainModal from '../ui/explain-modal.js';
import { _formTick } from '../render-bus.js';
import { _rc } from './render-ctx.js';

const DOMPurify = window.DOMPurify;

// Set label text: use sanitized XHTML when available, plain text otherwise.
function _setNodeLabel(el, node) {
  if (node._renderXhtml && DOMPurify) {
    el.innerHTML = DOMPurify.sanitize(node._renderXhtml);
  } else {
    el.textContent = node.title;
  }
}

// Safe allowlist for node._renderStyle — only these CSS properties are applied.
const _STYLE_ALLOWLIST = new Set(['font-weight', 'font-style', 'color', 'font-size', 'text-decoration']);
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

// Update group pass/fail icons from the current groupIconMap snapshot.
export function updateGroupIcons() {
  const { ctx, groupIconMap } = _rc;
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

// Render a single preview node (and its children) into container.
// All render-cycle state is read from _rc; module-level state from render-preview.js
// is exposed via stable refs also stored on _rc.
export function renderPreviewNode(res, container) {
  const { ctx, resultMap, cEnv: _cEnv, visible, groupIconMap } = _rc;
  if (!res) return;
  if (!res.visible && !res.showDimmed) return;

  const isPatient = _rc.previewMode === 'patient';
  // Hidden items (sdc-questionnaire-hidden): excluded in patient view and when toggle is off.
  if (res.hidden && (isPatient || !_rc.viewPrefs.showHiddenItems)) return;

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
    row.addEventListener('click', () => _rc.scrollToBuilder(res.node.id));
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
        if (_rc.lastCtx.fp) explainModal.show(_expr, _rc.lastCtx.fp, _rc.lastCtx.qr, _rc.lastCtx.env);
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
    row.addEventListener('click', () => _rc.scrollToBuilder(res.node.id));
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
    navBtn.addEventListener('click', e => { e.stopPropagation(); _rc.scrollToBuilder(res.node.id); });
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
  if (_rc.viewPrefs.showLinkId && !isPatient) row.appendChild(idTag);

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

  if (res.node._prefix && _rc.viewPrefs.showPrefix) {
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
    lb.textContent = isOr ? 'ANY item \u2713' : 'ALL items \u2713';
    lb.dataset.tipTitle = isOr ? 'Any item passes (OR)' : 'All items required (AND)';
    lb.dataset.tipBody = isOr
      ? 'Group is satisfied if at least one child item has a valid answer.\nStored in FHIR as a questionnaire-constraint with key e3a8c2f1\u2026:group-or.'
      : 'Group is satisfied only when all child items have valid answers.\nThis is the default FHIR behaviour \u2014 no extra constraint is generated.';
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
        badge.dataset.tipBody = 'This field is not required \u2014 the questionnaire response is valid without an answer.';
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
        if (_rc.lastCtx.fp) explainModal.show(_expr, _rc.lastCtx.fp, _rc.lastCtx.qr, _rc.lastCtx.env);
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
        if (_rc.lastCtx.fp) explainModal.show(_firstExpr, _rc.lastCtx.fp, _rc.lastCtx.qr, _rc.lastCtx.env);
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
        row.appendChild(_rc.buildRepeatControls(res.node, iconEl, () => updateGroupIcons()));
      } else {
        row.appendChild(_rc.buildControl(res.node, iconEl, () => updateGroupIcons()));
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
          if (_rc.lastCtx.fp) explainModal.show(_expr, _rc.lastCtx.fp, _rc.lastCtx.qr, _rc.lastCtx.env);
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
    const collapsed = _rc.collapsedGroups.has(res.node.id);
    const toggle = document.createElement('span');
    toggle.className = 'preview-collapse-toggle';
    toggle.textContent = collapsed ? '\u25B6' : '\u25BC';
    toggle.title = collapsed ? 'Expand section' : 'Collapse section';
    toggle.addEventListener('click', e => {
      e.stopPropagation();
      if (_rc.collapsedGroups.has(res.node.id)) _rc.collapsedGroups.delete(res.node.id);
      else _rc.collapsedGroups.add(res.node.id);
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

    if (!_rc.collapsedGroups.has(res.node.id)) {
      const nested = document.createElement('div');
      nested.className = 'preview-nested';
      const logic = res.node.logicWithParent || 'AND';
      let firstVisible = true;
      for (const ch of res.node.children) {
        const childRes = resultMap.get(ch.id);
        // Skip hidden children when the toggle is off — prevents orphan AND/OR separators
        if (childRes && childRes.hidden && (_rc.previewMode === 'patient' || !_rc.viewPrefs.showHiddenItems)) continue;
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
