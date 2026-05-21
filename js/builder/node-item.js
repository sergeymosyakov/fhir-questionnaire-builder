// ── Item node renderer ────────────────────────────────────────────────────────
// renderItem(node, ctx: BuilderCtx) → HTMLElement  — see ctx.js
import { findAndRemove } from '../utils.js';
import { navigateToPreview, refreshExprIcons } from '../render-preview.js';
import { makeDragHandle, attachDropZone } from './dnd.js';
import { buildVisPanel } from './panels.js';
import * as answerTypeModal from '../ui/answer-type-modal.js';
import * as statesModal from '../ui/states-modal.js';
import * as showWhenModal from '../ui/showwhen-modal.js';
import * as constraintModal from '../ui/constraint-modal.js';
import * as expressionModal from '../ui/expression-modal.js';
import * as initialModal from '../ui/initial-modal.js';
import * as appearanceModal from '../ui/appearance-modal.js';
import * as repeatableModal from '../ui/repeatable-modal.js';
import * as codesModal from '../ui/codes-modal.js';
import { triggerCalcRecalc, confirmDelete } from './_shared.js';

export function renderItem(node, ctx) {
  const { renderTree } = ctx;

  const wrapper = document.createElement('div');
  wrapper.className = 'node-wrap';

  const div = document.createElement('div');
  div.className = 'node node-item';
  div.dataset.nodeId = node.id;

  // Drop zone above (outside the styled box)
  const dropAbove = document.createElement('div');
  dropAbove.className = 'drop-zone drop-zone-above';
  dropAbove.textContent = 'Drop here';
  attachDropZone(dropAbove, node, 'before');
  wrapper.appendChild(dropAbove);

  // ── Header ────────────────────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'node-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'node-title';
  titleWrap.insertBefore(makeDragHandle(node), titleWrap.firstChild);

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
  prefixInput.title = 'Display prefix (e.g. 1.2) — cosmetic only, does not affect logic';
  prefixInput.oninput = () => {
    const v = prefixInput.value.trim();
    node._prefix = v || undefined;
  };
  titleWrap.appendChild(prefixInput);
  const linkIdInput = document.createElement('input');
  linkIdInput.type = 'text';
  linkIdInput.value = node.id;
  linkIdInput.className = 'node-linkid-input';
  linkIdInput.title = 'FHIR linkId \u2014 editable';
  linkIdInput.oninput = () => { node.id = linkIdInput.value.trim() || node.id; };
  titleWrap.appendChild(linkIdInput);

  // Expandable title
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

  // Navigate to preview row on header click
  titleWrap.addEventListener('click', e => {
    if (e.target === titleTextarea || e.target === titleDisplay || e.target === linkIdInput || e.target === prefixInput) return;
    navigateToPreview(node.id);
  });

  // ── Actions ───────────────────────────────────────────────────────────────
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
      refreshExprIcons();
    };
    actions.appendChild(a);
    return a;
  };
  const setActive = (el, active) => el.classList.toggle('action-edit--active', active);

  const typeLink  = addToggle('Answer Type', 'type',
    'Answer Type',
    'Sets the FHIR item type (boolean, decimal, string, choice, date, url, attachment, reference, quantity, display). Controls which input control is rendered in the preview.',
    'Questionnaire.item.type', 'R4 · required');
  typeLink.dataset.testid = 'action-type';
  typeLink.onclick = () => answerTypeModal.open(node, typeLink, setActive);
  const statesLink = document.createElement('a');
  statesLink.textContent = 'States';
  statesLink.className = 'action-edit';
  statesLink.dataset.tipTitle = 'Item / group states';
  statesLink.dataset.tipBody  = 'Required \u2014 must be answered to pass validation.\nRead-only \u2014 value set programmatically, not editable (items only).\nHidden \u2014 excluded from patient view; participates in logic.';
  statesLink.dataset.tipFhir  = 'item.required / item.readOnly / sdc-questionnaire-hidden';
  statesLink.dataset.tipSpec  = 'R4 \u00B7 SDC';
  statesLink.dataset.testid   = 'action-states';
  statesLink.onclick = () => statesModal.open(node, statesLink, setActive);
  actions.appendChild(statesLink);
  const visLink   = addToggle('Show When', 'vis',
    'Show When (enableWhen)',
    'Add enableWhen conditions to control when this item is visible. Supports FHIR R4 enableWhen[] (AND/OR) and SDC enableWhenExpression (FHIRPath). Hidden items are dimmed \uD83D\uDD12 in the preview.',
    'Questionnaire.item.enableWhen[]', 'R4 \u00B7 optional');
  visLink.dataset.testid = 'action-vis';
  visLink.onclick = () => showWhenModal.open(node, visLink, setActive, ctx, buildVisPanel);
  const exprLink = addToggle('Expression', 'expr',
    'FHIRPath Expressions',
    'Edit both FHIRPath expression fields: calculatedExpression (evaluated on every preview render) and initialExpression (evaluated once on load or re-init). Both support questionnaire-level %variables.',
    'sdc-questionnaire-calculatedExpression / initialExpression', 'SDC · optional');
  exprLink.dataset.testid = 'action-expr';
  exprLink.onclick = () => expressionModal.openDual(node, exprLink, setActive, triggerCalcRecalc);

  // Repeatable — opens modal for repeats + minOccurs / maxOccurs
  const repeatLink = document.createElement('a');
  repeatLink.textContent = 'Repeatable';
  repeatLink.className = 'action-edit';
  repeatLink.dataset.tipTitle = 'Repeatable';
  repeatLink.dataset.tipBody  = 'Allow multiple answers for this item. Opens a dialog to configure item.repeats and optional cardinality (minOccurs / maxOccurs extensions).';
  repeatLink.dataset.tipFhir  = 'Questionnaire.item.repeats';
  repeatLink.dataset.tipSpec  = 'R4';
  repeatLink.dataset.testid   = 'action-repeatable';
  repeatLink.onclick = () => repeatableModal.open(node, repeatLink, setActive);
  actions.appendChild(repeatLink);

  const initLink  = addToggle('Default', 'init',
    'Default Value (initial)',
    'Pre-fills the answer when the form loads. The user can change it unless readOnly is set. Only the first entry (initial[0]) is used. Supports all item types.',
    'Questionnaire.item.initial[]', 'R4 · optional');
  initLink.dataset.testid = 'action-default';
  initLink.onclick = () => initialModal.open(node, initLink, setActive);
  const constraintLink = addToggle('Constraint', 'constraint',
    'Validation Constraints (questionnaire-constraint)',
    'FHIR questionnaire-constraint extensions on this item. Each entry has a FHIRPath expression, human-readable message, and severity. Error-severity constraints must pass for the item to show \u2714 in the preview.',
    'Questionnaire.item.extension[questionnaire-constraint]', 'R4 \u00B7 optional');
  constraintLink.dataset.testid = 'action-constraint';
  constraintLink.onclick = () => constraintModal.open(node, constraintLink, setActive);
  const styleLink = addToggle('Appearance', 'style',
    'Appearance (rendering-style)',
    'Inline CSS applied to the item title in the preview. Supports bold, italic, text colour, and raw CSS. Stored in the standard FHIR rendering-style extension on the _text element.',
    'Questionnaire.item._text.extension[rendering-style]', 'R4 \u00B7 optional');
  styleLink.dataset.testid = 'action-appearance';
  styleLink.onclick = () => appearanceModal.open(node, styleLink, setActive);

  const codesLink = document.createElement('a');
  codesLink.textContent = 'Props';
  codesLink.className = 'action-edit';
  codesLink.dataset.tipTitle = 'Item Properties';
  codesLink.dataset.tipBody  = 'Edit item-level metadata: definition URL (item.definition — points to a StructureDefinition element) and terminology codes (item.code[] — LOINC, SNOMED, etc.).';
  codesLink.dataset.tipFhir  = 'Questionnaire.item.definition / item.code[]';
  codesLink.dataset.tipSpec  = 'R4 \u00B7 optional';
  codesLink.dataset.testid   = 'action-codes';
  codesLink.onclick = () => codesModal.open(node, codesLink, setActive);
  actions.appendChild(codesLink);

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
  btnDel.title = 'Delete';
  btnDel.onclick = async () => {
    const ok = await confirmDelete(node.title || node.id);
    if (ok) { findAndRemove(node.id, ctx.tree); renderTree(); }
  };

  div.appendChild(header);
  div.appendChild(btnDel);

  setActive(typeLink,        true);  // Answer type is always set
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
