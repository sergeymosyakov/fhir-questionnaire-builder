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
  _pending = { node, styleLink, setActive, draftStyle: node._renderStyle || '', draftXhtml: node._renderXhtml || '' };

  setModalTitle(_el.title, 'Appearance', node.title || node.id || 'Item');

  _el.body.innerHTML = '';
  _renderBody(_el.body);
  openModal(_el.modal);
}

function _apply() {
  if (!_pending) return;
  const { node, styleLink, setActive } = _pending;
  node._renderStyle = _pending.draftStyle || undefined;
  node._renderXhtml  = _pending.draftXhtml  || undefined;
  setActive(styleLink, !!(node._renderStyle || node._renderXhtml));
  triggerCalcRecalc();
  _close();
}

function _cancel() { _close(); }

function _close() {
  _pending = null;
  closeModal(_el.modal);
}

// ── body renderer ─────────────────────────────────────────────────────────────

function _sectionHdr(title, tipTitle, tipBody, tipFhir, tipSpec) {
  const hdr = document.createElement('div');
  hdr.className = 'expr-section-hdr';
  const label = document.createElement('span');
  label.textContent = title;
  hdr.appendChild(label);
  const key = document.createElement('span');
  key.className = 'expr-section-key';
  key.textContent = tipFhir;
  hdr.appendChild(key);
  hdr.dataset.tipTitle = tipTitle;
  hdr.dataset.tipBody  = tipBody;
  hdr.dataset.tipFhir  = tipFhir;
  hdr.dataset.tipSpec  = tipSpec;
  return hdr;
}

function _renderBody(container) {
  // ── Style section header ─────────────────────────────────────────────────
  container.appendChild(_sectionHdr(
    'Style',
    'rendering-style',
    'Inline CSS applied to the item title in the preview.',
    '_text.extension[rendering-style]',
    'R4'
  ));

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

  // ── XHTML section ────────────────────────────────────────────────────────
  container.appendChild(_sectionHdr(
    'XHTML',
    'rendering-xhtml',
    'Rich XHTML markup for the item text. Stored for round-trip only — not rendered in preview.',
    '_text.extension[rendering-xhtml]',
    'R4'
  ));

  const xhtmlTa = document.createElement('textarea');
  xhtmlTa.className   = 'style-modal-raw-ta';
  xhtmlTa.rows        = 3;
  xhtmlTa.placeholder = 'e.g. <b>Question</b> <em>text</em>';
  xhtmlTa.value       = _pending.draftXhtml;
  xhtmlTa.dataset.testid = 'appearance-xhtml-input';
  xhtmlTa.oninput = () => { _pending.draftXhtml = xhtmlTa.value; };
  container.appendChild(xhtmlTa);
}
