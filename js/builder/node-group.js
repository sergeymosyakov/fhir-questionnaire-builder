// ── Group node renderer ───────────────────────────────────────────────────────
// renderGroup(node, ctx: BuilderCtx) → HTMLElement  — see ctx.js
import { findAndRemove, escAttr } from '../utils.js';
import { makeGroup, makeItem } from '../state.js';
import { makeDragHandle, attachDropZone } from './dnd.js';
import { addPanel, buildVisPanel, buildMandPanel, buildCondPanel, buildExprPanel, buildStylePanel } from './panels.js';

export function renderGroup(node, ctx) {
  const { renderTree, renderNode } = ctx;

  const div = document.createElement('div');
  div.className = 'node node-group';
  div.dataset.nodeId = node.id;

  // Drop zone above
  const dropAbove = document.createElement('div');
  dropAbove.className = 'drop-zone drop-zone-above';
  attachDropZone(dropAbove, node, 'before');
  div.appendChild(dropAbove);

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
  typeLabel.textContent = isEmptyGroupNode ? '[Info]' : '[Group]';
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

  const mandLink  = addToggle('Required',      'mand');
  const visLink   = addToggle('Show When',     'vis');
  const condLink  = addToggle('Applicability', 'cond');
  const exprLink  = addToggle('Expression',    'expr');
  const styleLink = addToggle('Appearance',    'style');

  // ⊕ Add ▾ dropdown
  const addWrap = document.createElement('div');
  addWrap.className = 'action-add-wrap';
  const addBtn = document.createElement('button');
  addBtn.className = 'action-add-btn';
  addBtn.innerHTML = '&#x2295; Add &#x25BE;';
  const addMenu = document.createElement('div');
  addMenu.className = 'action-add-menu';
  addMenu.style.display = 'none';

  const addChild = (label, factory) => {
    const mi = document.createElement('div');
    mi.className = 'action-add-menu-item';
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
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('node-flash');
          setTimeout(() => el.classList.remove('node-flash'), 1000);
        }
      });
    };
    addMenu.appendChild(mi);
  };

  addChild('Group', () => makeGroup('New Group'));
  addChild('Item', () => {
    const siblings = node.children.filter(c => c.type === 'item');
    const template = siblings.length > 0 ? siblings[siblings.length - 1] : null;
    return makeItem('New Item', template);
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
  addPanel('mand',  p => buildMandPanel(node, p, mandLink, setActive), div, panels);
  addPanel('vis',   p => buildVisPanel(node, p, visLink, setActive, ctx), div, panels);
  addPanel('cond',  p => buildCondPanel(node, p, condLink, setActive, true), div, panels);
  addPanel('expr',  p => buildExprPanel(node, p, exprLink, setActive), div, panels);
  addPanel('style', p => buildStylePanel(node, p, styleLink, setActive, ctx), div, panels);

  setActive(visLink,   !!node.visibilityRule);
  setActive(condLink,  !!node.conditionRule);
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

  for (const ch of node.children) body.appendChild(renderNode(ch));

  const dropInside = document.createElement('div');
  dropInside.className = 'drop-zone drop-zone-inside';
  dropInside.textContent = 'Drop here to add as last child';
  attachDropZone(dropInside, node, 'inside-last');
  body.appendChild(dropInside);

  div.appendChild(body);

  // Drop zone below
  const dropBelow = document.createElement('div');
  dropBelow.className = 'drop-zone drop-zone-below';
  attachDropZone(dropBelow, node, 'after');
  div.appendChild(dropBelow);

  return div;
}
