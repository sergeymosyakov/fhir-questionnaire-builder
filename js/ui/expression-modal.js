// ── Expression / Init-Expression edit modal ───────────────────────────────────
// Single config-driven modal for both FHIRPath expression field types.
// Uses draft pattern — changes committed only on Apply; Cancel discards.
//
// init(elements)
//   elements: { modal, title, body, closeBtn, cancelBtn, applyBtn }
//
// open(cfg)
//   cfg: {
//     node,        — tree node being edited
//     link,        — action link DOM element (for setActive)
//     setActive,   — (link, bool) => void
//     field,       — node property name: '_calculatedExpr' | '_initialExpr'
//     label,       — modal header label text
//     fhirLabel,   — label above the textarea (e.g. "FHIRPath calculatedExpression:")
//     hint,        — optional hint text shown above the textarea
//     placeholder, — textarea placeholder
//     onApply,     — optional callback called after draft is committed
//   }
//
// close()  — cancel (discard draft)

import { refreshExprIcons } from '../render-preview.js';
import { initModal, setModalTitle, openModal, closeModal } from './modal-base.js';

let _el      = null;
let _pending = null; // { cfg, draft }
let _ta      = null;
let _icon    = null;

export function init(elements) {
  _el = elements;
  initModal(elements, { onApply: _apply, onCancel: _cancel });
}

export function open(cfg) {
  const draft = cfg.node[cfg.field] || '';
  _pending = { cfg, draft };

  // ── Title ──────────────────────────────────────────────────────────────────
  setModalTitle(_el.title, cfg.label, cfg.node.title || cfg.node.id || 'Item');

  // ── Body ───────────────────────────────────────────────────────────────────
  _el.body.innerHTML = '';

  if (cfg.hint) {
    const hint = document.createElement('div');
    hint.className   = 'panel-hint';
    hint.textContent = cfg.hint;
    _el.body.appendChild(hint);
  }

  const iconRow = document.createElement('div');
  iconRow.className = 'panel-expr-lbl panel-lbl-row';
  const iconLabel = document.createElement('span');
  iconLabel.textContent = cfg.fhirLabel;
  _icon = document.createElement('span');
  _icon.className        = 'expr-live-icon';
  _icon.dataset.exprIcon = draft;
  iconRow.appendChild(iconLabel);
  iconRow.appendChild(_icon);
  _el.body.appendChild(iconRow);

  _ta = document.createElement('textarea');
  _ta.className   = 'expr-textarea';
  _ta.rows        = 4;
  _ta.value       = draft;
  _ta.placeholder = cfg.placeholder || '';

  const _resize = () => { _ta.style.height = 'auto'; _ta.style.height = _ta.scrollHeight + 'px'; };
  _ta.addEventListener('input', _resize);
  setTimeout(_resize, 0);

  _ta.oninput = () => {
    _pending.draft         = _ta.value;
    _icon.dataset.exprIcon = _ta.value.trim();
    clearTimeout(_ta._d);
    _ta._d = setTimeout(refreshExprIcons, 400);
  };

  _el.body.appendChild(_ta);
  openModal(_el.modal);
  setTimeout(() => _ta?.focus(), 50);
}

function _apply() {
  if (!_pending) return;
  const { cfg, draft } = _pending;
  const val = draft.trim() || undefined;
  cfg.node[cfg.field] = val;
  cfg.setActive(cfg.link, !!val);
  if (cfg.onApply) cfg.onApply();
  refreshExprIcons();
  _close();
}

function _cancel() { _close(); }

function _close() {
  if (_el) closeModal(_el.modal);
  _pending = null;
  _ta      = null;
  _icon    = null;
}
