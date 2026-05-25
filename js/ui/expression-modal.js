import { MODAL_REGISTRY } from './modal-registry.js';
// ── Expression / Init-Expression edit modal ───────────────────────────────────
// Two modes:
//   open(cfg)                             — single-field mode (groups: calculatedExpression only)
//   openDual(node, link, setActive, cb)   — dual-field mode (items: calc + init in one modal)
//
// init(elements)
//   elements: { modal, title, body, closeBtn, cancelBtn, applyBtn }
//
// open(cfg)
//   cfg: { node, link, setActive, field, label, fhirLabel, hint, placeholder, onApply }
//
// openDual(node, link, setActive, onApply)

import { refreshExprIcons } from '../render-preview.js';
import { initModal, setModalTitle, openModal, closeModal } from './modal-base.js';

let _el      = null;
let _pending = null; // { mode: 'single'|'dual', ... }

export function init(elements) {
  _el = elements;
  initModal(elements, { onApply: _apply, onCancel: _cancel });
}

// ── Single-field mode (groups: only calculatedExpression) ─────────────────────

export function open(cfg) {
  _pending = { mode: 'single', cfg, draft: cfg.node[cfg.field] || '' };
  setModalTitle(_el.title, cfg.label, cfg.node.title || cfg.node.id || 'Item');
  _el.body.innerHTML = '';
  _buildSingleBody(cfg, _pending);
  openModal(_el.modal);
  setTimeout(() => _el.body.querySelector('textarea')?.focus(), 50);
}

// ── Dual-field mode (items: calculatedExpression + initialExpression) ─────────

export function openDual(node, link, setActive, onApply) {
  _pending = {
    mode:     'dual',
    node, link, setActive, onApply,
    calcExpr: node._calculatedExpr || '',
    initExpr: node._initialExpr   || '',
  };
  setModalTitle(_el.title, 'FHIRPath Expressions', node.title || node.id || 'Item');
  _el.body.innerHTML = '';
  _buildDualBody(_pending);
  openModal(_el.modal);
  setTimeout(() => _el.body.querySelector('textarea')?.focus(), 50);
}

// ── Apply / Cancel ────────────────────────────────────────────────────────────

function _apply() {
  if (!_pending) return;
  if (_pending.mode === 'single') {
    const { cfg, draft } = _pending;
    const val = draft.trim() || undefined;
    cfg.node[cfg.field] = val;
    cfg.setActive(cfg.link, !!val);
    if (cfg.onApply) cfg.onApply();
  } else {
    const { node, link, setActive, onApply, calcExpr, initExpr } = _pending;
    node._calculatedExpr = calcExpr.trim() || undefined;
    node._initialExpr    = initExpr.trim() || undefined;
    setActive(link, !!(node._calculatedExpr || node._initialExpr));
    if (onApply) onApply();
  }
  refreshExprIcons();
  _close();
}

function _cancel() { _close(); }

function _close() {
  if (_el) closeModal(_el.modal);
  _pending = null;
}

// ── Body builders ─────────────────────────────────────────────────────────────

function _makeExprField(labelText, exprValue, testid, placeholder, onInput, container) {
  const iconRow = document.createElement('div');
  iconRow.className = 'panel-expr-lbl panel-lbl-row';
  const lbl = document.createElement('span');
  lbl.textContent = labelText;
  const icon = document.createElement('span');
  icon.className        = 'expr-live-icon';
  icon.dataset.exprIcon = exprValue;
  iconRow.appendChild(lbl);
  iconRow.appendChild(icon);
  container.appendChild(iconRow);

  const ta = document.createElement('textarea');
  ta.className   = 'expr-textarea';
  ta.rows        = 3;
  ta.value       = exprValue;
  ta.placeholder = placeholder || '';
  if (testid) ta.dataset.testid = testid;

  const _resize = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
  ta.addEventListener('input', _resize);
  setTimeout(_resize, 0);

  ta.oninput = () => {
    icon.dataset.exprIcon = ta.value.trim();
    clearTimeout(ta._d);
    ta._d = setTimeout(refreshExprIcons, 400);
    onInput(ta.value);
  };
  container.appendChild(ta);
}

function _buildSingleBody(cfg, pending) {
  if (cfg.hint) {
    const hint = document.createElement('div');
    hint.className   = 'panel-hint';
    hint.textContent = cfg.hint;
    _el.body.appendChild(hint);
  }
  _makeExprField(
    cfg.fhirLabel,
    pending.draft,
    null,
    cfg.placeholder || '',
    val => { pending.draft = val; },
    _el.body,
  );
}

function _buildDualBody(pending) {
  _makeSection(
    'Calculated Expression',
    'sdc-questionnaire-calculatedExpression',
    'Evaluated automatically on every preview render. Result is written into the answer field.',
    pending.calcExpr, 'expr-calc-ta', "%resource.item.where(linkId='...')",
    val => { pending.calcExpr = val; },
  );

  const sep = document.createElement('div');
  sep.className = 'expr-modal-sep';
  _el.body.appendChild(sep);

  _makeSection(
    'Initial Expression',
    'sdc-questionnaire-initialExpression',
    'Evaluated once on load and after clicking \u21BA Re-init in the Variables panel.',
    pending.initExpr, 'expr-init-ta', 'e.g. %age > 18 or %today',
    val => { pending.initExpr = val; },
  );
}

function _makeSection(title, fhirKey, hint, exprValue, testid, placeholder, onInput) {
  const hdr = document.createElement('div');
  hdr.className = 'expr-section-hdr';
  hdr.dataset.tipTitle = title;
  hdr.dataset.tipBody  = hint;
  hdr.dataset.tipFhir  = 'item.extension[' + fhirKey + '].valueExpression.expression';
  hdr.dataset.tipSpec  = 'SDC';
  const titleSpan = document.createElement('span');
  titleSpan.textContent = title;
  const keySpan = document.createElement('span');
  keySpan.className = 'expr-section-key';
  keySpan.textContent = fhirKey;
  hdr.appendChild(titleSpan);
  hdr.appendChild(keySpan);
  _el.body.appendChild(hdr);

  const hintEl = document.createElement('div');
  hintEl.className = 'panel-hint';
  hintEl.textContent = hint;
  _el.body.appendChild(hintEl);

  _makeExprField('FHIRPath expression:', exprValue, testid, placeholder, onInput, _el.body);
}


MODAL_REGISTRY.set('expression', { open, openDual });
