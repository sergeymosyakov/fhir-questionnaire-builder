// ── Item node renderer ────────────────────────────────────────────────────────
// renderItem(node, ctx: BuilderCtx) → HTMLElement  — see ctx.js
import { findAndRemove, escAttr } from '../utils.js';
import { navigateToPreview, refreshExprIcons } from '../render-preview.js';
import { makeDragHandle, attachDropZone } from './dnd.js';
import { addPanel, buildVisPanel, buildMandPanel, buildTypePanel, buildStylePanel, buildInitialPanel } from './panels.js';
import * as showWhenModal from '../ui/showwhen-modal.js';
import * as constraintModal from '../ui/constraint-modal.js';
import * as expressionModal from '../ui/expression-modal.js';
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
  typeLabel.textContent = '[Item]';
  titleWrap.appendChild(typeLabel);

  const navBtn = document.createElement('button');
  navBtn.type = 'button';
  navBtn.className = 'node-nav-btn';
  navBtn.title = 'Navigate to preview row';
  navBtn.textContent = '\u2197'; // ↗
  navBtn.addEventListener('click', e => {
    e.stopPropagation();
    navigateToPreview(node.id);
  });
  titleWrap.appendChild(navBtn);
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
    const target = document.querySelector('[data-preview-id="' + node.id + '"]');
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target.classList.add('preview-flash');
    setTimeout(() => target.classList.remove('preview-flash'), 1000);
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
  const mandLink  = addToggle('Required', 'mand',
    'Required',
    'Whether the item must be answered. Required items show ✔/✘ validation in the preview and affect the final PASS/FAIL result.',
    'Questionnaire.item.required', 'R4 · optional');
  mandLink.dataset.testid = 'action-mand';
  const visLink   = addToggle('Show When', 'vis',
    'Show When (enableWhen)',
    'Add enableWhen conditions to control when this item is visible. Supports FHIR R4 enableWhen[] (AND/OR) and SDC enableWhenExpression (FHIRPath). Hidden items are dimmed \uD83D\uDD12 in the preview.',
    'Questionnaire.item.enableWhen[]', 'R4 \u00B7 optional');
  visLink.onclick = () => showWhenModal.open(node, visLink, setActive, ctx, buildVisPanel);
  const exprLink  = addToggle('Expression', 'expr',
    'Calculated Expression',
    'SDC FHIRPath expression evaluated automatically on every preview render. Result is written into the answer field. Supports questionnaire-level %variables.',
    'sdc-questionnaire-calculatedExpression', 'SDC · optional');
  exprLink.onclick = () => expressionModal.open({
    node, link: exprLink, setActive,
    field:       '_calculatedExpr',
    label:       'Calculated Expression',
    fhirLabel:   'FHIRPath calculatedExpression:',
    placeholder: "%resource.item.where(linkId='...')",
    onApply:     triggerCalcRecalc,
  });
  const initExprLink = addToggle('Init Expr', 'initExpr',
    'Initial Expression',
    'SDC FHIRPath expression evaluated once to pre-populate this field. Click \u21BA Re-init in the Variables panel to apply. Unlike calculatedExpression, this runs only on load/re-init.',
    'sdc-questionnaire-initialExpression', 'SDC · optional');
  initExprLink.onclick = () => expressionModal.open({
    node, link: initExprLink, setActive,
    field:       '_initialExpr',
    label:       'Initial Expression',
    fhirLabel:   'sdc-questionnaire-initialExpression:',
    hint:        'FHIRPath expression evaluated once to populate this field. Click \u21BA Re-init in the Variables panel to apply.',
    placeholder: "e.g. %age > 18 or %today",
  });

  // Read-only toggle — direct boolean, no panel needed
  const roLink = document.createElement('a');
  roLink.textContent = 'Read-only';
  roLink.className = 'action-edit';
  roLink.dataset.tipTitle = 'Read-only';
  roLink.dataset.tipBody  = 'Marks this field as read-only — the user cannot edit it. Typically combined with a calculatedExpression.';
  roLink.dataset.tipFhir  = 'Questionnaire.item.readOnly';
  roLink.dataset.tipSpec  = 'R4';
  roLink.onclick = () => {
    node._readOnly = !node._readOnly;
    setActive(roLink, !!node._readOnly);
    triggerCalcRecalc();
  };
  actions.appendChild(roLink);

  const initLink  = addToggle('Default', 'init',
    'Default Value (initial)',
    'Pre-fills the answer when the form loads. The user can change it unless readOnly is set. Only the first entry (initial[0]) is used. Supports all item types.',
    'Questionnaire.item.initial[]', 'R4 · optional');
  const constraintLink = addToggle('Constraint', 'constraint',
    'Validation Constraints (questionnaire-constraint)',
    'FHIR questionnaire-constraint extensions on this item. Each entry has a FHIRPath expression, human-readable message, and severity. Error-severity constraints must pass for the item to show \u2714 in the preview.',
    'Questionnaire.item.extension[questionnaire-constraint]', 'R4 \u00B7 optional');
  constraintLink.onclick = () => constraintModal.open(node, constraintLink, setActive);
  const styleLink = addToggle('Appearance', 'style',
    'Appearance (rendering-style)',
    'Inline CSS applied to the item title in the preview. Supports bold, italic, text colour, and raw CSS. Stored in the standard FHIR rendering-style extension on the _text element.',
    'Questionnaire.item._text.extension[rendering-style]', 'R4 \u00B7 optional');
  const headerTop = document.createElement('div');
  headerTop.className = 'node-header-top';
  headerTop.appendChild(titleWrap);
  headerTop.appendChild(actions);

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

  const btnDel = document.createElement('button');
  btnDel.textContent = '\u2715';
  btnDel.className = 'btn-node-delete';
  btnDel.title = 'Delete';
  btnDel.onclick = async () => {
    const ok = await confirmDelete(node.title || node.id);
    if (ok) { findAndRemove(node.id, ctx.tree); renderTree(); }
  };

  div.appendChild(header);
  div.appendChild(btnDel);

  // ── Panels ────────────────────────────────────────────────────────────────
  addPanel('type', p => buildTypePanel(node, p), div, panels);
  addPanel('mand', p => buildMandPanel(node, p, mandLink, setActive), div, panels);
  addPanel('init', p => buildInitialPanel(node, p, initLink, setActive), div, panels);
  addPanel('style',p => buildStylePanel(node, p, styleLink, setActive, ctx), div, panels);

  setActive(visLink,        !!(node.enableWhen?.length) || !!node.enableWhenExpression);
  setActive(exprLink,       !!node._calculatedExpr);
  setActive(initExprLink,   !!node._initialExpr);
  setActive(roLink,         !!node._readOnly);
  setActive(initLink,       node._initialValue !== undefined && node._initialValue !== '');
  setActive(styleLink,      !!node._renderStyle);
  setActive(mandLink,       node.mandatory === true);
  setActive(constraintLink, !!(node.constraint?.length));

  wrapper.appendChild(div);

  return wrapper;
}
