// ── Expression / Init-Expression edit modal ───────────────────────────────────
// Two modes:
//   open(cfg)                           — single-field (groups: calculatedExpression only)
//   openDual(node, link, setActive, cb) — dual-field (items: calc + init in one modal)
import { MODAL_REGISTRY } from './modal-registry.js';
import { ExprAwareModal } from './expr-aware-modal.js';
import { EXPR_SECTIONS, makeExprField, renderExprSections } from './expression-sections/index.js';
import { nodePickerModal } from './node-picker-modal.js';
import { AppEvents } from '../../events.js';

class ExpressionModal extends ExprAwareModal {
  getName() { return 'expressionModal'; }
  constructor() {
    super();
    this._pending = null;
    MODAL_REGISTRY.set('expression', this);

    this._copyToBtn = document.createElement('button');
    this._copyToBtn.type = 'button';
    this._copyToBtn.className = 'modal-btn modal-btn--copy-to';
    this._copyToBtn.textContent = 'Copy to\u2026';
    this._copyToBtn.dataset.testid = 'expression-copy-to-btn';
    this._copyToBtn.addEventListener('click', () => this._openCopyTo());
    this.footer.insertBefore(this._copyToBtn, this.footer.firstChild);
  }

  open(cfg) {
    this._fpCtx = cfg.fpCtx || null;
    this._pending = { mode: 'single', cfg, draft: cfg.node[cfg.field] || '' };
    this.setTitle(cfg.label, cfg.node.title || cfg.node.id || 'Item');
    this.body.innerHTML = '';
    if (cfg.hint) {
      const hint = document.createElement('div');
      hint.className   = 'panel-hint';
      hint.textContent = cfg.hint;
      this.body.appendChild(hint);
    }
    this.body.appendChild(makeExprField(
      cfg.fhirLabel, this._pending.draft, null, cfg.placeholder || '',
      val => { this._pending.draft = val; },
    ));
    super.open();
    setTimeout(() => this.body.querySelector('textarea')?.focus(), 50);
  }

  openDual(node, link, setActive, onApply, fpCtx = null) {
    this._fpCtx = fpCtx;
    this._pending = { mode: 'dual', node, link, setActive, onApply,
      ...Object.assign({}, ...EXPR_SECTIONS.map(s => s.initPending(node))) };
    this.setTitle('FHIRPath Expressions', node.title || node.id || 'Item');
    renderExprSections(this.body, this._pending);
    super.open();
    setTimeout(() => this.body.querySelector('textarea')?.focus(), 50);
  }

  _buildPayload() {
    const p = this._pending;
    if (p.mode === 'single') {
      return { [p.cfg.field]: p.draft.trim() || null };
    }
    return Object.assign({}, ...EXPR_SECTIONS.map(s => s.buildPatch(p, p.node)));
  }

  _openCopyTo() {
    if (!this._pending) return;
    const patch = this._buildPayload();
    const sourceNode = this._pending.mode === 'dual'
      ? this._pending.node
      : this._pending.cfg?.node;
    const excludeId   = sourceNode?.id;
    const allowedType = sourceNode?.type;
    nodePickerModal.open(excludeId, (ids) => {
      document.dispatchEvent(new CustomEvent(AppEvents.COPY_TO_NODES, { detail: { ids, patch, nodeType: allowedType } }));
      document.dispatchEvent(new CustomEvent(AppEvents.CALC_RECALC_REQUESTED));
      document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_RERENDER));
    }, allowedType);
  }

  _apply() {
    if (!this._pending) return;
    if (this._pending.mode === 'single') {
      const { cfg, draft } = this._pending;
      const val = draft.trim() || undefined;
      cfg.node[cfg.field] = val;
      cfg.setActive(cfg.link, !!val);
      if (cfg.onApply) cfg.onApply();
    } else {
      const { node, link, setActive, onApply } = this._pending;
      EXPR_SECTIONS.forEach(s => s.commit(this._pending, node));
      setActive(link, !!(node._calculatedExpr || node._initialExpr));
      if (onApply) onApply();
    }
    this._cancel();
  }

  _cancel() {
    this._pending = null;
    this.close();
  }
}
new ExpressionModal();
