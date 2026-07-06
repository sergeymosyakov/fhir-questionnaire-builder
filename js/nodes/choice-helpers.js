// ── ChoiceNode helpers ────────────────────────────────────────────────────────
// Pure option-resolution and choiceColumn rendering helpers shared by
// ChoiceNode / RadioNode / OpenChoiceNode (js/nodes/choice-node.js).
import { parseOptions, rawOptsToPairs } from '../utils.js';

// Evaluate the answer-source expression (SDC answerExpression or
// candidateExpression) against the current FHIRPath context.
// Returns [{code, display}] from the expression result, or falls back to
// node options when the expression is absent, empty, or errors.
// For external answerValueSet items, reads node._vsCache populated by
// terminologyService.expandAll() — returns [] if expansion not yet done.
export function _nodeOpts(node) {
  if (node._rawAnswerOptions) return rawOptsToPairs(node._rawAnswerOptions);
  return parseOptions(node.options);
}

export function _evalAnswerOpts(node, fpCtx) {
  const expr = node._answerExpression || node._candidateExpression;
  if (!expr) {
    if (node._answerValueSet && !node._answerValueSet.startsWith('#')) {
      return node._vsCache ?? [];
    }
    return _nodeOpts(node);
  }
  if (!fpCtx || !fpCtx.fp || !fpCtx.qr) return _nodeOpts(node);
  return _evalExpr(node, expr, fpCtx);
}

// Evaluate a FHIRPath answer-source expression (answerExpression /
// candidateExpression) and map each result item to a {code, display} option.
// Falls back to the node's static options when the result is empty or errors.
function _evalExpr(node, expr, fpCtx) {
  try {
    const raw = fpCtx.fp.evaluate(fpCtx.qr, expr, fpCtx.env || {});
    if (!raw || !raw.length) return _nodeOpts(node);
    return raw.map(v => {
      if (v === null || v === undefined) return null;
      if (typeof v === 'string')  return { code: v, display: v };
      if (typeof v === 'number')  return { code: String(v), display: String(v) };
      if (typeof v === 'boolean') return { code: String(v), display: v ? 'Yes' : 'No' };
      if (typeof v === 'object') {
        if (v.code  !== undefined) return { code: String(v.code),  display: v.display || String(v.code) };
        if (v.value !== undefined) return { code: String(v.value), display: v.display || String(v.value) };
      }
      return { code: String(v), display: String(v) };
    }).filter(Boolean);
  } catch {
    return _nodeOpts(node);
  }
}

// ── choiceColumn helpers ──────────────────────────────────────────────────────
// Resolve a choiceColumn path against a raw answer option or {code, display}.
// For valueCoding options the path addresses Coding properties (code, display, system).
export function _resolveColValue(rawOpt, code, display, path) {
  if (rawOpt) {
    const obj = rawOpt.valueCoding || rawOpt.valueReference || rawOpt;
    if (obj && obj[path] !== undefined) return String(obj[path]);
  }
  // Fallback: match path to the {code, display} pair
  if (path === 'code')    return code;
  if (path === 'display') return display || '';
  return '';
}

// Find the raw answerOption that corresponds to a given code value.
export function _findRawOpt(node, code) {
  if (!node._rawAnswerOptions) return null;
  return node._rawAnswerOptions.find(o => {
    const c = o.valueCoding || o.valueReference;
    if (c && (c.code === code || c.reference === code)) return true;
    if (o.valueString === code) return true;
    if (o.valueInteger !== undefined && String(o.valueInteger) === code) return true;
    if (o.valueDate === code) return true;
    if (o.valueTime === code) return true;
    return false;
  }) || null;
}

// Get the display text using the forDisplay column if choiceColumns is set.
export function _getColDisplayLabel(node, code, displayFallback) {
  if (!node._choiceColumns || !node._choiceColumns.length) return displayFallback;
  const fdCol = node._choiceColumns.find(c => c.forDisplay);
  if (!fdCol) return displayFallback;
  const rawOpt = _findRawOpt(node, code);
  const val = _resolveColValue(rawOpt, code, displayFallback, fdCol.path);
  return val || displayFallback;
}

// Build a multi-column header row.
export function _buildColHeader(columns) {
  const row = document.createElement('div');
  row.className = 'oc-col-header';
  for (const col of columns) {
    const cell = document.createElement('span');
    cell.className = 'oc-col-cell';
    cell.textContent = col.label || col.path;
    if (col.width) cell.style.width = col.width.value + (col.width.unit || col.width.code || '%');
    row.appendChild(cell);
  }
  return row;
}

// Build a multi-column option row.
export function _buildColRow(columns, rawOpt, code, display) {
  const row = document.createElement('div');
  row.className = 'oc-opt oc-col-row';
  for (const col of columns) {
    const cell = document.createElement('span');
    cell.className = 'oc-col-cell';
    cell.textContent = _resolveColValue(rawOpt, code, display, col.path);
    if (col.width) cell.style.width = col.width.value + (col.width.unit || col.width.code || '%');
    row.appendChild(cell);
  }
  return row;
}

/** Append weight badge and answerMedia image/audio/video to a choice label. */
export function _appendOptionExtras(lbl, node, code) {
  if (node._optionWeights && node._optionWeights[code] !== undefined) {
    const w = document.createElement('span');
    w.className = 'option-weight';
    w.textContent = '\u00A0[w:' + node._optionWeights[code] + ']';
    w.dataset.tipTitle = 'Item weight';
    w.dataset.tipBody  = 'Scoring weight for this answer option (itemWeight).';
    w.dataset.tipFhir  = 'answerOption.extension[itemWeight].valueDecimal';
    w.dataset.tipSpec  = 'SDC';
    lbl.appendChild(w);
  }
  if (node._answerMedias && node._answerMedias[code]) {
    const att = node._answerMedias[code];
    const ct = att.contentType || '';
    const el = ct.startsWith('audio/')
      ? Object.assign(document.createElement('audio'), { src: att.url, controls: true })
      : ct.startsWith('video/')
        ? Object.assign(document.createElement('video'), { src: att.url, controls: true, style: 'max-width:200px;max-height:120px' })
        : Object.assign(document.createElement('img'), { src: att.url, alt: att.title || '', style: 'max-width:120px;max-height:80px;vertical-align:middle;margin-left:6px' });
    el.className = 'preview-answer-media';
    lbl.appendChild(el);
  }
}
