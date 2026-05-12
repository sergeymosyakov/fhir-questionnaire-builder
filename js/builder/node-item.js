// ── Item node renderer ────────────────────────────────────────────────────────
// renderItem(node, ctx: BuilderCtx) → HTMLElement  — see ctx.js
import { findAndRemove, escAttr } from '../utils.js';
import { makeDragHandle, attachDropZone } from './dnd.js';
import { addPanel, buildVisPanel, buildMandPanel, buildCondPanel, buildTypePanel, buildExprPanel, buildStylePanel } from './panels.js';

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
  titleDisplay.textContent = node.title || '(no title)';
  const titleTextarea = document.createElement('textarea');
  titleTextarea.className = 'node-title-textarea';
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
  titleWrap.style.cursor = 'pointer';
  titleWrap.title = 'Click to navigate to preview row';
  titleWrap.addEventListener('click', e => {
    if (e.target === titleTextarea || e.target === titleDisplay || e.target === linkIdInput) return;
    const target = document.querySelector('[data-preview-id="' + node.id + '"]');
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('preview-flash');
    setTimeout(() => target.classList.remove('preview-flash'), 1000);
  });

  // ── Actions ───────────────────────────────────────────────────────────────
  const actions = document.createElement('div');
  actions.className = 'node-actions';
  const panels = {};
  let openKey = null;

  const addToggle = (label, key) => {
    const a = document.createElement('a');
    a.textContent = label;
    a.className = 'action-edit';
    a.onclick = () => {
      openKey = openKey === key ? null : key;
      for (const k of Object.keys(panels)) panels[k].style.display = openKey === k ? 'block' : 'none';
    };
    actions.appendChild(a);
    return a;
  };
  const setActive = (el, active) => el.classList.toggle('action-edit--active', active);

  const typeLink  = addToggle('Answer Type', 'type');
  const mandLink  = addToggle('Required',      'mand');
  const visLink   = addToggle('Show When',     'vis');
  const condLink  = addToggle('Applicability', 'cond');
  const exprLink  = addToggle('Expression',    'expr');
  const styleLink = addToggle('Appearance',    'style');

  const headerTop = document.createElement('div');
  headerTop.className = 'node-header-top';
  headerTop.appendChild(titleWrap);
  headerTop.appendChild(actions);
  header.appendChild(headerTop);
  header.appendChild(titleRow);

  const btnDel = document.createElement('button');
  btnDel.textContent = '\u2715';
  btnDel.className = 'btn-node-delete';
  btnDel.title = 'Delete';
  btnDel.onclick = () => { findAndRemove(node.id, ctx.tree); renderTree(); };

  div.appendChild(header);
  div.appendChild(btnDel);

  // ── Panels ────────────────────────────────────────────────────────────────
  addPanel('type', p => buildTypePanel(node, p), div, panels);
  addPanel('mand', p => buildMandPanel(node, p, mandLink, setActive), div, panels);
  addPanel('vis',  p => buildVisPanel(node, p, visLink, setActive, ctx), div, panels);
  addPanel('cond', p => buildCondPanel(node, p, condLink, setActive, false), div, panels);
  addPanel('expr', p => buildExprPanel(node, p, exprLink, setActive), div, panels);
  addPanel('style',p => buildStylePanel(node, p, styleLink, setActive, ctx), div, panels);

  setActive(visLink,   !!node.visibilityRule);
  setActive(condLink,  !!node.conditionRule);
  setActive(exprLink,  !!node._calculatedExpr);
  setActive(styleLink, !!node._renderStyle);
  setActive(mandLink,  node.mandatory === true);

  wrapper.appendChild(div);

  return wrapper;
}
