// ── Builder node extension ────────────────────────────────────────────────────
// Augments the (preview-only) node classes with their builder-panel rendering:
// buildBuilder() for groups/items, the inline answer-type row, and the thin
// builder-helper delegators. Imported ONLY by the builder side, so js/nodes/*
// stays free of builder imports (dnd, builder-helpers, gear menu, modal registry)
// and the renderer widget bundle never pulls builder code.
import { BaseNode } from '../nodes/base-node.js';
import { GroupNode } from '../nodes/group-node.js';
import { ItemNode } from '../nodes/item-node.js';
import * as bh from './builder-helpers.js';
import { MODAL_REGISTRY } from '../ui/modals/modal-registry.js';
import { NodeGearMenu } from '../ui/node-gear-menu.js';
import { createCustomSelect } from '../ui/custom-select.js';
import { AppEvents, EventState } from '../events.js';
import { FHIR } from '../fhir/urls/fhir.js';
import { ITEM_TYPES, ITEM_TYPE_LABELS } from '../ui/modals/answer-type/data.js';
import { changeNodeType, nodeTypeNeedsConfig, nodeHasTypeConfig } from '../nodes/change-type.js';

const { addCopyPasteGearItems, applyMetaLabelTips, addMetaRowGearItem, buildInsideDropZone } = bh;

// ── BaseNode builder-panel helpers (thin delegators to builder-helpers) ───────
BaseNode.prototype._buildInlineTitleEditor = function () { return bh.buildInlineTitleEditor(this); };
BaseNode.prototype._buildLinkIdInput       = function () { return bh.buildLinkIdInput(this); };
BaseNode.prototype._buildPrefixInput       = function (ph) { return bh.buildPrefixInput(this, ph); };
BaseNode.prototype._makeActionLink         = function (l, k, t, c) { return bh.makeActionLink(this, l, k, t, c); };
BaseNode.prototype._buildDragHandle        = function () { return bh.buildDragHandle(this); };
BaseNode.prototype._buildDropZoneAbove     = function () { return bh.buildDropZoneAbove(this); };
BaseNode.prototype._addChildGearItems      = function (gear) { bh.addChildGearItems(gear, this); };

// ── GroupNode.buildBuilder ────────────────────────────────────────────────────
GroupNode.prototype.buildBuilder = function () {
  const node = this;

  const wrapper = document.createElement('div');
  wrapper.className = 'node-wrap';

  const div = document.createElement('div');
  div.className = 'node node-group';
  div.dataset.nodeId = node.id;
  node._initNavListener(div);

  wrapper.appendChild(node._buildDropZoneAbove());

  const header = document.createElement('div');
  header.className = 'node-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'node-title';

  const toggleBtn = node._buildCollapseBtn(div);
  titleWrap.appendChild(toggleBtn);
  const dragHandle = node._buildDragHandle();
  if (dragHandle) titleWrap.insertBefore(dragHandle, titleWrap.firstChild);

  const isEmptyGroupNode = node.children.length === 0;
  const typeLabel = document.createElement('span');
  typeLabel.className = 'node-type-label ' + (isEmptyGroupNode ? 'lbl-info' : 'lbl-group');
  typeLabel.dataset.testid = 'node-type-label';
  typeLabel.textContent = isEmptyGroupNode ? '[Info]' : '[Group]';
  titleWrap.appendChild(typeLabel);

  const linkIdInput = node._buildLinkIdInput();

  const prefixInput = node._buildPrefixInput('\u2014');

  const { titleRow, titleDisplay, titleTextarea } = node._buildInlineTitleEditor();

  titleWrap.addEventListener('click', e => {
    if (e.target === titleTextarea || e.target === titleDisplay || e.target === linkIdInput || e.target === prefixInput) return;
    node._dispatchNavigate();
  });

  const actions = document.createElement('div');
  actions.className = 'node-actions';

  const setActive = (el, active) => el.classList.toggle('action-edit--active', active);

  const statesLink = node._makeActionLink('States', 'states', {
    title: 'Item / group states',
    body:  'Required \u2014 must be answered to pass validation.\nHidden \u2014 excluded from patient view; participates in logic.\nCollapsible \u2014 group starts collapsed or expanded in patient view.',
    fhir:  'item.required / sdc-questionnaire-hidden / sdc-questionnaire-collapsible',
    spec:  'R4 \u00B7 SDC',
  }, actions);
  statesLink.onclick = () => MODAL_REGISTRY.get('states').open(node, statesLink, setActive);

  const visLink = node._makeActionLink('Show When', 'vis', {
    title: 'Show When (enableWhen)',
    body:  'Add enableWhen conditions to control when this group is visible. Supports FHIR R4 enableWhen[] (AND/OR) and SDC enableWhenExpression (FHIRPath). Hidden groups are dimmed \uD83D\uDD12 in the preview.',
    fhir:  'Questionnaire.item.enableWhen[]',
    spec:  'R4 \u00B7 optional',
  }, actions);
  visLink.onclick = () => MODAL_REGISTRY.get('showWhen').open(node, visLink, setActive);

  const exprLink = node._makeActionLink('Expression', 'expr', {
    title: 'Calculated Expression',
    body:  'SDC FHIRPath calculatedExpression on this group item. Evaluated on Test click. Supports questionnaire-level %variables.',
    fhir:  'sdc-questionnaire-calculatedExpression',
    spec:  'SDC \u00B7 optional',
  }, actions);
  exprLink.onclick = () => MODAL_REGISTRY.get('expression').open({
    node, link: exprLink, setActive,
    field:       '_calculatedExpr',
    label:       'Calculated Expression',
    fhirLabel:   'FHIRPath calculatedExpression:',
    placeholder: "%resource.item.where(linkId='...')",
    onApply: () => document.dispatchEvent(new CustomEvent(AppEvents.CALC_RECALC_REQUESTED)),
  });

  const repeatLink = node._makeActionLink('Repeatable', 'repeatable', {
    title: 'Repeatable group',
    body:  'When enabled the group repeats \u2014 the respondent can fill in multiple entries. Stored as FHIR item.repeats. Use min/max occurrences to constrain the number of entries.',
    fhir:  'Questionnaire.item.repeats',
    spec:  'R4',
  }, actions);
  repeatLink.onclick = () => MODAL_REGISTRY.get('repeatable').open(node, repeatLink, setActive);

  const styleLink = node._makeActionLink('Appearance', 'style', {
    title: 'Appearance (rendering-style)',
    body:  'Inline CSS applied to the group title in the preview. Stored in the standard FHIR rendering-style extension on the _text element.',
    fhir:  'Questionnaire.item._text.extension[rendering-style]',
    spec:  'R4 \u00B7 optional',
  }, actions);
  styleLink.onclick = () => MODAL_REGISTRY.get('appearance').open(node, styleLink, setActive);

  const propsLink = node._makeActionLink('Props', 'codes', {
    title: 'Group Properties',
    body:  'Edit group-level metadata: definition URL, terminology codes (item.code[]) and support links (questionnaire-supportLink).',
    fhir:  'Questionnaire.item.definition / item.code[] / questionnaire-supportLink',
    spec:  'R4 \u00B7 optional',
  }, actions);
  propsLink.onclick = () => MODAL_REGISTRY.get('codes').open(node, propsLink, setActive);

  const noteLink = node._makeActionLink('Note', 'note', {
    title: 'Design Note',
    body:  'Internal author note \u2014 stored as FHIR designNote extension. Never shown to patients.',
    fhir:  FHIR.designNote,
    spec:  'R4 \u00B7 optional',
  }, actions);
  noteLink.onclick = () => MODAL_REGISTRY.get('note').open(node, noteLink, setActive);
  setActive(noteLink, !!node._designNote);

  // ⚙ gear menu (Add Group / Add Item / Copy / Paste / Delete)
  const gear = new NodeGearMenu('group-add-btn');
  addMetaRowGearItem(gear, node);
  gear.addSep();
  node._addChildGearItems(gear);
  gear.addSep();
  addCopyPasteGearItems(gear, node, BaseNode._hasClipboard);
  gear.addSep();
  gear.addItem('Delete', 'node-delete-btn', () => {
    document.dispatchEvent(new CustomEvent(AppEvents.NODE_DELETE_REQUESTED,
      { detail: { id: node.id, label: node.title || node.id } }));
  }, { destructive: true });

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
  applyMetaLabelTips(idLbl, prefixLbl);
  metaRow.appendChild(idLbl);
  metaRow.appendChild(linkIdInput);
  metaRow.appendChild(prefixLbl);
  metaRow.appendChild(prefixInput);

  header.appendChild(headerTop);
  header.appendChild(titleRow);
  header.appendChild(metaRow);
  header.appendChild(actions);

  div.appendChild(header);
  div.appendChild(gear.el);


  setActive(visLink,    !!(node.enableWhen?.length) || !!node.enableWhenExpression);
  setActive(exprLink,   !!node._calculatedExpr);
  setActive(styleLink,  !!(node._renderStyle || node._renderXhtml || node._itemControl === 'header' || node._itemControl === 'footer'));
  setActive(statesLink, node.mandatory === true || !!node._hidden || node._observationExtract != null || !!node._collapsible || !!node._usageMode || !!node._signatureRequired?.length);
  setActive(propsLink,  !!(node._codes?.length) || !!node._definition || !!(node._supportLinks?.length) || !!node._shortText);
  setActive(repeatLink, !!node.repeats);

  const body = document.createElement('div');
  body.className = 'node-body';
  if (BaseNode._collapseMap.get(node.id)) body.style.display = 'none';

  const logicRow = document.createElement('div');
  logicRow.className = 'logic-row';
  logicRow.textContent = 'Logic between children: ';
  const logicSel = createCustomSelect({
    items:    [{ value: 'AND', label: 'AND' }, { value: 'OR', label: 'OR' }],
    value:    node.logicWithParent || 'AND',
    className: 'sc-trigger--sm',
    testid:   'group-logic-select',
    onChange: v => { node.logicWithParent = v; document.dispatchEvent(new CustomEvent(AppEvents.RESPONSE_CHANGED)); },
  });
  logicRow.appendChild(logicSel.el);
  body.appendChild(logicRow);

  for (let i = 0; i < node.children.length; i++) {
    const childWrap = node.children[i].buildBuilder();
    if (i === 0) {
      const firstDrop = childWrap.querySelector('.drop-zone-above');
      if (firstDrop) firstDrop.textContent = 'Drop here to add as first child';
    }
    body.appendChild(childWrap);
  }

  body.appendChild(buildInsideDropZone(node));

  div.appendChild(body);
  wrapper.appendChild(div);
  return wrapper;
};

// ── ItemNode inline answer-type row ───────────────────────────────────────────
// Builds the inline answer-type row shown in every builder card (both view
// modes). A compact type dropdown that fills the row + a config button opening
// the full Answer Type modal (highlighted for choice-family types, whose answer
// options are defined in that modal).
const _TUNE_SVG =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/>' +
  '<line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/>' +
  '<line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>' +
  '<line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/>' +
  '<line x1="17" y1="16" x2="23" y2="16"/></svg>';

function buildInlineTypeRow(node, setActive) {
  const row = document.createElement('div');
  row.className = 'node-inline-type';

  const lbl = document.createElement('span');
  lbl.className = 'node-meta-label node-meta-label--type';
  lbl.textContent = 'type:';
  lbl.dataset.tipTitle = 'Answer type';
  lbl.dataset.tipBody  = 'The FHIR data type for answers to this item (text, integer, choice, date, \u2026). Determines which control renders in the preview.';
  lbl.dataset.tipFhir  = 'Questionnaire.item.type';
  lbl.dataset.tipSpec  = 'R4';
  row.appendChild(lbl);

  const ctx = EventState.get(AppEvents.APP_CONTEXT_READY);
  const fhirTarget = ctx?.questDoc?.fhirTarget ?? 'R4';
  const types = fhirTarget === 'R5' ? ITEM_TYPES.filter(t => t !== 'open-choice') : ITEM_TYPES;

  const sel = createCustomSelect({
    items:     types.map(t => ({ value: t, label: ITEM_TYPE_LABELS[t] || t })),
    value:     node.itemType,
    className: 'sc-trigger--sm',
    testid:    'inline-answer-type',
    onChange:  v => {
      if (v === node.itemType) return;
      const _ctx = EventState.get(AppEvents.APP_CONTEXT_READY);
      changeNodeType(node, v, _ctx?.questDoc?.tree, _ctx?.answerStore);
      document.dispatchEvent(new CustomEvent(AppEvents.BUILDER_RERENDER));
      document.dispatchEvent(new CustomEvent(AppEvents.CALC_RECALC_REQUESTED));
    },
  });
  row.appendChild(sel.el);

  const isChoice  = nodeTypeNeedsConfig(node);
  const hasConfig = !isChoice && nodeHasTypeConfig(node);
  const cfg = document.createElement('button');
  cfg.type = 'button';
  cfg.className = 'node-inline-type-config'
    + (isChoice  ? ' node-inline-type-config--attn'   : '')
    + (hasConfig ? ' node-inline-type-config--active'  : '');
  cfg.dataset.testid = 'action-type';
  cfg.innerHTML = _TUNE_SVG;
  cfg.dataset.tipTitle = isChoice  ? 'Answer options'
                       : hasConfig ? 'Answer type settings (configured)'
                       :             'Answer type settings';
  cfg.dataset.tipBody  = isChoice
    ? 'Answer options for this type are configured in the Answer Type dialog. Click to open.'
    : hasConfig
    ? 'This item has Answer Type settings configured. Click to view or change them.'
    : 'Configure options, value sets, units, and other advanced settings for this answer type.';
  cfg.onclick = () => {
    const _ctx = EventState.get(AppEvents.APP_CONTEXT_READY);
    MODAL_REGISTRY.get('answerType').open(node, null, setActive, _ctx?.questDoc, _ctx?.answerStore);
  };
  row.appendChild(cfg);

  return row;
}

// ── ItemNode.buildBuilder ─────────────────────────────────────────────────────
ItemNode.prototype.buildBuilder = function () {
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

  // Collapse button — shown when item has sub-items
  if (node.children.length > 0) {
    titleWrap.appendChild(node._buildCollapseBtn(div));
  }

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
  exprLink.onclick = () => MODAL_REGISTRY.get('expression').openDual(node, exprLink, setActive,
    () => document.dispatchEvent(new CustomEvent(AppEvents.CALC_RECALC_REQUESTED)));

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
    fhir:  FHIR.designNote,
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
  applyMetaLabelTips(idLbl, prefixLbl);
  metaRow.appendChild(idLbl);
  metaRow.appendChild(linkIdInput);
  metaRow.appendChild(prefixLbl);
  metaRow.appendChild(prefixInput);

  header.appendChild(headerTop);
  header.appendChild(titleRow);
  header.appendChild(buildInlineTypeRow(node, setActive));
  header.appendChild(metaRow);
  header.appendChild(actions);

  // ⚙ gear menu (Add Sub-group / Add Sub-item / Copy / Paste / Delete)
  const gear = new NodeGearMenu('node-gear-btn');
  addMetaRowGearItem(gear, node);
  gear.addSep();
  node._addChildGearItems(gear);
  gear.addSep();
  addCopyPasteGearItems(gear, node, BaseNode._hasClipboard);
  gear.addSep();
  gear.addItem('Delete', 'node-delete-btn', () => {
    document.dispatchEvent(new CustomEvent(AppEvents.NODE_DELETE_REQUESTED,
      { detail: { id: node.id, label: node.title || node.id } }));
  }, { destructive: true });

  div.appendChild(header);
  div.appendChild(gear.el);

  setActive(visLink,        !!(node.enableWhen?.length) || !!node.enableWhenExpression);
  setActive(exprLink,       !!(node._calculatedExpr || node._initialExpr));
  setActive(statesLink,     node.mandatory === true || !!node._readOnly || !!node._hidden || node._observationExtract != null || !!node._usageMode || !!node._signatureRequired?.length);
  setActive(repeatLink,     !!node.repeats);
  if (!node.supportsRepeat()) repeatLink.style.display = 'none';
  setActive(initLink,       node._initialValue !== undefined && node._initialValue !== '');
  setActive(styleLink,      !!(node._renderStyle || node._renderXhtml));
  setActive(constraintLink, !!(node.constraint?.length));
  setActive(codesLink,      !!(node._codes?.length) || !!node._definition || !!(node._supportLinks?.some(u => u)) || !!node._shortText);
  setActive(termLink,        !!node._preferredTermServer);

  if (node.children.length > 0) {
    const body = document.createElement('div');
    body.className = 'node-body';
    if (BaseNode._collapseMap.get(node.id)) body.style.display = 'none';
    for (let i = 0; i < node.children.length; i++) {
      const childWrap = node.children[i].buildBuilder();
      if (i === 0) {
        const firstDrop = childWrap.querySelector('.drop-zone-above');
        if (firstDrop) firstDrop.textContent = 'Drop here to add as first sub-item';
      }
      body.appendChild(childWrap);
    }
    body.appendChild(buildInsideDropZone(node));
    div.appendChild(body);
  }

  wrapper.appendChild(div);
  return wrapper;
};
