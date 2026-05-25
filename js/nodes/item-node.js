// ── ItemNode ──────────────────────────────────────────────────────────────────
// Abstract base for all question item nodes (type: 'item').
// Concrete subclasses set `this.itemType` and may add type-specific defaults.
// Optional FHIR-imported properties set after construction (all item types):
//   _readOnly, _prefix, _definition, _codes, _hidden, _designNote,
//   _renderXhtml, _renderStyle, _supportLinks, _disabledDisplay,
//   _enableWhenText, _unknownExtensions, _answerValueSet,
//   _initialValue, _initialValues, _initialSelected
import { BaseNode, applyRenderStyle } from './base-node.js';
import * as explainModal from '../ui/explain-modal.js';

export class ItemNode extends BaseNode {
  constructor(data = {}) {
    super(data);
    this.type       = 'item';
    this.repeats    = data.repeats    ?? false;
    this.options    = data.options    ?? '';
    this.constraint = data.constraint ?? [];
  }

  /** Build the interactive preview control element for this node.
   *  Overridden by every concrete subclass.
   *  @param {object} ctx  — { getValue, setValue, onChange, _reCalc, _formTick }
   *  @returns {HTMLElement} wrapper span */
  buildControl(_ctx) {
    throw new Error(`buildControl() not implemented on ${this.constructor.name} (itemType: ${this.itemType})`);
  }

  // ── Condition icon logic for items ────────────────────────────────────────
  _evalCondition(res, rc) {
    const { ctx, cEnv } = rc;
    const constraintPass = this.constraint?.length
      ? rc.evalConstraints(this, ctx.fp, ctx.qr, cEnv) : true;
    const hasCondition = this.itemType !== 'display' && (
      (rc.CHECKABLE_TYPES.has(this.itemType) && (rc.isMandatory(this) || this.itemType === 'url')) ||
      (this._calculatedExpr && this._readOnly && this.itemType === 'checkbox') ||
      (this.constraint?.length > 0) ||
      (this._minValue !== undefined || this._maxValue !== undefined)
    );
    const displayOk = res.ok && rc.calcFormOk(this) && constraintPass;
    return { hasCondition, displayOk };
  }

  // ── Label: XHTML or plain text ────────────────────────────────────────────
  _buildLabel() {
    const el = document.createElement('span');
    this._applyLabelContent(el);
    return el;
  }

  // ── Row content: label + badges + control ─────────────────────────────────
  _buildRowContent(row, res, rc) {
    const isPatient = rc.previewMode === 'patient';
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
    this._buildControl(row, res, rc);
    this._buildReadOnlyValue(row, rc);
    this._buildCalcBadge(row, res, rc);
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
    cb.title = msgs.length ? msgs.join('\n') : 'questionnaire-constraint';
    cb.dataset.tipTitle = constraintOk ? 'Has constraint' : 'Constraint: FAIL';
    cb.dataset.tipBody  = msgs.length ? msgs.join('\n') : 'questionnaire-constraint on this item';
    cb.dataset.tipFhir  = 'Questionnaire.item.extension[questionnaire-constraint]';
    cb.dataset.tipSpec  = 'R4';
    const firstExpr = this.constraint.find(c => c.expression?.trim())?.expression;
    if (firstExpr) {
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

  // Build interactive control (or repeat controls). Override in DisplayNode to skip.
  _buildControl(row, res, rc) {
    if (this.itemType === 'display') return;
    if (this._readOnly || this._calculatedExpr) return;
    if (this.repeats && this.itemType !== 'checkbox') {
      row.appendChild(rc.buildRepeatControls(this, res._iconEl, () => rc.groupIconMap && _updateGroupIcons(rc)));
    } else {
      row.appendChild(rc.buildControl(this, res._iconEl, () => rc.groupIconMap && _updateGroupIcons(rc)));
    }
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
    } else if (this.itemType === 'checkbox') {
      const calcVal = rc.getValue(this.id);
      badge.className = 'calc-badge ' + (calcVal ? 'calc-true' : 'calc-false') + ' calc-badge--explain';
      badge.textContent = calcVal ? '\u2713 true' : '\u2717 false';
      badge.dataset.tipTitle = 'Calculated value';
      badge.dataset.tipBody  = 'FHIRPath: ' + this._calculatedExpr + '\n\nClick to explain.';
      badge.dataset.tipFhir  = 'sdc-questionnaire-calculatedExpression';
      badge.dataset.tipSpec  = 'SDC';
      const expr = this._calculatedExpr;
      badge.addEventListener('click', () => {
        if (rc.lastCtx.fp) explainModal.show(expr, rc.lastCtx.fp, rc.lastCtx.qr, rc.lastCtx.env);
      });
    } else {
      const s = rc.getValue(this.id);
      badge.className = 'preview-calc-value';
      badge.textContent = (s !== undefined && s !== '') ? String(s) : '\u2014';
    }
    row.appendChild(badge);
  }

  // Override _appendRow to also disable hidden-item inputs.
  _appendRow(row, res, container) {
    if (res.hidden && this.type === 'item') {
      row.querySelectorAll('input, select, textarea').forEach(el => { el.disabled = true; });
    }
    return super._appendRow(row, res, container);
  }
}

// Trigger icon refresh on all visible groups after a control value changes.
function _updateGroupIcons(rc) {
  const { ctx, groupIconMap } = rc;
  if (!groupIconMap) return;
  for (const [, { icon, descendants, node }] of groupIconMap.entries()) {
    const relevant = descendants.filter(r =>
      (rc.isMandatory(r.node) && rc.CHECKABLE_TYPES.has(r.node.itemType)) ||
      (r.node._calculatedExpr && r.node._readOnly && r.node.itemType === 'checkbox') ||
      r.node.constraint?.length > 0 ||
      (r.node._minValue !== undefined || r.node._maxValue !== undefined)
    );
    if (relevant.length === 0) { icon.className = 'icon-ok'; icon.textContent = '\u2713'; continue; }
    const itemOk = k => k.ok && rc.calcFormOk(k.node) &&
      (!k.node.constraint?.length || rc.evalConstraints(k.node, ctx.fp, ctx.qr, ctx.envVars || {}));
    const ok = node.logicWithParent === 'OR' ? relevant.some(itemOk) : relevant.every(itemOk);
    icon.className   = ok ? 'icon-ok' : 'icon-fail';
    icon.textContent = ok ? '\u2713' : '\u2717';
  }
}
