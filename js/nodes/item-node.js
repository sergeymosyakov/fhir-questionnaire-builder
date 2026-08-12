import { uiStr } from '../preview/render-ctx.js';
// Abstract base for all question item nodes (type: 'item').
// Concrete subclasses set `this.itemType` and may add type-specific defaults.
// Optional FHIR-imported properties set after construction (all item types):
//   _readOnly, _prefix, _definition, _codes, _hidden, _designNote,
//   _renderXhtml, _renderStyle, _supportLinks, _disabledDisplay,
//   _enableWhenText, _unknownExtensions, _answerValueSet,
//   _initialValue, _initialValues, _initialSelected
import { BaseNode, applyRenderStyle } from './base-node.js';
import * as explainModal from '../ui/modals/explain-modal.js';

export class ItemNode extends BaseNode {
  constructor(data = {}) {
    super(data);
    this.type           = 'item';
    this.repeats         = data.repeats         ?? false;
    this.options         = data.options         ?? '';
    this.constraint      = data.constraint      ?? [];
    this.children        = data.children        ?? [];
    this.logicWithParent = data.logicWithParent ?? 'AND';
  }

  /** Abort own listeners and recursively destroy children. */
  destroy() {
    super.destroy();
    this.children.forEach(c => c.destroy());
  }

  /** Build the interactive preview control element for this node.
   *  Overridden by every concrete subclass.
   *  @param {object} ctx  — { getValue, setValue, onChange, _reCalc }
   *  @returns {HTMLElement} wrapper span */
  buildControl(_ctx) {
    throw new Error(`buildControl() not implemented on ${this.constructor.name} (itemType: ${this.itemType})`);
  }

  /** Whether this item type supports repeats. Overridden by CheckboxNode and DisplayNode. */
  supportsRepeat() { return true; }

  /**
   * Whether repeats is intrinsic to the control (always true, not user-toggleable).
   * Checklist (multi-select check-box) expresses multiple answers via its own
   * checkboxes, so it is inherently repeats:true. Overridden by ChecklistNode.
   */
  impliesRepeats() { return false; }

  // ── Sub-item children (FHIR R4: non-group items may have item[]) ──────────
  _renderChildren(res, target, rc) {
    if (this._previewCollapsed) return;
    if (!this.children.length) return;
    const nested = document.createElement('div');
    nested.className = 'preview-nested';
    this._appendChildRows(nested, rc);
    if (nested.childElementCount > 0) target.appendChild(nested);
  }
  _renderDimmedChildren(res, c, rc)   { this._renderNestedChildren(res, c,         rc); }
  _renderDisabledChildren(res, c, rc) { this._renderNestedChildren(res, c,         rc); }

  // ── Condition icon logic for items ────────────────────────────────────────
  _evalCondition(res, rc) {
    const { ctx, cEnv } = rc;
    const constraintPass = this.constraint?.length
      ? rc.evalConstraints(this, ctx.fp, ctx.qr, cEnv) : true;
    const hasCondition = this.itemType !== 'display' && (
      (rc.CHECKABLE_TYPES.has(this.itemType) && (rc.isMandatory(this) || this.itemType === 'url')) ||
      (this._calculatedExpr && this._readOnly && this.itemType === 'checkbox') ||
      (this.constraint?.length > 0) ||
      (this._minValue !== undefined || this._maxValue !== undefined) ||
      (this._maxDecimalPlaces !== undefined) ||
      (this._regex)
    );
    const displayOk = res.ok && rc.calcFormOk(this) && constraintPass;
    return { hasCondition, displayOk };
  }

  // ── Label: XHTML or plain text ────────────────────────────────────────────
  _buildLabel(_res, rc) {
    const el = document.createElement('span');
    this._applyLabelContent(el, rc);
    return el;
  }

  // ── Row content: label + badges + control ─────────────────────────────────
  _buildRowContent(row, res, rc) {
    const isPatient = rc.previewMode === 'patient';

    // Cell mode (inside gtable): skip label and design-mode badges, render control only.
    if (rc.cellMode) {
      this._buildControl(row, res, rc);
      this._buildReadOnlyValue(row, rc);
      return;
    }
    const label = this._buildLabel(res, rc);
    if (this._renderStyle) applyRenderStyle(label, this._renderStyle);

    // Required star goes inside the label; optional badge goes outside after.
    let optionalBadge = null;
    if (this.itemType !== 'display' && !this._readOnly) {
      if (this.mandatory === false) {
        if (!isPatient) {
          optionalBadge = document.createElement('span');
          optionalBadge.className = 'preview-optional-badge';
          optionalBadge.dataset.testid = 'preview-optional-badge';
          optionalBadge.textContent = 'optional';
          optionalBadge.dataset.tipTitle = 'Optional field';
          optionalBadge.dataset.tipBody = 'This field is not required \u2014 the questionnaire response is valid without an answer.';
          optionalBadge.dataset.tipFhir = 'item.required: false';
          optionalBadge.dataset.tipSpec = 'R4';
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

    row.appendChild(label);
    if (optionalBadge) row.appendChild(optionalBadge);
    this._buildSupportLinks(row, rc);
    this._buildVisHint(row, rc);
    this._buildConstraintBadge(row, rc);
    this._buildReadOnlyBadge(row, rc);
    this._buildInitialBadge(row, rc);
    this._buildItemMedia(row);
    this._buildControl(row, res, rc);
    this._buildReadOnlyValue(row, rc);
    this._buildCalcBadge(row, res, rc);
    // Collapse toggle for items with sub-items
    this._buildPreviewCollapseToggle(row);
  }

  _buildConstraintBadge(row, rc) {
    if (!this.constraint?.length) return;
    const isPatient = rc.previewMode === 'patient';
    if (isPatient) return;
    const { ctx, cEnv } = rc;
    const constraintOk = rc.evalConstraints(this, ctx.fp, ctx.qr, cEnv);
    const cb = document.createElement('span');
    cb.className = 'preview-constraint-badge' + (constraintOk ? '' : ' preview-constraint-badge--fail');
    const msgs = this.constraint.filter(c => c.severity === 'error').map(c => c.human || c.expression || c.key).filter(Boolean);
    cb.textContent = constraintOk ? '\u26A0\uFE0F constraint' : '\u2718 constraint';
    cb.dataset.tipTitle = constraintOk ? 'Has constraint' : 'Constraint: FAIL';
    cb.dataset.tipBody  = msgs.length ? msgs.join('\n') : 'questionnaire-constraint on this item';
    cb.dataset.tipFhir  = 'Questionnaire.item.extension[questionnaire-constraint]';
    cb.dataset.tipSpec  = 'R4';
    const firstExpr = this.constraint.find(c => c.expression?.trim())?.expression;
    if (firstExpr && rc.showExplain) {
      cb.classList.add('preview-condition-hint--explain');
      cb.dataset.tipBody += '\n\nClick to explain.';
      cb.addEventListener('click', () => {
        if (rc.lastCtx.fp) explainModal.show(firstExpr, rc.lastCtx.fp, rc.lastCtx.qr, rc.lastCtx.env);
      });
    }
    row.appendChild(cb);
  }

  _buildReadOnlyBadge(row, rc) {
    if (rc.previewMode === 'patient') return;
    if (!this._readOnly || this._calculatedExpr) return;
    const rb = document.createElement('span');
    rb.className = 'preview-meta-badge';
    rb.textContent = '\uD83D\uDD12 read-only';
    rb.dataset.tipTitle = 'Read-only field';
    rb.dataset.tipBody  = 'This field is marked readOnly in the FHIR Questionnaire. It cannot be edited by the user.';
    rb.dataset.tipFhir  = 'Questionnaire.item.readOnly';
    rb.dataset.tipSpec  = 'R4';
    row.appendChild(rb);
  }

  _buildInitialBadge(row, rc) {
    if (rc.previewMode === 'patient') return;
    if (this._initialValue === undefined || this._initialValue === '') return;
    const ib = document.createElement('span');
    ib.className = 'preview-meta-badge preview-meta-badge--init';
    ib.textContent = '\u21BA default';
    ib.dataset.tipTitle = 'Has default value';
    ib.dataset.tipBody  = 'Pre-filled from Questionnaire.item.initial[]. User can change it unless the field is readOnly.';
    ib.dataset.tipFhir  = 'Questionnaire.item.initial[]';
    ib.dataset.tipSpec  = 'R4';
    row.appendChild(ib);
  }

  // Render itemMedia (image / audio / video) inline before the control.
  _buildItemMedia(row) {
    if (!this._itemMedia?.url) return;
    const att = this._itemMedia;
    const ct = att.contentType || '';
    const el = ct.startsWith('audio/')
      ? Object.assign(document.createElement('audio'), { src: att.url, controls: true })
      : ct.startsWith('video/')
        ? Object.assign(document.createElement('video'), { src: att.url, controls: true, style: 'max-width:100%;max-height:240px' })
        : Object.assign(document.createElement('img'), { src: att.url, alt: att.title || '', style: 'max-width:100%;max-height:200px' });
    el.className = 'preview-item-media';
    el.dataset.testid = 'preview-item-media';
    row.appendChild(el);
  }

  // Build interactive control (or repeat controls).
  _buildControl(row, res, rc) {
    if (this._readOnly || this._calculatedExpr) return;
    // Multi-select controls (checkbox / checklist) express repeats via their own
    // multiple selection — supportsRepeat() is false for them, so no "Add another".
    if (this.repeats && this.supportsRepeat()) {
      row.appendChild(this._buildRepeatContainer(res._iconEl, () => rc.updateGroupIcons(), rc));
    } else {
      row.appendChild(rc.buildControl(this, res._iconEl, () => rc.updateGroupIcons()));
    }
    if (rc.previewMode === 'patient' && this._previewEl) {
      this._previewEl.classList.toggle('lform-item--invalid', !rc.calcFormOk(this));
    }
  }

  // Render N+1 repeat rows with add/remove buttons.
  _buildRepeatContainer(iconEl, onAfterChange, rc) {
    const id     = this.id;
    const rowKey = i => i === 0 ? id : id + '$$' + i;
    const n      = rc.getValue(id + '$$n') || 0;

    const wrap = document.createElement('div');
    wrap.className = 'repeat-wrap';

    for (let i = 0; i <= n; i++) {
      const rk       = rowKey(i);
      const fakeNode = i === 0 ? this : Object.assign(Object.create(Object.getPrototypeOf(this)), this, { id: rk });
      const rowEl    = document.createElement('div');
      rowEl.className = 'repeat-row';

      rowEl.appendChild(rc.buildControl(fakeNode, i === 0 ? iconEl : null, onAfterChange));

      if (n > 0) {
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'repeat-remove-btn';
        rm.textContent = '\xD7';
        rm.dataset.tipTitle = 'Remove this answer';
        rm.dataset.testid = 'repeat-remove-btn';
        const _i = i;
        rm.onclick = () => {
          for (let j = _i; j < n; j++) rc.set(rowKey(j), rc.getValue(rowKey(j + 1)));
          rc.remove(rowKey(n));
          rc.set(id + '$$n', n - 1);
          BaseNode.notifyChanged(rc.bus);
        };
        rowEl.appendChild(rm);
      }

      wrap.appendChild(rowEl);
    }

    const maxOccurs = this._maxOccurs;
    const atMax = maxOccurs !== undefined && (n + 1) >= maxOccurs;

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'repeat-add-btn';
    addBtn.textContent = uiStr('add_another', rc);
    addBtn.dataset.testid = 'repeat-add-btn';
    if (atMax) {
      addBtn.disabled = true;
      addBtn.dataset.tipTitle = 'Maximum ' + maxOccurs + ' answer' + (maxOccurs === 1 ? '' : 's') + ' reached';
    }
    addBtn.onclick = () => { if (!atMax) { rc.set(id + '$$n', n + 1); BaseNode.notifyChanged(rc.bus); } };
    wrap.appendChild(addBtn);

    return wrap;
  }

  _buildReadOnlyValue(row, rc) {
    if (!this._readOnly || this._calculatedExpr) return;
    const val = rc.getValue(this.id);
    const vb = document.createElement('span');
    vb.className = 'preview-readonly-value';
    vb.dataset.testid = 'preview-readonly-value';
    vb.textContent = (val !== undefined && val !== null && val !== '') ? String(val) : '\u2014';
    row.appendChild(vb);
  }

  _buildCalcBadge(row, res, rc) {
    if (!this._calculatedExpr || !this._readOnly) return;
    const isPatient = rc.previewMode === 'patient';
    const badge = document.createElement('span');
    badge.dataset.calcId   = this.id;
    badge.dataset.calcType = this.itemType;
    if (isPatient) {
      const s = rc.getValue(this.id);
      badge.className = 'preview-calc-value';
      badge.textContent = (s !== undefined && s !== '') ? String(s) : '\u2014';
      this._attachCalcExplain(badge, rc);
    } else if (this.itemType === 'checkbox') {
      const calcVal = rc.getValue(this.id);
      badge.className = 'calc-badge ' + (calcVal ? 'calc-true' : 'calc-false') + (rc.showExplain ? ' calc-badge--explain' : '');
      badge.textContent = calcVal ? '\u2713 true' : '\u2717 false';
      badge.dataset.tipTitle = 'Calculated value';
      badge.dataset.tipBody  = 'FHIRPath: ' + this._calculatedExpr + (rc.showExplain ? '\n\nClick to explain.' : '');
      badge.dataset.tipFhir  = 'sdc-questionnaire-calculatedExpression';
      badge.dataset.tipSpec  = 'SDC';
      if (rc.showExplain) {
        const expr = this._calculatedExpr;
        badge.addEventListener('click', () => {
          if (rc.lastCtx.fp) explainModal.show(expr, rc.lastCtx.fp, rc.lastCtx.qr, rc.lastCtx.env);
        });
      }
    } else {
      const s = rc.getValue(this.id);
      badge.className = 'preview-calc-value';
      badge.textContent = (s !== undefined && s !== '') ? String(s) : '\u2014';
      this._attachCalcExplain(badge, rc);
    }
    // Store updater closure — called on REFRESH_CALC_BADGES without full DOM rebuild.
    // Must mirror the initial build's patient/design split: in patient view the
    // calc value always renders as a plain preview-calc-value (never the design
    // ✓/✗ calc-badge), otherwise a recompute would flip a patient-view field into
    // the design-preview badge style.
    this._refreshCalcBadge = () => {
      if (this.itemType === 'checkbox' && rc.previewMode !== 'patient') {
        const v = rc.getValue(this.id);
        badge.className = 'calc-badge ' + (v ? 'calc-true' : 'calc-false') + (rc.showExplain ? ' calc-badge--explain' : '');
        badge.textContent = v ? '\u2713 true' : '\u2717 false';
      } else {
        const s = rc.getValue(this.id);
        badge.className = 'preview-calc-value' + (rc.showExplain && this._calculatedExpr ? ' preview-calc-value--explain' : '');
        badge.textContent = (s !== undefined && s !== '') ? String(s) : '\u2014';
      }
    };
    row.appendChild(badge);
  }

  // Make a plain calc value (`.preview-calc-value`, e.g. a numeric BMI) clickable
  // to open the FHIRPath Explain modal — only when the surface enables Explain.
  _attachCalcExplain(badge, rc) {
    if (!rc.showExplain || !this._calculatedExpr) return;
    badge.classList.add('preview-calc-value--explain');
    badge.dataset.tipTitle = 'Calculated value';
    badge.dataset.tipBody  = 'FHIRPath: ' + this._calculatedExpr + '\n\nClick to explain.';
    badge.dataset.tipFhir  = 'sdc-questionnaire-calculatedExpression';
    badge.dataset.tipSpec  = 'SDC';
    const expr = this._calculatedExpr;
    badge.addEventListener('click', () => {
      if (rc.lastCtx.fp) explainModal.show(expr, rc.lastCtx.fp, rc.lastCtx.qr, rc.lastCtx.env);
    });
  }

  // Override _appendRow to also disable hidden-item inputs.
  _appendRow(row, res, container) {
    if (res.hidden && this.type === 'item') {
      row.querySelectorAll('input, select, textarea').forEach(el => { el.disabled = true; });
    }
    return super._appendRow(row, res, container);
  }
}
