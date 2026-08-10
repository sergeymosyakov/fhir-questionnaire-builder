// ── Expression Builder modal ──────────────────────────────────────────────────
// Thin strategy dispatcher for building FHIRPath. Contract:
//   open({ tree, variables, resultKind, initialExpr, onInsert, excludeId })
// resultKind 'boolean' builds a condition; 'value' builds a number, an
// Answers→value pipeline, or a yes/no. Never writes to nodes — hands a FHIRPath
// string back via onInsert.
import { Modal } from './modal-base.js';
import { _rc } from '../../preview/render-ctx.js';
import { evalFhirpath } from '../../preview/eval-fhirpath.js';
import { BlockKind } from '../../fhir/expr-builder/model.js';
import { parseExpression } from '../../fhir/expr-builder/parse.js';
import { hasAnswer } from '../../fhir/expr-builder/value-paths.js';
import { parseExprTree } from '../../fhir/explain.js';
import { createExprTreeEditor } from './expr-tree/tree-editor.js';
import { createValueEditor } from './expr-value/value-editor.js';
import { createPipelineEditor } from './expr-pipeline/pipeline-editor.js';

const NUMERIC_TYPES = new Set(['integer', 'decimal', 'quantity']);

// A boolean/tree-shaped expression (top-level and/or/not) is best edited as a tree.
function _isBooleanTree(text) {
  if (!text) return false;
  const t = parseExprTree(text);
  return t.type === 'AND' || t.type === 'OR' || t.type === 'NOT';
}

// Flattens the tree to answerable items, tracking the ancestor linkId chain and
// which segments are nested under a parent item's answer, so references emit an
// exact path.
function flattenItems(nodes, ctx = { chain: [], at: [], parentType: 'group' }, out = []) {
  for (const n of nodes || []) {
    const segments = [...ctx.chain, n.id];
    const answerAt = [...ctx.at, ctx.parentType === 'item'];
    if (n.type === 'item' && hasAnswer(n.itemType)) {
      out.push({ id: n.id, label: n.title || n.id, itemType: n.itemType, options: n.options || '', segments, answerAt: answerAt.some(Boolean) ? answerAt : [] });
    }
    if (n.children?.length) flattenItems(n.children, { chain: segments, at: answerAt, parentType: n.type }, out);
  }
  return out;
}

class ExpressionBuilderModal extends Modal {
  getName() { return 'expressionBuilderModal'; }

  constructor() {
    super({ applyLabel: 'Apply', cancelLabel: 'Cancel', maxWidth: '660px', bodyClass: 'eb-body' });
  }

  open({ tree, variables, resultKind, initialExpr, onInsert, excludeId } = {}) {
    this._onInsert = onInsert;
    this._resultKind = resultKind || 'boolean';
    this._isValue = this._resultKind === 'value';
    this._variables = variables || [];
    const answerable = flattenItems(tree || []).filter((it) => it.id !== excludeId);
    this._allItems = answerable;
    this._items = this._isValue ? answerable.filter((it) => NUMERIC_TYPES.has(it.itemType)) : answerable;
    this._resetEditors();

    this._seedFrom(initialExpr);
    this.setTitle(this._isValue ? 'Build value' : 'Build condition');
    this._render();
    super.open();
  }

  // Two-way seed. Picks a strategy from the existing text; an empty value field
  // shows the type chooser first.
  _seedFrom(expr) {
    const text = (expr || '').trim();
    this._initialExpr = text;
    this._rawText = text;
    this._pipelineBlock = null;
    this._pendingValueEditor = null;

    if (!this._isValue) { this._strategy = 'tree'; return; }
    if (!text) { this._strategy = 'choose'; return; }
    if (_isBooleanTree(text)) { this._strategy = 'tree'; return; }

    const fp = _rc.ctx?.fp;
    const block = fp ? parseExpression(text, fp) : null;
    if (block && block.kind === BlockKind.PIPELINE) { this._strategy = 'pipeline'; this._pipelineBlock = block; return; }

    const ve = createValueEditor(this._valueEditorOpts(text));
    if (ve.seeded) { this._strategy = 'value'; this._pendingValueEditor = ve; return; }
    this._strategy = 'raw';
  }

  _valueEditorOpts(text) {
    return {
      items: this._items,
      allItems: this._allItems,
      variables: this._variables,
      fp: _rc.ctx?.fp,
      initialExpr: text,
      onChange: () => this._refreshPreview(),
      onEditAsText: (cur) => { this._rawText = cur; this._strategy = 'raw'; this._render(); },
    };
  }

  // ── Rendering ───────────────────────────────────────────────────────────────
  _render() {
    this.body.innerHTML = '';
    if (this._strategy === 'choose') { this._renderChooser(); return; }
    if (this._strategy === 'tree') this._renderTree();
    else if (this._strategy === 'pipeline') this._renderPipeline();
    else if (this._strategy === 'value') this._renderValue();
    else this._renderRaw();
    this._buildPreview();
    this._refreshPreview();
  }

  _renderChooser() {
    const note = document.createElement('div');
    note.className = 'eb-note';
    note.textContent = 'What should this expression produce?';
    this.body.appendChild(note);

    const pick = document.createElement('div');
    pick.className = 'eb-chooser';
    const opts = [
      { key: 'value', label: '\uD83D\uDD22 Number', testid: 'eb-choose-number' },
      { key: 'tree', label: '\u2714 Yes / No condition', testid: 'eb-choose-condition' },
      { key: 'pipeline', label: '\uD83C\uDFF7 Answers \u2192 value', testid: 'eb-choose-codes' },
    ];
    for (const o of opts) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'eb-chooser-btn';
      btn.textContent = o.label;
      btn.dataset.testid = o.testid;
      btn.addEventListener('click', () => { this._strategy = o.key; this._render(); });
      pick.appendChild(btn);
    }
    this.body.appendChild(pick);
  }

  _renderTree() {
    this._treeEditor = createExprTreeEditor({
      initialExpr: this._initialExpr,
      items: this._allItems,
      fp: _rc.ctx?.fp,
      onChange: () => this._refreshPreview(),
    });
    this.body.appendChild(this._treeEditor.el);
    this.body.appendChild(this._editAsTextAction('Edit whole as text'));
  }

  _renderValue() {
    this._valueEditor = this._pendingValueEditor || createValueEditor(this._valueEditorOpts(this._initialExpr));
    this._pendingValueEditor = null;
    this.body.appendChild(this._valueEditor.el);
  }

  _renderPipeline() {
    this._pipelineEditor = createPipelineEditor({
      items: this._allItems,
      initialBlock: this._pipelineBlock,
      onChange: () => this._refreshPreview(),
    });
    this.body.appendChild(this._pipelineEditor.el);
    this.body.appendChild(this._editAsTextAction('Edit as text'));
  }

  _editAsTextAction(label) {
    const actions = document.createElement('div');
    actions.className = 'eb-actions';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'eb-text-toggle';
    btn.textContent = label;
    btn.dataset.testid = 'eb-edit-as-text';
    btn.addEventListener('click', () => { this._rawText = this._currentExpr(); this._strategy = 'raw'; this._render(); });
    actions.appendChild(btn);
    return actions;
  }

  // ── Raw (text) mode ──────────────────────────────────────────────────────────
  _renderRaw() {
    const note = document.createElement('div');
    note.className = 'eb-note';
    note.dataset.testid = 'eb-raw-note';
    note.textContent = 'This expression is edited as text.';
    this.body.appendChild(note);

    this._rawInput = document.createElement('textarea');
    this._rawInput.rows = 3;
    this._rawInput.className = 'expr-textarea';
    this._rawInput.dataset.testid = 'eb-raw-input';
    this._rawInput.value = this._rawText;
    this._rawInput.placeholder = "e.g. %age > 18 and %gender = 'male'";
    this._rawInput.addEventListener('input', () => { this._rawText = this._rawInput.value; this._refreshPreview(); });
    this.body.appendChild(this._rawInput);

    const visualBtn = document.createElement('button');
    visualBtn.type = 'button';
    visualBtn.className = 'eb-text-toggle';
    visualBtn.textContent = 'Switch to visual';
    visualBtn.dataset.testid = 'eb-switch-visual';
    // Re-detect the best strategy; unmodeled text stays raw (never silently blanked).
    visualBtn.addEventListener('click', () => {
      const text = (this._rawText || '').trim();
      this._resetEditors();
      this._seedFrom(text);
      if (this._isValue && text && this._strategy === 'raw') return; // cannot visualize; keep text
      this._render();
    });
    const actions = document.createElement('div');
    actions.className = 'eb-actions';
    actions.appendChild(visualBtn);
    this.body.appendChild(actions);
  }

  // ── Live preview ─────────────────────────────────────────────────────────────
  _buildPreview() {
    const wrap = document.createElement('div');
    wrap.className = 'eb-preview';
    const lbl = document.createElement('div');
    lbl.className = 'eb-preview-lbl';
    lbl.textContent = 'FHIRPath';
    this._previewStr = document.createElement('code');
    this._previewStr.className = 'eb-preview-str';
    this._previewStr.dataset.testid = 'eb-preview-str';
    this._previewChip = document.createElement('span');
    this._previewChip.className = 'eb-chip';
    this._previewChip.dataset.testid = 'eb-preview-chip';
    wrap.append(lbl, this._previewStr, this._previewChip);
    this.body.appendChild(wrap);
  }

  _refreshPreview() {
    if (!this._previewStr) return; // tree editor may fire onChange before preview exists
    const expr = this._currentExpr();
    this._previewStr.textContent = expr || '\u2014';
    const r = evalFhirpath(_rc.ctx, expr);
    const chip = this._previewChip;
    chip.className = 'eb-chip';
    if (r.status === 'empty') { chip.textContent = ''; return; }
    if (r.status === 'not-ready') { chip.textContent = 'preview not ready'; return; }
    if (r.status === 'error') { chip.classList.add('eb-chip--err'); chip.textContent = 'error: ' + r.error; return; }
    chip.classList.add('eb-chip--ok');
    chip.textContent = '= ' + JSON.stringify(r.result);
  }

  // ── Result ──────────────────────────────────────────────────────────────────
  _currentExpr() {
    if (this._strategy === 'raw') return (this._rawText || '').trim();
    if (this._treeEditor) return this._treeEditor.getExpr();
    if (this._pipelineEditor) return this._pipelineEditor.getExpr();
    if (this._valueEditor) return this._valueEditor.getExpr();
    return '';
  }

  _apply() {
    const expr = this._currentExpr();
    if (typeof this._onInsert === 'function') this._onInsert(expr);
    this._reset();
    this.close();
  }

  _cancel() { this._reset(); this.close(); }

  _resetEditors() {
    this._treeEditor = null;
    this._valueEditor = null;
    this._pipelineEditor = null;
    this._pendingValueEditor = null;
  }

  _reset() {
    this._onInsert = null;
    this._resetEditors();
    this.body.innerHTML = '';
  }
}

export const expressionBuilderModal = typeof document !== 'undefined' ? new ExpressionBuilderModal() : null;
