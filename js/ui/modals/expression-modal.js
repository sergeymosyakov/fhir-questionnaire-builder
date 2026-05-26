// ── Expression / Init-Expression edit modal ───────────────────────────────────
// Two modes:
//   open(cfg)                             — single-field (groups: calculatedExpression only)
//   openDual(node, link, setActive, cb)   — dual-field (items: calc + init in one modal)
import { MODAL_REGISTRY } from './modal-registry.js';
import { refreshExprIcons } from '../../render-preview.js';
import { initModal, setModalTitle, openModal, closeModal } from './modal-base.js';
import { EXPR_SECTIONS, makeExprField, renderExprSections } from './expression-sections/index.js';

let _el      = null;
let _pending = null;

export function init(elements) {
  _el = elements;
  initModal(elements, { onApply: _apply, onCancel: _cancel });
}

export function open(cfg) {
  _pending = { mode: 'single', cfg, draft: cfg.node[cfg.field] || '' };
  setModalTitle(_el.title, cfg.label, cfg.node.title || cfg.node.id || 'Item');
  _el.body.innerHTML = '';
  if (cfg.hint) {
    const hint = document.createElement('div');
    hint.className   = 'panel-hint';
    hint.textContent = cfg.hint;
    _el.body.appendChild(hint);
  }
  _el.body.appendChild(makeExprField(
    cfg.fhirLabel, _pending.draft, null, cfg.placeholder || '',
    val => { _pending.draft = val; },
  ));
  openModal(_el.modal);
  setTimeout(() => _el.body.querySelector('textarea')?.focus(), 50);
}

export function openDual(node, link, setActive, onApply) {
  _pending = { mode: 'dual', node, link, setActive, onApply,
    ...Object.assign({}, ...EXPR_SECTIONS.map(s => s.initPending(node))) };
  setModalTitle(_el.title, 'FHIRPath Expressions', node.title || node.id || 'Item');
  renderExprSections(_el.body, _pending);
  openModal(_el.modal);
  setTimeout(() => _el.body.querySelector('textarea')?.focus(), 50);
}

function _apply() {
  if (!_pending) return;
  if (_pending.mode === 'single') {
    const { cfg, draft } = _pending;
    const val = draft.trim() || undefined;
    cfg.node[cfg.field] = val;
    cfg.setActive(cfg.link, !!val);
    if (cfg.onApply) cfg.onApply();
  } else {
    const { node, link, setActive, onApply } = _pending;
    EXPR_SECTIONS.forEach(s => s.commit(_pending, node));
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

MODAL_REGISTRY.set('expression', { open, openDual });
