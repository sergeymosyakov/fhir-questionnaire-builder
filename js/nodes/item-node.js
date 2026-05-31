import { MODAL_REGISTRY } from '../ui/modals/modal-registry.js';
// ── ItemNode ──────────────────────────────────────────────────────────────────
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
    this.type       = 'item';
    this.repeats    = data.repeats    ?? false;
    this.options    = data.options    ?? '';
    this.constraint = data.constraint ?? [];
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
    this._buildItemMedia(row);
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
    if (this.repeats && this.itemType !== 'checkbox') {
      row.appendChild(this._buildRepeatContainer(res._iconEl, () => rc.updateGroupIcons(), rc));
    } else {
      row.appendChild(rc.buildControl(this, res._iconEl, () => rc.updateGroupIcons()));
    }
  }

  // Render N+1 repeat rows with add/remove buttons.
  _buildRepeatContainer(iconEl, onAfterChange, rc) {
    const id     = this.id;
    const rowKey = i => i === 0 ? id : id + '$$' + i;
    const n      = rc.values[id + '$$n'] || 0;

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
          for (let j = _i; j < n; j++) rc.values[rowKey(j)] = rc.values[rowKey(j + 1)];
          delete rc.values[rowKey(n)];
          rc.values[id + '$$n'] = n - 1;
          BaseNode.notifyChanged();
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
    addBtn.textContent = '+ Add another';
    addBtn.dataset.testid = 'repeat-add-btn';
    if (atMax) {
      addBtn.disabled = true;
      addBtn.dataset.tipTitle = 'Maximum ' + maxOccurs + ' answer' + (maxOccurs === 1 ? '' : 's') + ' reached';
    }
    addBtn.onclick = () => { if (!atMax) { rc.values[id + '$$n'] = n + 1; BaseNode.notifyChanged(); } };
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
    // Store updater closure — called on REFRESH_CALC_BADGES without full DOM rebuild.
    this._refreshCalcBadge = () => {
      if (this.itemType === 'checkbox') {
        const v = rc.getValue(this.id);
        badge.className = 'calc-badge ' + (v ? 'calc-true' : 'calc-false') + ' calc-badge--explain';
        badge.textContent = v ? '\u2713 true' : '\u2717 false';
      } else {
        const s = rc.getValue(this.id);
        badge.className = 'preview-calc-value';
        badge.textContent = (s !== undefined && s !== '') ? String(s) : '\u2014';
      }
    };
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
  buildBuilder() {
    const node = this;

    const wrapper = document.createElement('div');
    wrapper.className = 'node-wrap';

    const div = document.createElement('div');
    div.className = 'node node-item';
    div.dataset.nodeId = node.id;
    node._initNavListener(div);

    wrapper.appendChild(node._buildDropZoneAbove());

    const header = document.createElement('div');
    header.className = 'node-header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'node-title';
    const dragHandle = node._buildDragHandle();
    if (dragHandle) titleWrap.insertBefore(dragHandle, titleWrap.firstChild);

    const typeLabel = document.createElement('span');
    typeLabel.className = 'node-type-label lbl-item';
    typeLabel.dataset.testid = 'node-type-label';
    typeLabel.textContent = '[Item]';
    titleWrap.appendChild(typeLabel);

    const prefixInput = node._buildPrefixInput('prefix');
    titleWrap.appendChild(prefixInput);

    const linkIdInput = node._buildLinkIdInput();
    titleWrap.appendChild(linkIdInput);

    const { titleRow, titleDisplay, titleTextarea } = node._buildInlineTitleEditor();

    titleWrap.addEventListener('click', e => {
      if (e.target === titleTextarea || e.target === titleDisplay || e.target === linkIdInput || e.target === prefixInput) return;
      node._dispatchNavigate();
    });

    const actions = document.createElement('div');
    actions.className = 'node-actions';

    const setActive = (el, active) => el.classList.toggle('action-edit--active', active);

    const typeLink = node._makeActionLink('Answer Type', 'type', {
      title: 'Answer Type',
      body:  'Sets the FHIR item type (boolean, decimal, string, choice, date, url, attachment, reference, quantity, display). Controls which input control is rendered in the preview.',
      fhir:  'Questionnaire.item.type',
      spec:  'R4 \u00B7 required',
    }, actions);
    typeLink.onclick = () => MODAL_REGISTRY.get('answerType').open(node, typeLink, setActive);

    const statesLink = node._makeActionLink('States', 'states', {
      title: 'Item / group states',
      body:  'Required \u2014 must be answered to pass validation.\nRead-only \u2014 value set programmatically, not editable (items only).\nHidden \u2014 excluded from patient view; participates in logic.',
      fhir:  'item.required / item.readOnly / sdc-questionnaire-hidden',
      spec:  'R4 \u00B7 SDC',
    }, actions);
    statesLink.dataset.testid   = 'action-states';
    statesLink.onclick = () => MODAL_REGISTRY.get('states').open(node, statesLink, setActive);
    actions.appendChild(statesLink);

    const visLink = node._makeActionLink('Show When', 'vis', {
      title: 'Show When (enableWhen)',
      body:  'Add enableWhen conditions to control when this item is visible. Supports FHIR R4 enableWhen[] (AND/OR) and SDC enableWhenExpression (FHIRPath). Hidden items are dimmed \uD83D\uDD12 in the preview.',
      fhir:  'Questionnaire.item.enableWhen[]',
      spec:  'R4 \u00B7 optional',
    }, actions);
    visLink.onclick = () => MODAL_REGISTRY.get('showWhen').open(node, visLink, setActive);

    const exprLink = node._makeActionLink('Expression', 'expr', {
      title: 'FHIRPath Expressions',
      body:  'Edit both FHIRPath expression fields: calculatedExpression (evaluated on every preview render) and initialExpression (evaluated once on load or re-init). Both support questionnaire-level %variables.',
      fhir:  'sdc-questionnaire-calculatedExpression / initialExpression',
      spec:  'SDC \u00B7 optional',
    }, actions);
    exprLink.onclick = () => MODAL_REGISTRY.get('expression').openDual(node, exprLink, setActive, BaseNode._svc.triggerCalcRecalc);

    const repeatLink = node._makeActionLink('Repeatable', 'repeatable', {
      title: 'Repeatable',
      body:  'Allow multiple answers for this item. Opens a dialog to configure item.repeats and optional cardinality (minOccurs / maxOccurs extensions).',
      fhir:  'Questionnaire.item.repeats',
      spec:  'R4',
    }, actions);
    repeatLink.onclick = () => MODAL_REGISTRY.get('repeatable').open(node, repeatLink, setActive);

    const initLink = node._makeActionLink('Default', 'default', {
      title: 'Default Value (initial)',
      body:  'Pre-fills the answer when the form loads. The user can change it unless readOnly is set. Only the first entry (initial[0]) is used. Supports all item types.',
      fhir:  'Questionnaire.item.initial[]',
      spec:  'R4 \u00B7 optional',
    }, actions);
    initLink.onclick = () => MODAL_REGISTRY.get('initial').open(node, initLink, setActive);

    const constraintLink = node._makeActionLink('Constraint', 'constraint', {
      title: 'Validation Constraints (questionnaire-constraint)',
      body:  'FHIR questionnaire-constraint extensions on this item. Each entry has a FHIRPath expression, human-readable message, and severity. Error-severity constraints must pass for the item to show \u2714 in the preview.',
      fhir:  'Questionnaire.item.extension[questionnaire-constraint]',
      spec:  'R4 \u00B7 optional',
    }, actions);
    constraintLink.onclick = () => MODAL_REGISTRY.get('constraint').open(node, constraintLink, setActive);

    const styleLink = node._makeActionLink('Appearance', 'appearance', {
      title: 'Appearance (rendering-style)',
      body:  'Inline CSS applied to the item title in the preview. Supports bold, italic, text colour, and raw CSS. Stored in the standard FHIR rendering-style extension on the _text element.',
      fhir:  'Questionnaire.item._text.extension[rendering-style]',
      spec:  'R4 \u00B7 optional',
    }, actions);
    styleLink.onclick = () => MODAL_REGISTRY.get('appearance').open(node, styleLink, setActive);

    const codesLink = node._makeActionLink('Props', 'codes', {
      title: 'Item Properties',
      body:  'Edit item-level metadata: definition URL (item.definition \u2014 points to a StructureDefinition element) and terminology codes (item.code[] \u2014 LOINC, SNOMED, etc.).',
      fhir:  'Questionnaire.item.definition / item.code[]',
      spec:  'R4 \u00B7 optional',
    }, actions);
    codesLink.onclick = () => MODAL_REGISTRY.get('codes').open(node, codesLink, setActive);

    const noteLink = node._makeActionLink('Note', 'note', {
      title: 'Design Note',
      body:  'Internal author note \u2014 stored as FHIR designNote extension. Never shown to patients.',
      fhir:  'http://hl7.org/fhir/StructureDefinition/designNote',
      spec:  'R4 \u00B7 optional',
    }, actions);
    noteLink.onclick = () => MODAL_REGISTRY.get('note').open(node, noteLink, setActive);
    setActive(noteLink, !!node._designNote);

    const termLink = node._makeActionLink('Terminology', 'terminology', {
      title: 'Preferred Terminology Server',
      body:  'Per-item override for the FHIR terminology server used to expand ValueSets. Falls back to the Questionnaire-level default.',
      fhir:  'item.extension[sdc-questionnaire-preferredTerminologyServer].valueUrl',
      spec:  'SDC',
    }, actions);
    termLink.onclick = () => MODAL_REGISTRY.get('terminology').open(node, termLink, setActive);
    setActive(termLink, !!node._preferredTermServer);

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
      const ok = await BaseNode._svc.confirmDelete(node.title || node.id);
      if (ok) { BaseNode._svc.findAndRemove(node.id, BaseNode._svc.tree); BaseNode.notifyChanged(); node._dispatchRerender(); }
    };

    div.appendChild(header);
    div.appendChild(btnDel);

    setActive(typeLink,        true);
    setActive(visLink,        !!(node.enableWhen?.length) || !!node.enableWhenExpression);
    setActive(exprLink,       !!(node._calculatedExpr || node._initialExpr));
    setActive(statesLink,     node.mandatory === true || !!node._readOnly || !!node._hidden || !!node._usageMode || !!node._signatureRequired?.length);
    setActive(repeatLink,     !!node.repeats);
    if (!node.supportsRepeat()) repeatLink.style.display = 'none';
    setActive(initLink,       node._initialValue !== undefined && node._initialValue !== '');
    setActive(styleLink,      !!(node._renderStyle || node._renderXhtml));
    setActive(constraintLink, !!(node.constraint?.length));
    setActive(codesLink,      !!(node._codes?.length) || !!node._definition || !!(node._supportLinks?.some(u => u)));
    setActive(termLink,        !!node._preferredTermServer);

    wrapper.appendChild(div);
    return wrapper;
  }
}
