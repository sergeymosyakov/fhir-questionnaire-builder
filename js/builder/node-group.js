// ── Group node renderer ───────────────────────────────────────────────────────
// renderGroup(node, ctx: BuilderCtx) → HTMLElement  — see ctx.js
import { findAndRemove, escAttr } from '../utils.js';
import { navigateToPreview } from '../render-preview.js';
import { makeGroup, makeItem } from '../state.js';
import { formatSeg, confirmDelete, triggerCalcRecalc } from './_shared.js';
import { makeDragHandle, attachDropZone } from './dnd.js';
import { addPanel, buildVisPanel, buildStylePanel } from './panels.js';
import * as requiredModal from '../ui/required-modal.js';
import * as expressionModal from '../ui/expression-modal.js';
import * as showWhenModal from '../ui/showwhen-modal.js';

export function renderGroup(node, ctx) {
  const { renderTree, renderNode } = ctx;

  const wrapper = document.createElement('div');
  wrapper.className = 'node-wrap';

  const div = document.createElement('div');
  div.className = 'node node-group';
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

  // Collapse toggle
  const collapsed = ctx.collapsed.get(node.id) || false;
  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'node-collapse-btn';
  toggleBtn.dataset.testid = 'group-collapse-btn';
  toggleBtn.textContent = collapsed ? '\u25B6' : '\u25BC';
  toggleBtn.title = collapsed ? 'Expand' : 'Collapse';
  toggleBtn.onclick = e => {
    e.stopPropagation();
    const isNowCollapsed = !(ctx.collapsed.get(node.id) || false);
    ctx.collapsed.set(node.id, isNowCollapsed);
    toggleBtn.textContent = isNowCollapsed ? '\u25B6' : '\u25BC';
    toggleBtn.title = isNowCollapsed ? 'Expand' : 'Collapse';
    const body = div.querySelector('.node-body');
    if (body) body.style.display = isNowCollapsed ? 'none' : '';
  };
  titleWrap.appendChild(toggleBtn);
  titleWrap.insertBefore(makeDragHandle(node), titleWrap.firstChild);

  const isEmptyGroupNode = node.children.length === 0;
  const typeLabel = document.createElement('span');
  typeLabel.className = 'node-type-label ' + (isEmptyGroupNode ? 'lbl-info' : 'lbl-group');
  typeLabel.dataset.testid = 'node-type-label';
  typeLabel.textContent = isEmptyGroupNode ? '[Info]' : '[Group]';
  titleWrap.appendChild(typeLabel);

  const linkIdInput = document.createElement('input');
  linkIdInput.type = 'text';
  linkIdInput.value = node.id;
  linkIdInput.className = 'node-linkid-input';
  linkIdInput.title = 'FHIR linkId \u2014 editable';
  linkIdInput.oninput = () => { node.id = linkIdInput.value.trim() || node.id; };

  const prefixInput = document.createElement('input');
  prefixInput.type = 'text';
  prefixInput.value = node._prefix || '';
  prefixInput.className = 'node-prefix-input';
  prefixInput.placeholder = '\u2014';
  prefixInput.title = 'Display prefix (e.g. 1.) \u2014 cosmetic only, does not affect logic';
  prefixInput.oninput = () => {
    const v = prefixInput.value.trim();
    node._prefix = v || undefined;
  };

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

  // Navigate to preview row
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
    };
    actions.appendChild(a);
    return a;
  };
  const setActive = (el, active) => el.classList.toggle('action-edit--active', active);

  const mandLink  = addToggle('Required', 'mand',
    'Required',
    'Whether all items in this group must be answered. Required groups show ✔/✘ and affect the final PASS/FAIL result.',
    'Questionnaire.item.required', 'R4 · optional');
  mandLink.dataset.testid = 'action-mand';
  mandLink.onclick = () => requiredModal.open(node, mandLink, setActive);
  const visLink   = addToggle('Show When', 'vis',
    'Show When (enableWhen)',
    'Add enableWhen conditions to control when this group is visible. Supports FHIR R4 enableWhen[] (AND/OR) and SDC enableWhenExpression (FHIRPath). Hidden groups are dimmed \uD83D\uDD12 in the preview.',
    'Questionnaire.item.enableWhen[]', 'R4 \u00B7 optional');
  visLink.onclick = () => showWhenModal.open(node, visLink, setActive, ctx, buildVisPanel);
  const exprLink  = addToggle('Expression', 'expr',
    'Calculated Expression',
    'SDC FHIRPath calculatedExpression on this group item. Evaluated on Test click. Supports questionnaire-level %variables.',
    'sdc-questionnaire-calculatedExpression', 'SDC · optional');
  exprLink.onclick = () => expressionModal.open({
    node, link: exprLink, setActive,
    field:       '_calculatedExpr',
    label:       'Calculated Expression',
    fhirLabel:   'FHIRPath calculatedExpression:',
    placeholder: "%resource.item.where(linkId='...')",
    onApply:     triggerCalcRecalc,
  });
  const styleLink = addToggle('Appearance', 'style',
    'Appearance (rendering-style)',
    'Inline CSS applied to the group title in the preview. Stored in the standard FHIR rendering-style extension on the _text element.',
    'Questionnaire.item._text.extension[rendering-style]', 'R4 · optional');

  // ⊕ Add ▾ dropdown
  const addWrap = document.createElement('div');
  addWrap.className = 'action-add-wrap';
  const addBtn = document.createElement('button');
  addBtn.className = 'action-add-btn';
  addBtn.dataset.testid = 'group-add-btn';
  addBtn.innerHTML = '&#x2295; Add &#x25BE;';
  const addMenu = document.createElement('div');
  addMenu.className = 'action-add-menu';
  addMenu.style.display = 'none';

  const addChild = (label, factory) => {
    const mi = document.createElement('div');
    mi.className = 'action-add-menu-item';
    mi.dataset.testid = 'add-menu-' + label.toLowerCase();
    mi.textContent = label;
    mi.onclick = () => {
      addMenu.style.display = 'none';
      const newNode = factory();
      node.children.push(newNode);
      ctx.formTick.value++;
      ctx.collapsed.set(node.id, false);
      renderTree();
      requestAnimationFrame(() => {
        const el = document.querySelector('[data-node-id="' + newNode.id + '"]');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          el.classList.add('node-flash');
          setTimeout(() => el.classList.remove('node-flash'), 1000);
        }
      });
    };
    addMenu.appendChild(mi);
  };

  addChild('Group', () => {
    const n = makeGroup('New Group');
    n.id = node.id + '.' + formatSeg(node.children.length + 1);
    return n;
  });
  addChild('Item', () => {
    const siblings = node.children.filter(c => c.type === 'item');
    const template = siblings.length > 0 ? siblings[siblings.length - 1] : null;
    const n = makeItem('New Item', template);
    n.id = node.id + '.' + formatSeg(node.children.length + 1);
    return n;
  });

  addBtn.onclick = e => {
    e.stopPropagation();
    const open = addMenu.style.display !== 'none';
    document.querySelectorAll('.action-add-menu').forEach(m => { m.style.display = 'none'; });
    addMenu.style.display = open ? 'none' : 'block';
  };
  addWrap.appendChild(addBtn);
  addWrap.appendChild(addMenu);
  actions.appendChild(addWrap);

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
  btnDel.dataset.testid = 'node-delete-btn';
  btnDel.title = 'Delete';
  btnDel.onclick = async () => {
    const ok = await confirmDelete(node.title || node.id);
    if (ok) { findAndRemove(node.id, ctx.tree); renderTree(); }
  };

  div.appendChild(header);
  div.appendChild(btnDel);

  // ── Panels ────────────────────────────────────────────────────────────────
  addPanel('style', p => buildStylePanel(node, p, styleLink, setActive, ctx), div, panels);

  setActive(visLink,   !!(node.enableWhen?.length) || !!node.enableWhenExpression);
  setActive(exprLink,  !!node._calculatedExpr);
  setActive(styleLink, !!node._renderStyle);
  setActive(mandLink,  node.mandatory === true);

  // ── Body: children + logic row ────────────────────────────────────────────
  const body = document.createElement('div');
  body.className = 'node-body';
  if (ctx.collapsed.get(node.id)) body.style.display = 'none';

  const logicRow = document.createElement('div');
  logicRow.className = 'logic-row';
  logicRow.textContent = 'Logic between children: ';
  const logicSel = document.createElement('select');
  for (const v of ['AND', 'OR']) {
    const opt = document.createElement('option');
    opt.value = v; opt.textContent = v;
    if (node.logicWithParent === v) opt.selected = true;
    logicSel.appendChild(opt);
  }
  logicSel.onchange = () => { node.logicWithParent = logicSel.value; };
  logicRow.appendChild(logicSel);
  body.appendChild(logicRow);

  for (let i = 0; i < node.children.length; i++) {
    const childWrap = renderNode(node.children[i]);
    if (i === 0) {
      const firstDrop = childWrap.querySelector('.drop-zone-above');
      if (firstDrop) firstDrop.textContent = 'Drop here to add as first child';
    }
    body.appendChild(childWrap);
  }

  const dropInside = document.createElement('div');
  dropInside.className = 'drop-zone drop-zone-inside';
  dropInside.textContent = 'Drop here to add as last child';
  attachDropZone(dropInside, node, 'inside-last');
  body.appendChild(dropInside);

  div.appendChild(body);

  wrapper.appendChild(div);

  return wrapper;
}
