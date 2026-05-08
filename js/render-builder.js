// ── Left panel: builder tree ──────────────────────────────────────────────────
import { tree, makeGroup, makeItem, findAndRemove, escAttr, _formTick, rawFhir, calcTested, values } from './state.js';
import { buildQR } from './fhir/qr-builder.js';
import { evalCalcNodes } from './fhir/calc.js';

const fhirpath = window.fhirpath;

function _triggerCalcRecalc() {
  if (calcTested.value && rawFhir.value && fhirpath) {
    const qr = buildQR(JSON.parse(JSON.stringify(rawFhir.value)), values);
    evalCalcNodes(tree, qr, fhirpath, values);
  }
  _formTick.value++;
}

// Tracks collapse state per node id (UI-only, not part of FHIR data)
const _collapsed = new Map();

// Collect all item nodes from the tree (flat, with path titles for dropdowns)
function getAllItems(nodes, result = [], prefix = '') {
  for (const n of nodes) {
    if (n.type === 'item') {
      result.push({ id: n.id, label: (prefix ? prefix + ' › ' : '') + n.title, itemType: n.itemType, options: n.options });
    } else if (n.type === 'group') {
      getAllItems(n.children, result, (prefix ? prefix + ' › ' : '') + n.title);
    }
  }
  return result;
}

export function renderTree() {
  const container = document.getElementById('treeContainer');
  container.innerHTML = '';
  for (const node of tree) container.appendChild(renderNode(node));

  // Root-level drop zone at the very bottom
  const rootDrop = document.createElement('div');
  rootDrop.className = 'drop-zone drop-zone-root';
  rootDrop.style.cssText = 'height:32px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#bbb;border:1px dashed #ddd;border-radius:4px;margin-top:4px;opacity:0;transition:opacity .15s';
  rootDrop.addEventListener('dragover', e => { if (_dragId) { e.preventDefault(); rootDrop.style.opacity = '1'; rootDrop.style.borderColor = 'var(--c-primary)'; rootDrop.style.color = 'var(--c-primary)'; } });
  rootDrop.addEventListener('dragleave', () => { rootDrop.style.opacity = '0'; rootDrop.style.borderColor = '#ddd'; rootDrop.style.color = '#bbb'; });
  rootDrop.addEventListener('drop', e => {
    e.preventDefault();
    rootDrop.style.opacity = '0';
    if (!_dragId) return;
    const src = _findNode(tree, _dragId);
    if (!src) return;
    src.arr.splice(src.idx, 1);
    tree.push(src.node);
    renderTree();
    _formTick.value++;
  });
  rootDrop.textContent = 'Drop here to move to end';
  container.appendChild(rootDrop);
}

// Collapse/expand all groups in a subtree recursively
function setCollapsedAll(nodes, value) {
  for (const n of nodes) {
    if (n.type === 'group') {
      _collapsed.set(n.id, value);
      setCollapsedAll(n.children, value);
    }
  }
}

export function collapseAll() { setCollapsedAll(tree, true);  renderTree(); }
export function expandAll()   { setCollapsedAll(tree, false); renderTree(); }

// ── Renumber all nodes with hierarchical IDs ──────────────────────────────────
function toRoman(n) {
  const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
  const syms = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
  let r = '';
  for (let i = 0; i < vals.length; i++) { while (n >= vals[i]) { r += syms[i]; n -= vals[i]; } }
  return r;
}
function toLetter(n) {
  let r = '';
  while (n > 0) { r = String.fromCharCode(64 + ((n - 1) % 26 + 1)) + r; n = Math.floor((n - 1) / 26); }
  return r;
}
export function renumberAll(format) {
  const idMap = new Map();
  _applyNumbers(format, tree, '');
  // Pass 1: collect oldId→newId from _oldId markers set by _applyNumbers
  _walkNodes(tree, n => {
    if (n._oldId !== undefined) { idMap.set(n._oldId, n.id); delete n._oldId; }
  });
  // Pass 2: rewrite all visibilityRules and _calculatedExpr
  _walkNodes(tree, n => {
    if (n.visibilityRule) {
      idMap.forEach((newId, oldId) => {
        if (newId) n.visibilityRule = n.visibilityRule.split(`'${oldId}'`).join(`'${newId}'`);
      });
    }
    if (n._calculatedExpr) {
      idMap.forEach((newId, oldId) => {
        if (newId) n._calculatedExpr = n._calculatedExpr.split(`'${oldId}'`).join(`'${newId}'`);
      });
    }
  });
  renderTree();
}

function _walkNodes(nodes, fn) {
  for (const n of nodes) {
    fn(n);
    if (n.type === 'group') _walkNodes(n.children, fn);
  }
}

function _applyNumbers(format, nodes, prefix) {
  nodes.forEach((node, i) => {
    const idx = i + 1;
    const seg = format === 'roman'   ? toRoman(idx)
              : format === 'letters' ? toLetter(idx)
              : String(idx);
    const newId = prefix ? prefix + '.' + seg : seg;
    node._oldId = node.id;
    node.id = newId;
    if (node.type === 'group' && node.children.length) _applyNumbers(format, node.children, newId);
  });
}

// ── Success-value UI (rebuilt when itemType changes, stays inside open panel) ─
function buildSuccessValueUI(node, container) {
  container.innerHTML = '';
  const header = document.createElement('div');
  header.style.marginTop = '6px';

  if (node.itemType === 'checkbox') {
    header.textContent = 'Success when: ';
    const sel = document.createElement('select');
    sel.style.width = 'auto';
    [['true', 'checked'], ['false', 'unchecked']].forEach(([val, label]) => {
      const opt = document.createElement('option');
      opt.value = val; opt.textContent = label;
      if ((node.successValue || 'true') === val) opt.selected = true;
      sel.appendChild(opt);
    });
    if (!node.successValue) node.successValue = 'true';
    sel.onchange = () => { node.successValue = sel.value; };
    header.appendChild(sel);
  } else {
    header.textContent = 'Success value (exact match):';
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.placeholder = node.itemType === 'number' ? 'e.g. 42' : 'e.g. yes';
    inp.value = node.successValue || '';
    inp.style.marginTop = '2px';
    inp.oninput = () => { node.successValue = inp.value; };
    header.appendChild(inp);
  }

  container.appendChild(header);
}

// ── Drag & Drop ───────────────────────────────────────────────────────────────
let _dragId = null; // nodeId being dragged

// Find node and its parent array + index in the tree
function _findNode(nodes, id, parent = null) {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) return { node: nodes[i], arr: nodes, idx: i, parent };
    if (nodes[i].type === 'group') {
      const r = _findNode(nodes[i].children, id, nodes[i]);
      if (r) return r;
    }
  }
  return null;
}

// Returns true if `ancestorId` is an ancestor of `nodeId`
function _isAncestor(ancestorId, nodeId) {
  const a = _findNode(tree, ancestorId);
  if (!a || a.node.type !== 'group') return false;
  return !!_findNode(a.node.children, nodeId);
}

function _onDragStart(e, node) {
  _dragId = node.id;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', node.id);
  setTimeout(() => {
    const el = document.querySelector('[data-node-id="' + node.id + '"]');
    if (el) el.classList.add('node-dragging');
  }, 0);
}

function _onDragEnd() {
  _dragId = null;
  document.querySelectorAll('.node-dragging').forEach(el => el.classList.remove('node-dragging'));
  document.querySelectorAll('.drop-indicator').forEach(el => el.remove());
  document.querySelectorAll('.node-drop-target').forEach(el => el.classList.remove('node-drop-target'));
}

// Insert dragged node before targetId (or inside groupId if position='inside')
function _doDrop(targetId, position) {
  if (!_dragId || _dragId === targetId) return;
  // Prevent dropping into own descendant
  if ((position === 'inside' || position === 'inside-last') && _isAncestor(_dragId, targetId)) return;
  if (position === 'inside' || position === 'inside-last') {
    const t = _findNode(tree, targetId);
    if (!t || t.node.type !== 'group') return;
  }

  const src = _findNode(tree, _dragId);
  if (!src) return;

  // Remove from current location
  src.arr.splice(src.idx, 1);

  if (position === 'inside') {
    const dest = _findNode(tree, targetId);
    if (dest) dest.node.children.unshift(src.node);
  } else if (position === 'inside-last') {
    const dest = _findNode(tree, targetId);
    if (dest) dest.node.children.push(src.node);
  } else {
    // before or after targetId
    const dest = _findNode(tree, targetId);
    if (!dest) { tree.push(src.node); }
    else {
      const insertIdx = position === 'before' ? dest.idx : dest.idx + 1;
      dest.arr.splice(insertIdx, 0, src.node);
    }
  }

  renderTree();
  _formTick.value++;
}

function _makeDragHandle(node) {
  const h = document.createElement('span');
  h.className = 'node-drag-handle';
  h.title = 'Drag to reorder';
  h.textContent = '⠿';
  h.draggable = true;
  h.addEventListener('dragstart', e => _onDragStart(e, node));
  h.addEventListener('dragend', _onDragEnd);
  return h;
}

function _addDropZone(div, node, position) {
  div.addEventListener('dragover', e => {
    if (!_dragId || _dragId === node.id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    div.classList.add('node-drop-target');
  });
  div.addEventListener('dragleave', e => {
    if (!div.contains(e.relatedTarget)) div.classList.remove('node-drop-target');
  });
  div.addEventListener('drop', e => {
    e.preventDefault();
    e.stopPropagation();
    div.classList.remove('node-drop-target');
    _doDrop(node.id, position);
  });
}

function renderNode(node) {
  const div = document.createElement('div');
  div.className = 'node ' + (node.type === 'group' ? 'node-group' : 'node-item');
  div.dataset.nodeId = node.id;

  // Drop zones: above and below this node
  const dropAbove = document.createElement('div');
  dropAbove.className = 'drop-zone drop-zone-above';
  _addDropZone(dropAbove, node, 'before');
  div.appendChild(dropAbove);

  const header = document.createElement('div');
  header.className = 'node-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'node-title';

  // Collapse toggle (groups only)
  if (node.type === 'group') {
    const collapsed = _collapsed.get(node.id) || false;
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'node-collapse-btn';
    toggleBtn.textContent = collapsed ? '▶' : '▼';
    toggleBtn.title = collapsed ? 'Expand' : 'Collapse';
    toggleBtn.onclick = e => {
      e.stopPropagation();
      const isNowCollapsed = !(_collapsed.get(node.id) || false);
      _collapsed.set(node.id, isNowCollapsed);
      toggleBtn.textContent = isNowCollapsed ? '▶' : '▼';
      toggleBtn.title = isNowCollapsed ? 'Expand' : 'Collapse';
      const body = div.querySelector('.node-body');
      if (body) body.style.display = isNowCollapsed ? 'none' : '';
    };
    titleWrap.appendChild(toggleBtn);
  }

  titleWrap.insertBefore(_makeDragHandle(node), titleWrap.firstChild);

  const isEmptyGroupNode = node.type === 'group' && node.children.length === 0;
  const typeLabel = document.createElement('span');
  typeLabel.className = 'node-type-label ' + (node.type === 'group' ? (isEmptyGroupNode ? 'lbl-info' : 'lbl-group') : 'lbl-item');
  typeLabel.textContent = node.type === 'group' ? (isEmptyGroupNode ? '[Info]' : '[Group]') : '[Item]';
  titleWrap.appendChild(typeLabel);

  // linkId (editable)
  const linkIdInput = document.createElement('input');
  linkIdInput.type = 'text';
  linkIdInput.value = node.id;
  linkIdInput.className = 'node-linkid-input';
  linkIdInput.title = 'FHIR linkId — editable';
  linkIdInput.oninput = () => { node.id = linkIdInput.value.trim() || node.id; };
  titleWrap.appendChild(linkIdInput);

  // Title: shown as a read-only span, expands to textarea on click
  const titleRow = document.createElement('div');
  titleRow.className = 'node-title-row';

  const titleDisplay = document.createElement('span');
  titleDisplay.className = 'node-title-display';
  titleDisplay.textContent = node.title || '(no title)';

  const titleTextarea = document.createElement('textarea');
  titleTextarea.className = 'node-title-textarea';
  titleTextarea.value = node.title;
  titleTextarea.style.display = 'none';
  titleTextarea.oninput = () => {
    node.title = titleTextarea.value;
    titleDisplay.textContent = titleTextarea.value || '(no title)';
  };
  titleTextarea.onblur = () => {
    titleTextarea.style.display = 'none';
    titleDisplay.style.display = '';
  };

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
  // titleRow goes directly into header (full-width, below controls row)
  // titleWrap does NOT contain titleRow anymore

  // Left → Right navigation: click header → scroll to preview row
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

  // node-header-top: drag + collapse + type label + linkId + actions (all inline)
  // titleRow goes below as full-width second line
  const headerTop = document.createElement('div');
  headerTop.className = 'node-header-top';
  headerTop.appendChild(titleWrap);
  header.appendChild(headerTop);
  header.appendChild(titleRow);

  const actions = document.createElement('div');
  actions.className = 'node-actions';

  let openKey = null;
  const panels = {};

  const addToggle = (label, key) => {
    const a = document.createElement('a');
    a.textContent = label;
    a.className = 'action-edit';
    a.onclick = () => {
      openKey = openKey === key ? null : key;
      for (const k of Object.keys(panels))
        panels[k].style.display = openKey === k ? 'block' : 'none';
    };
    actions.appendChild(a);
    return a;
  };

  const setActive = (el, active) => el.classList.toggle('action-edit--active', active);

  let visLink, condLink, exprLink, styleLink, mandLink;

  if (node.type === 'item') {
    addToggle('Answer Type', 'type');
    mandLink  = addToggle('Required',      'mand');
    visLink   = addToggle('Show When',     'vis');
    condLink  = addToggle('Applicability', 'cond');
    exprLink  = addToggle('Expression',    'expr');
    styleLink = addToggle('Appearance',    'style');
  } else {
    mandLink  = addToggle('Required',      'mand');
    visLink   = addToggle('Show When',     'vis');
    condLink  = addToggle('Applicability', 'cond');
    exprLink  = addToggle('Expression',    'expr');
    styleLink = addToggle('Appearance', 'style');

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
        _formTick.value++;
        _collapsed.set(node.id, false);
        renderTree();
        requestAnimationFrame(() => {
          const el = document.querySelector('[data-node-id="' + newNode.id + '"]');
          if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('node-flash'); setTimeout(() => el.classList.remove('node-flash'), 1000); }
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

    addBtn.onclick = (e) => {
      e.stopPropagation();
      const open = addMenu.style.display !== 'none';
      // close all other open menus
      document.querySelectorAll('.action-add-menu').forEach(m => { m.style.display = 'none'; });
      addMenu.style.display = open ? 'none' : 'block';
    };

    addWrap.appendChild(addBtn);
    addWrap.appendChild(addMenu);
    actions.appendChild(addWrap);
  }

  headerTop.appendChild(actions);
  div.appendChild(header);

  const btnDel = document.createElement('button');
  btnDel.textContent = '\u2715';
  btnDel.className = 'btn-node-delete';
  btnDel.title = 'Delete';
  btnDel.onclick = () => { findAndRemove(node.id, tree); renderTree(); };
  div.appendChild(btnDel);

  // Collapsible panels
  const addPanel = (key, buildFn) => {
    const p = document.createElement('div');
    p.className = 'hidden-panel';
    p.style.display = 'none';
    buildFn(p);
    panels[key] = p;
    div.appendChild(p);
  };

  addPanel('vis', p => {
    const friendly = document.createElement('div');
    friendly.style.cssText = 'margin-bottom:6px; padding:4px 8px; background:#fff8e1; border:1px solid #ffe082; border-radius:4px; font-size:11px; color:#5d4037;';
    const updateFriendly = () => {
      if (node._enableWhenText && node.visibilityRule) {
        friendly.innerHTML = '\uD83D\uDD12 <b>Shown when:</b> ' + escAttr(node._enableWhenText);
        friendly.style.display = 'block';
      } else {
        friendly.style.display = 'none';
      }
    };
    updateFriendly();
    p.appendChild(friendly);

    // ── Visual condition builder ──────────────────────────────────────
    const builderWrap = document.createElement('div');
    builderWrap.className = 'vis-builder';

    const items = getAllItems(tree).filter(it => it.id !== node.id);

    const qSel = document.createElement('select');
    qSel.className = 'vis-builder-sel';
    const blank = document.createElement('option');
    blank.value = ''; blank.textContent = '\u2014 pick a question \u2014';
    qSel.appendChild(blank);
    for (const it of items) {
      const opt = document.createElement('option');
      opt.value = it.id; opt.textContent = it.label;
      opt.dataset.itype = it.itemType; opt.dataset.opts = it.options || '';
      qSel.appendChild(opt);
    }

    const opSel = document.createElement('select');
    opSel.className = 'vis-builder-sel vis-builder-op';

    const valWrap = document.createElement('span');

    const preview = document.createElement('div');
    preview.className = 'vis-builder-preview';
    preview.style.display = 'none';

    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.className = 'vis-builder-apply';
    applyBtn.textContent = 'Use →';

    const rebuildValueInput = (itype, opts) => {
      valWrap.innerHTML = '';
      opSel.innerHTML = '';
      if (itype === 'checkbox') {
        ['== true|is Yes (checked)', '== false|is No (unchecked)'].forEach(s => {
          const [v, l] = s.split('|');
          const o = document.createElement('option'); o.value = v; o.textContent = l; opSel.appendChild(o);
        });
      } else {
        ['==|equals', '!=|not equals', '>|greater than', '<|less than'].forEach(s => {
          const [v, l] = s.split('|');
          const o = document.createElement('option'); o.value = v; o.textContent = l; opSel.appendChild(o);
        });
        if (itype === 'select' && opts) {
          const sel2 = document.createElement('select');
          sel2.className = 'vis-builder-sel';
          opts.split(',').map(s => s.trim()).filter(Boolean).forEach(o => {
            const opt = document.createElement('option'); opt.value = o; opt.textContent = o; sel2.appendChild(opt);
          });
          valWrap.appendChild(sel2);
        } else {
          const inp2 = document.createElement('input');
          inp2.type = itype === 'number' ? 'number' : 'text';
          inp2.placeholder = 'value';
          inp2.style.width = '70px';
          valWrap.appendChild(inp2);
        }
      }
    };

    const updatePreview = () => {
      const qid = qSel.value; if (!qid) { preview.style.display = 'none'; return; }
      const op  = opSel.value;
      const selOpt = qSel.options[qSel.selectedIndex];
      const itype = selOpt.dataset.itype;
      let valPart = '';
      if (itype === 'checkbox') {
        valPart = op;
      } else {
        const inp2 = valWrap.querySelector('input,select');
        const raw  = inp2 ? inp2.value : '';
        valPart = op + ' ' + (isNaN(raw) || raw === '' ? '\'' + raw.replace(/'/g, "\\'") + '\'' : raw);
      }
      const expr = `values['${qid}'] ${valPart}`;
      preview.textContent = expr;
      preview.style.display = 'block';
      applyBtn.onclick = () => {
        node.visibilityRule = expr;
        rawInp.value = expr;
        setActive(visLink, !!expr);
      };
    };

    qSel.onchange = () => {
      const selOpt = qSel.options[qSel.selectedIndex];
      if (!selOpt || !selOpt.value) { preview.style.display = 'none'; return; }
      rebuildValueInput(selOpt.dataset.itype, selOpt.dataset.opts);
      opSel.onchange = updatePreview;
      const inp2 = valWrap.querySelector('input,select');
      if (inp2) inp2.oninput = inp2.onchange = updatePreview;
      updatePreview();
    };

    builderWrap.appendChild(qSel);
    builderWrap.appendChild(opSel);
    builderWrap.appendChild(valWrap);
    builderWrap.appendChild(preview);
    builderWrap.appendChild(applyBtn);
    p.appendChild(builderWrap);

    // ── Raw JS (advanced) ─────────────────────────────────────────────
    const rawLbl = document.createElement('div');
    rawLbl.style.cssText = 'margin-top:8px; font-size:10px; color:#aaa; text-transform:uppercase; letter-spacing:.05em;';
    rawLbl.textContent = 'or type JS directly:';
    p.appendChild(rawLbl);
    const rawInp = document.createElement('input');
    rawInp.type = 'text'; rawInp.value = node.visibilityRule || '';
    rawInp.oninput = () => {
      node.visibilityRule = rawInp.value;
      if (!rawInp.value) node._enableWhenText = '';
      updateFriendly();
      setActive(visLink, !!rawInp.value);
    };
    p.appendChild(rawInp);
  });

  addPanel('mand', p => {
    const label = document.createElement('label');
    label.style.cssText = 'font-size:12px; display:flex; align-items:center; gap:6px;';
    label.textContent = 'Required:';
    const sel = document.createElement('select');
    sel.style.cssText = 'font-size:11px; padding:2px 4px; border-radius:4px; border:1px solid var(--c-border);';
    [['null', 'Not set (acts as required)'], ['true', 'Yes — required'], ['false', 'No — optional']].forEach(([val, text]) => {
      const o = document.createElement('option');
      o.value = val;
      o.textContent = text;
      if (String(node.mandatory) === val) o.selected = true;
      sel.appendChild(o);
    });
    sel.onchange = () => {
      node.mandatory = sel.value === 'null' ? null : sel.value === 'true';
      setActive(mandLink, node.mandatory === true);
    };
    label.appendChild(sel);
    p.appendChild(label);
  });

  if (node.type === 'item') {
    addPanel('cond', p => {
      p.innerHTML = 'Condition rule (age, bmi, proc, comorb):<br>'
        + '<input type="text" value="' + escAttr(node.conditionRule) + '">';
      p.querySelector('input').oninput = function () { node.conditionRule = this.value; setActive(condLink, !!this.value); };
    });

    addPanel('type', p => {
      const typeRow = document.createElement('div');
      typeRow.textContent = 'Type: ';
      const typeSelect = document.createElement('select');
      typeSelect.style.width = 'auto';
      for (const t of ['text', 'number', 'date', 'url', 'attachment', 'checkbox', 'select', 'radio', 'display']) {
        const opt = document.createElement('option');
        opt.value = t; opt.textContent = t;
        if (node.itemType === t) opt.selected = true;
        typeSelect.appendChild(opt);
      }
      typeRow.appendChild(typeSelect);
      p.appendChild(typeRow);

      const optionsDiv = document.createElement('div');
      optionsDiv.style.marginTop = '4px';
      optionsDiv.style.display = node.itemType === 'select' ? 'block' : 'none';
      optionsDiv.innerHTML = 'Options (comma-separated):<br>'
        + '<input type="text" value="' + escAttr(node.options) + '">';
      optionsDiv.querySelector('input').oninput = function () { node.options = this.value; };
      p.appendChild(optionsDiv);

      const successDiv = document.createElement('div');
      p.appendChild(successDiv);
      buildSuccessValueUI(node, successDiv);

      typeSelect.onchange = () => {
        node.itemType = typeSelect.value;
        optionsDiv.style.display = node.itemType === 'select' ? 'block' : 'none';
        buildSuccessValueUI(node, successDiv);
      };
    });
  }

  // Style panel (both group and item)
  addPanel('expr', p => {
    const lbl = document.createElement('div');
    lbl.style.cssText = 'font-size:11px;color:#666;margin-bottom:4px;';
    lbl.textContent = 'FHIRPath calculatedExpression:';
    p.appendChild(lbl);

    const ta = document.createElement('textarea');
    ta.rows = 4;
    ta.style.cssText = 'width:100%;font-size:11px;font-family:monospace;resize:vertical;border:1px solid var(--c-border);border-radius:4px;padding:4px 6px;box-sizing:border-box;';
    ta.value = node._calculatedExpr || '';
    ta.placeholder = '%resource.item.where(linkId=\'...\')';
    ta.oninput = () => {
      node._calculatedExpr = ta.value.trim() || undefined;
      setActive(exprLink, !!ta.value.trim());
      _triggerCalcRecalc();
    };
    p.appendChild(ta);

    const roRow = document.createElement('label');
    roRow.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:11px;margin-top:6px;cursor:pointer;';
    const roCb = document.createElement('input');
    roCb.type = 'checkbox';
    roCb.checked = !!node._readOnly;
    roCb.onchange = () => { node._readOnly = roCb.checked; _triggerCalcRecalc(); };
    roRow.appendChild(roCb);
    roRow.appendChild(document.createTextNode('readOnly (computed by expression, not user-editable)'));
    p.appendChild(roRow);
  });

  addPanel('style', p => {
    const styleRow = (label, fn) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:4px;font-size:12px;';
      const lbl = document.createElement('label');
      lbl.style.cssText = 'min-width:48px;color:#666;';
      lbl.textContent = label;
      row.appendChild(lbl);
      const ctrl = fn();
      row.appendChild(ctrl);
      p.appendChild(row);
      return ctrl;
    };

    const parseStyle = () => {
      const s = node._renderStyle || '';
      const bold   = /font-weight\s*:\s*bold/i.test(s);
      const italic = /font-style\s*:\s*italic/i.test(s);
      const colorM = s.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
      const color  = colorM ? colorM[1].trim() : '';
      return { bold, italic, color };
    };

    const buildStyle = (bold, italic, color) => {
      const parts = [
        'font-weight: ' + (bold   ? 'bold'   : 'normal'),
        'font-style: '  + (italic ? 'italic' : 'normal'),
      ];
      if (color) parts.push('color: ' + color);
      return parts.join('; ');
    };

    const current = parseStyle();

    const boldCb = document.createElement('input');
    boldCb.type = 'checkbox'; boldCb.checked = current.bold;

    const italicCb = document.createElement('input');
    italicCb.type = 'checkbox'; italicCb.checked = current.italic;

    const colorInp = document.createElement('input');
    colorInp.type = 'color';
    colorInp.value = current.color
      ? (current.color.startsWith('#') ? current.color : '#000000')
      : '#000000';
    colorInp.style.cssText = 'width:36px;height:22px;padding:1px;border:1px solid #ccc;cursor:pointer;';

    const colorClear = document.createElement('button');
    colorClear.type = 'button';
    colorClear.textContent = '✕';
    colorClear.style.cssText = 'font-size:10px;padding:1px 5px;';
    colorClear.title = 'Remove color';

    const rawInp = document.createElement('input');
    rawInp.type = 'text';
    rawInp.value = node._renderStyle || '';
    rawInp.placeholder = 'e.g. font-weight: bold; color: blue';
    rawInp.style.cssText = 'width:100%;margin-top:4px;font-size:11px;';

    const sync = () => {
      const color = colorClear._cleared ? '' : (current.color || colorInp.value);
      const s = buildStyle(boldCb.checked, italicCb.checked, color);
      node._renderStyle = s;
      rawInp.value = s;
      _formTick.value++;
    };

    const syncAndMark = () => { sync(); setActive(styleLink, !!node._renderStyle); };
    boldCb.onchange   = syncAndMark;
    italicCb.onchange = syncAndMark;
    colorInp.oninput  = () => { current.color = colorInp.value; colorClear._cleared = false; syncAndMark(); };
    colorClear.onclick = () => {
      colorClear._cleared = true;
      current.color = '';
      colorInp.value = '#000000';
      sync();
    };

    rawInp.oninput = () => {
      node._renderStyle = rawInp.value;
      const p2 = parseStyle();
      boldCb.checked   = p2.bold;
      italicCb.checked = p2.italic;
      if (p2.color && p2.color.startsWith('#')) colorInp.value = p2.color;
      setActive(styleLink, !!rawInp.value);
      _formTick.value++;
    };

    styleRow('Bold', () => boldCb);
    styleRow('Italic', () => italicCb);
    const colorRow = document.createElement('div');
    colorRow.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:4px;font-size:12px;';
    const colorLbl = document.createElement('label');
    colorLbl.style.cssText = 'min-width:48px;color:#666;';
    colorLbl.textContent = 'Color';
    colorRow.appendChild(colorLbl);
    colorRow.appendChild(colorInp);
    colorRow.appendChild(colorClear);
    p.appendChild(colorRow);

    const rawLbl = document.createElement('div');
    rawLbl.style.cssText = 'margin-top:4px;font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:.05em;';
    rawLbl.textContent = 'raw CSS:';
    p.appendChild(rawLbl);
    p.appendChild(rawInp);
  });

  // Initialise active indicators after all panels are built
  setActive(visLink,   !!node.visibilityRule);
  setActive(condLink,  !!node.conditionRule);
  setActive(exprLink,  !!node._calculatedExpr);
  setActive(styleLink, !!node._renderStyle);
  setActive(mandLink,  node.mandatory === true);

  if (node.type === 'group') {
    addPanel('cond', p => {
      p.innerHTML = 'Condition rule — if false, group is N/A (disabled, not FAIL):<br>'
        + '<small style="color:#aaa;font-size:10px">Variables: age, gender, bmi, pregnant, smoker, proc, comorb</small>'
        + '<input type="text" value="' + escAttr(node.conditionRule) + '">';
      p.querySelector('input').oninput = function () { node.conditionRule = this.value; setActive(condLink, !!this.value); };
    });

    const body = document.createElement('div');
    body.className = 'node-body';
    if (_collapsed.get(node.id)) body.style.display = 'none';

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

    // Drop zone at bottom of group children (drop as last child)
    const dropInside = document.createElement('div');
    dropInside.className = 'drop-zone drop-zone-inside';
    dropInside.textContent = 'Drop here to add as last child';
    _addDropZone(dropInside, node, 'inside-last');
    body.appendChild(dropInside);

    div.appendChild(body);
  }

  // Drop zone below this node
  const dropBelow = document.createElement('div');
  dropBelow.className = 'drop-zone drop-zone-below';
  _addDropZone(dropBelow, node, 'after');
  div.appendChild(dropBelow);

  return div;
}
