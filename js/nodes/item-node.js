import { MODAL_REGISTRY } from '../ui/modal-registry.js';
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
      row.appendChild(rc.buildRepeatControls(this, res._iconEl, () => rc.updateGroupIcons()));
    } else {
      row.appendChild(rc.buildControl(this, res._iconEl, () => rc.updateGroupIcons()));
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

  // ── Builder panel ─────────────────────────────────────────────────────────
  // Renders the left-panel (builder tree) row for this item node.
  // All external deps (modals, DnD, utils) are injected via ctx.
  buildBuilder(ctx) {
    const node = this;
    const { renderTree } = ctx;

    const wrapper = document.createElement('div');
    wrapper.className = 'node-wrap';

    const div = document.createElement('div');
    div.className = 'node node-item';
    div.dataset.nodeId = node.id;

    const dropAbove = document.createElement('div');
    dropAbove.className = 'drop-zone drop-zone-above';
    dropAbove.textContent = 'Drop here';
    ctx.attachDropZone(dropAbove, node, 'before');
    wrapper.appendChild(dropAbove);

    const header = document.createElement('div');
    header.className = 'node-header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'node-title';
    titleWrap.insertBefore(ctx.makeDragHandle(node), titleWrap.firstChild);

    const typeLabel = document.createElement('span');
    typeLabel.className = 'node-type-label lbl-item';
    typeLabel.dataset.testid = 'node-type-label';
    typeLabel.textContent = '[Item]';
    titleWrap.appendChild(typeLabel);

    const prefixInput = document.createElement('input');
    prefixInput.type = 'text';
    prefixInput.value = node._prefix || '';
    prefixInput.className = 'node-prefix-input';
    prefixInput.placeholder = 'prefix';
    prefixInput.dataset.tipTitle = 'Display prefix';
    prefixInput.dataset.tipBody  = 'Cosmetic only \u2014 e.g. "1.2". Does not affect logic or linkId.';
    prefixInput.oninput = () => { node._prefix = prefixInput.value.trim() || undefined; };
    titleWrap.appendChild(prefixInput);

    const linkIdInput = document.createElement('input');
    linkIdInput.type = 'text';
    linkIdInput.value = node.id;
    linkIdInput.className = 'node-linkid-input';
    linkIdInput.dataset.tipTitle = 'FHIR linkId';
    linkIdInput.dataset.tipBody  = 'Editable. Must be unique within the questionnaire.';
    linkIdInput.oninput = () => { node.id = linkIdInput.value.trim() || node.id; };
    titleWrap.appendChild(linkIdInput);

    const titleRow = document.createElement('div');
    titleRow.className = 'node-title-row';
    const titleDisplay = document.createElement('span');
    titleDisplay.className = 'node-title-display';
    titleDisplay.dataset.testid = 'node-title-display';
    titleDisplay.textContent = node.title || '(no title)';
    const titleTextarea = document.createElement('textarea');
    titleTextarea.className = 'node-title-textarea';
    titleTextarea.dataset.testid = 'node-title-input';
    titleTextarea.value = node.title;
    titleTextarea.style.display = 'none';
    titleTextarea.oninput = () => { node.title = titleTextarea.value; titleDisplay.textContent = titleTextarea.value || '(no title)'; };
    titleTextarea.onblur = () => { titleTextarea.style.display = 'none'; titleDisplay.style.display = ''; };
    titleDisplay.addEventListener('click', e => {
      e.stopPropagation();
      const h = titleDisplay.offsetHeight;
      titleDisplay.style.display = 'none';
      titleTextarea.style.display = '';
      titleTextarea.style.height = Math.max(h, 48) + 'px';
      titleTextarea.focus();
      titleTextarea.setSelectionRange(titleTextarea.value.length, titleTextarea.value.length);
    });
    titleRow.appendChild(titleDisplay);
    titleRow.appendChild(titleTextarea);

    titleWrap.addEventListener('click', e => {
      if (e.target === titleTextarea || e.target === titleDisplay || e.target === linkIdInput || e.target === prefixInput) return;
      ctx.navigateToPreview(node.id);
    });

    const actions = document.createElement('div');
    actions.className = 'node-actions';
    const panels = {};
    let openKey = null;

    const addToggle = (label, key, tipTitle, tipBody, tipFhir, tipSpec) => {
      const a = document.createElement('a');
      a.textContent = label;
      a.className = 'action-edit';
      if (tipTitle) a.dataset.tipTitle = tipTitle;
      if (tipBody)  a.dataset.tipBody  = tipBody;
      if (tipFhir)  a.dataset.tipFhir  = tipFhir;
      if (tipSpec)  a.dataset.tipSpec  = tipSpec;
      a.onclick = () => {
        openKey = openKey === key ? null : key;
        for (const k of Object.keys(panels)) panels[k].style.display = openKey === k ? 'block' : 'none';
        ctx.refreshExprIcons();
      };
      actions.appendChild(a);
      return a;
    };
    const setActive = (el, active) => el.classList.toggle('action-edit--active', active);

    const typeLink = addToggle('Answer Type', 'type',
      'Answer Type',
      'Sets the FHIR item type (boolean, decimal, string, choice, date, url, attachment, reference, quantity, display). Controls which input control is rendered in the preview.',
      'Questionnaire.item.type', 'R4 \u00B7 required');
    typeLink.dataset.testid = 'action-type';
    typeLink.onclick = () => MODAL_REGISTRY.get('answerType').open(node, typeLink, setActive);

    const statesLink = document.createElement('a');
    statesLink.textContent = 'States';
    statesLink.className = 'action-edit';
    statesLink.dataset.tipTitle = 'Item / group states';
    statesLink.dataset.tipBody  = 'Required \u2014 must be answered to pass validation.\nRead-only \u2014 value set programmatically, not editable (items only).\nHidden \u2014 excluded from patient view; participates in logic.';
    statesLink.dataset.tipFhir  = 'item.required / item.readOnly / sdc-questionnaire-hidden';
    statesLink.dataset.tipSpec  = 'R4 \u00B7 SDC';
    statesLink.dataset.testid   = 'action-states';
    statesLink.onclick = () => MODAL_REGISTRY.get('states').open(node, statesLink, setActive);
    actions.appendChild(statesLink);

    const visLink = addToggle('Show When', 'vis',
      'Show When (enableWhen)',
      'Add enableWhen conditions to control when this item is visible. Supports FHIR R4 enableWhen[] (AND/OR) and SDC enableWhenExpression (FHIRPath). Hidden items are dimmed \uD83D\uDD12 in the preview.',
      'Questionnaire.item.enableWhen[]', 'R4 \u00B7 optional');
    visLink.dataset.testid = 'action-vis';
    visLink.onclick = () => MODAL_REGISTRY.get('showWhen').open(node, visLink, setActive, ctx, ctx.buildVisPanel);

    const exprLink = addToggle('Expression', 'expr',
      'FHIRPath Expressions',
      'Edit both FHIRPath expression fields: calculatedExpression (evaluated on every preview render) and initialExpression (evaluated once on load or re-init). Both support questionnaire-level %variables.',
      'sdc-questionnaire-calculatedExpression / initialExpression', 'SDC \u00B7 optional');
    exprLink.dataset.testid = 'action-expr';
    exprLink.onclick = () => MODAL_REGISTRY.get('expression').openDual(node, exprLink, setActive, ctx.triggerCalcRecalc);

    const repeatLink = document.createElement('a');
    repeatLink.textContent = 'Repeatable';
    repeatLink.className = 'action-edit';
    repeatLink.dataset.tipTitle = 'Repeatable';
    repeatLink.dataset.tipBody  = 'Allow multiple answers for this item. Opens a dialog to configure item.repeats and optional cardinality (minOccurs / maxOccurs extensions).';
    repeatLink.dataset.tipFhir  = 'Questionnaire.item.repeats';
    repeatLink.dataset.tipSpec  = 'R4';
    repeatLink.dataset.testid   = 'action-repeatable';
    repeatLink.onclick = () => MODAL_REGISTRY.get('repeatable').open(node, repeatLink, setActive);
    actions.appendChild(repeatLink);

    const initLink = addToggle('Default', 'init',
      'Default Value (initial)',
      'Pre-fills the answer when the form loads. The user can change it unless readOnly is set. Only the first entry (initial[0]) is used. Supports all item types.',
      'Questionnaire.item.initial[]', 'R4 \u00B7 optional');
    initLink.dataset.testid = 'action-default';
    initLink.onclick = () => MODAL_REGISTRY.get('initial').open(node, initLink, setActive);

    const constraintLink = addToggle('Constraint', 'constraint',
      'Validation Constraints (questionnaire-constraint)',
      'FHIR questionnaire-constraint extensions on this item. Each entry has a FHIRPath expression, human-readable message, and severity. Error-severity constraints must pass for the item to show \u2714 in the preview.',
      'Questionnaire.item.extension[questionnaire-constraint]', 'R4 \u00B7 optional');
    constraintLink.dataset.testid = 'action-constraint';
    constraintLink.onclick = () => MODAL_REGISTRY.get('constraint').open(node, constraintLink, setActive);

    const styleLink = addToggle('Appearance', 'style',
      'Appearance (rendering-style)',
      'Inline CSS applied to the item title in the preview. Supports bold, italic, text colour, and raw CSS. Stored in the standard FHIR rendering-style extension on the _text element.',
      'Questionnaire.item._text.extension[rendering-style]', 'R4 \u00B7 optional');
    styleLink.dataset.testid = 'action-appearance';
    styleLink.onclick = () => MODAL_REGISTRY.get('appearance').open(node, styleLink, setActive);

    const codesLink = document.createElement('a');
    codesLink.textContent = 'Props';
    codesLink.className = 'action-edit';
    codesLink.dataset.tipTitle = 'Item Properties';
    codesLink.dataset.tipBody  = 'Edit item-level metadata: definition URL (item.definition \u2014 points to a StructureDefinition element) and terminology codes (item.code[] \u2014 LOINC, SNOMED, etc.).';
    codesLink.dataset.tipFhir  = 'Questionnaire.item.definition / item.code[]';
    codesLink.dataset.tipSpec  = 'R4 \u00B7 optional';
    codesLink.dataset.testid   = 'action-codes';
    codesLink.onclick = () => MODAL_REGISTRY.get('codes').open(node, codesLink, setActive);
    actions.appendChild(codesLink);

    const noteLink = document.createElement('a');
    noteLink.textContent = 'Note';
    noteLink.className = 'action-edit';
    noteLink.dataset.tipTitle = 'Design Note';
    noteLink.dataset.tipBody  = 'Internal author note \u2014 stored as FHIR designNote extension. Never shown to patients.';
    noteLink.dataset.tipFhir  = 'http://hl7.org/fhir/StructureDefinition/designNote';
    noteLink.dataset.tipSpec  = 'R4 \u00B7 optional';
    noteLink.dataset.testid   = 'action-note';
    noteLink.onclick = () => MODAL_REGISTRY.get('note').open(node, noteLink, setActive);
    setActive(noteLink, !!node._designNote);
    actions.appendChild(noteLink);

    const headerTop = document.createElement('div');
    headerTop.className = 'node-header-top';
    headerTop.appendChild(titleWrap);

    const metaRow = document.createElement('div');
    metaRow.className = 'node-meta-row';
    const prefixLbl = document.createElement('span');
    prefixLbl.className = 'node-meta-label node-meta-label--prefix';
    prefixLbl.textContent = 'prefix:';
    const idLbl = document.createElement('span');
    idLbl.className = 'node-meta-label node-meta-label--id';
    idLbl.textContent = 'id:';
    metaRow.appendChild(idLbl);
    metaRow.appendChild(linkIdInput);
    metaRow.appendChild(prefixLbl);
    metaRow.appendChild(prefixInput);

    header.appendChild(headerTop);
    header.appendChild(metaRow);
    header.appendChild(titleRow);
    header.appendChild(actions);

    const btnDel = document.createElement('button');
    btnDel.textContent = '\u2715';
    btnDel.className = 'btn-node-delete';
    btnDel.dataset.testid = 'node-delete-btn';
    btnDel.dataset.tipTitle = 'Delete item';
    btnDel.onclick = async () => {
      const ok = await ctx.confirmDelete(node.title || node.id);
      if (ok) { ctx.findAndRemove(node.id, ctx.tree); renderTree(); }
    };

    div.appendChild(header);
    div.appendChild(btnDel);

    setActive(typeLink,        true);
    setActive(visLink,        !!(node.enableWhen?.length) || !!node.enableWhenExpression);
    setActive(exprLink,       !!(node._calculatedExpr || node._initialExpr));
    setActive(statesLink,     node.mandatory === true || !!node._readOnly || !!node._hidden);
    setActive(repeatLink,     !!node.repeats);
    if (node.itemType === 'checkbox' || node.itemType === 'display') repeatLink.style.display = 'none';
    setActive(initLink,       node._initialValue !== undefined && node._initialValue !== '');
    setActive(styleLink,      !!(node._renderStyle || node._renderXhtml));
    setActive(constraintLink, !!(node.constraint?.length));
    setActive(codesLink,      !!(node._codes?.length) || !!node._definition || !!(node._supportLinks?.some(u => u)));

    wrapper.appendChild(div);
    return wrapper;
  }
}
