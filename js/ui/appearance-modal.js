// ── Appearance (rendering-style) edit modal ───────────────────────────────────
// Centered modal for editing a node's _renderStyle CSS string.
// Uses a draft pattern — changes are only committed on Apply.
// Cancel discards all edits.
//
// init(elements)                       — wire DOM once at startup
// open(node, styleLink, setActive)     — populate body + show

import { triggerCalcRecalc } from '../builder/_shared.js';
import { initModal, setModalTitle, openModal, closeModal } from './modal-base.js';

let _el      = null;
let _pending = null; // { node, styleLink, setActive, draftStyle }

// ── helpers ───────────────────────────────────────────────────────────────────

function _parseStyle(s) {
  return {
    bold:   /font-weight\s*:\s*bold/i.test(s),
    italic: /font-style\s*:\s*italic/i.test(s),
    color:  (s.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i) || [])[1]?.trim() || '',
  };
}

function _buildStyle(bold, italic, color) {
  const parts = [];
  if (bold)   parts.push('font-weight: bold');
  if (italic) parts.push('font-style: italic');
  if (color)  parts.push('color: ' + color);
  return parts.join('; ');
}

// ── module API ────────────────────────────────────────────────────────────────

export function init(elements) {
  _el = elements;
  initModal(elements, { onApply: _apply, onCancel: _cancel });
}

export function open(node, styleLink, setActive) {
  _pending = { node, styleLink, setActive, draftStyle: node._renderStyle || '' };

  setModalTitle(_el.title, 'Appearance', node.title || node.id || 'Item');

  _el.body.innerHTML = '';
  _renderBody(_el.body);
  openModal(_el.modal);
}

function _apply() {
  if (!_pending) return;
  const { node, styleLink, setActive } = _pending;
  node._renderStyle = _pending.draftStyle || undefined;
  setActive(styleLink, !!node._renderStyle);
  triggerCalcRecalc();
  _close();
}

function _cancel() { _close(); }

function _close() {
  _pending = null;
  closeModal(_el.modal);
}

// ── body renderer ─────────────────────────────────────────────────────────────

function _renderBody(container) {
  const hint = document.createElement('div');
  hint.className   = 'panel-hint';
  hint.textContent = 'Inline CSS applied to the item title in the preview. Stored in rendering-style extension.';
  container.appendChild(hint);

  const form = document.createElement('div');
  form.className = 'appearance-modal-form';
  container.appendChild(form);

  const cur = _parseStyle(_pending.draftStyle);

  // ── bold ──────────────────────────────────────────────────────────────────
  const boldCb   = Object.assign(document.createElement('input'), { type: 'checkbox', checked: cur.bold,   id: '_am_bold'   });
  const italicCb = Object.assign(document.createElement('input'), { type: 'checkbox', checked: cur.italic, id: '_am_italic' });

  // ── color ─────────────────────────────────────────────────────────────────
  const colorInp = Object.assign(document.createElement('input'), {
    type: 'color',
    value: cur.color?.startsWith('#') ? cur.color : '#000000',
    className: 'panel-color-inp',
  });
  const colorClear = Object.assign(document.createElement('button'), {
    type: 'button', textContent: '\u2715',
    className: 'panel-color-clear',
    title: 'Remove color',
  });
  let _colorCleared = !cur.color;

  // ── raw CSS textarea ──────────────────────────────────────────────────────
  const rawTa = document.createElement('textarea');
  rawTa.className   = 'style-modal-raw-ta';
  rawTa.rows        = 1;
  rawTa.placeholder = 'e.g. font-weight: bold; color: blue';
  rawTa.value       = _pending.draftStyle;
  rawTa.dataset.testid = 'appearance-raw-input';

  // ── sync helpers ──────────────────────────────────────────────────────────
  const syncFromWidgets = () => {
    const color = _colorCleared ? '' : colorInp.value;
    const s = _buildStyle(boldCb.checked, italicCb.checked, color);
    _pending.draftStyle = s;
    rawTa.value = s;
  };

  const syncFromRaw = () => {
    _pending.draftStyle = rawTa.value;
    const p2 = _parseStyle(rawTa.value);
    boldCb.checked   = p2.bold;
    italicCb.checked = p2.italic;
    if (p2.color?.startsWith('#')) { colorInp.value = p2.color; _colorCleared = false; }
    else { colorInp.value = '#000000'; _colorCleared = true; }
  };

  boldCb.onchange    = syncFromWidgets;
  italicCb.onchange  = syncFromWidgets;
  colorInp.oninput   = () => { _colorCleared = false; syncFromWidgets(); };
  colorClear.onclick = () => { _colorCleared = true; colorInp.value = '#000000'; syncFromWidgets(); };
  rawTa.oninput      = syncFromRaw;

  // ── rows ──────────────────────────────────────────────────────────────────
  const styleRow = (label, ...controls) => {
    const row = document.createElement('div');
    row.className = 'panel-style-row';
    const lbl = document.createElement('label');
    lbl.className = 'panel-style-lbl';
    lbl.textContent = label;
    row.appendChild(lbl);
    controls.forEach(c => row.appendChild(c));
    form.appendChild(row);
  };

  styleRow('Bold',   boldCb);
  styleRow('Italic', italicCb);

  const colorRow = document.createElement('div');
  colorRow.className = 'panel-style-row';
  const colorLbl = document.createElement('label');
  colorLbl.className   = 'panel-style-lbl';
  colorLbl.textContent = 'Color';
  colorRow.appendChild(colorLbl);
  colorRow.appendChild(colorInp);
  colorRow.appendChild(colorClear);
  form.appendChild(colorRow);

  const rawLbl = document.createElement('div');
  rawLbl.className   = 'panel-raw-lbl panel-raw-lbl--sm';
  rawLbl.textContent = 'raw CSS:';
  form.appendChild(rawLbl);
  form.appendChild(rawTa);
}
