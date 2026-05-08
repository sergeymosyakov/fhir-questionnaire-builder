// ── Left panel: builder tree ──────────────────────────────────────────────────
import { tree, makeGroup, makeItem, findAndRemove, escAttr, _formTick } from './state.js';

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

function renderNode(node) {
  const div = document.createElement('div');
  div.className = 'node ' + (node.type === 'group' ? 'node-group' : 'node-item');
  div.dataset.nodeId = node.id;

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

  const titleInput = document.createElement('input');
  titleInput.type  = 'text';
  titleInput.value = node.title;
  titleInput.className = 'node-title-input';
  titleInput.oninput = () => { node.title = titleInput.value; };
  titleWrap.appendChild(titleInput);

  // Left → Right navigation: click header → scroll to preview row
  titleWrap.style.cursor = 'pointer';
  titleWrap.title = 'Click to navigate to preview row';
  titleWrap.addEventListener('click', e => {
    if (e.target === titleInput || e.target === linkIdInput) return;
    const target = document.querySelector('[data-preview-id="' + node.id + '"]');
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('preview-flash');
    setTimeout(() => target.classList.remove('preview-flash'), 1000);
  });

  header.appendChild(titleWrap);

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
  };

  addToggle('Visibility', 'vis');
  addToggle('Mandatory',  'mand');
  addToggle('Style',      'style');

  if (node.type === 'item') {
    addToggle('Condition', 'cond');
    addToggle('Item type', 'type');
  } else {
    addToggle('Condition', 'cond');
    const aSub = document.createElement('a');
    aSub.textContent = '+ Group';
    aSub.className = 'action-add';
    aSub.onclick = () => {
      const newNode = makeGroup('New Group');
      node.children.push(newNode);
      _collapsed.set(node.id, false);
      renderTree();
      requestAnimationFrame(() => {
        const el = document.querySelector('[data-node-id="' + newNode.id + '"]');
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('node-flash'); setTimeout(() => el.classList.remove('node-flash'), 1000); }
      });
    };
    actions.appendChild(aSub);

    const aItem = document.createElement('a');
    aItem.textContent = '+ Item';
    aItem.className = 'action-add';
    aItem.onclick = () => {
      const siblings = node.children.filter(c => c.type === 'item');
      const template = siblings.length > 0 ? siblings[siblings.length - 1] : null;
      const newNode = makeItem('New Item', template);
      node.children.push(newNode);
      _collapsed.set(node.id, false);
      renderTree();
      requestAnimationFrame(() => {
        const el = document.querySelector('[data-node-id="' + newNode.id + '"]');
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('node-flash'); setTimeout(() => el.classList.remove('node-flash'), 1000); }
      });
    };
    actions.appendChild(aItem);
  }

  const aDel = document.createElement('a');
  aDel.textContent = 'Delete';
  aDel.className = 'action-delete';
  aDel.onclick = () => { findAndRemove(node.id, tree); renderTree(); };
  actions.appendChild(aDel);

  header.appendChild(actions);
  div.appendChild(header);

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
    if (node._enableWhenText) {
      const friendly = document.createElement('div');
      friendly.style.cssText = 'margin-bottom:6px; padding:4px 8px; background:#fff8e1; border:1px solid #ffe082; border-radius:4px; font-size:11px; color:#5d4037;';
      friendly.innerHTML = '\uD83D\uDD12 <b>Shown when:</b> ' + escAttr(node._enableWhenText);
      p.appendChild(friendly);
    }

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
    rawInp.oninput = () => { node.visibilityRule = rawInp.value; };
    p.appendChild(rawInp);
  });

  addPanel('mand', p => {
    p.innerHTML = 'Mandatory: <input type="checkbox"' + (node.mandatory ? ' checked' : '') + '>';
    p.querySelector('input').onchange = function () { node.mandatory = this.checked; };
  });

  if (node.type === 'item') {
    addPanel('cond', p => {
      p.innerHTML = 'Condition rule (age, bmi, proc, comorb):<br>'
        + '<input type="text" value="' + escAttr(node.conditionRule) + '">';
      p.querySelector('input').oninput = function () { node.conditionRule = this.value; };
    });

    addPanel('type', p => {
      const typeRow = document.createElement('div');
      typeRow.textContent = 'Item type: ';
      const typeSelect = document.createElement('select');
      typeSelect.style.width = 'auto';
      for (const t of ['text', 'number', 'checkbox', 'select', 'display']) {
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

    boldCb.onchange   = sync;
    italicCb.onchange = sync;
    colorInp.oninput  = () => { current.color = colorInp.value; colorClear._cleared = false; sync(); };
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

  if (node.type === 'group') {
    addPanel('cond', p => {
      p.innerHTML = 'Condition rule — if false, group is N/A (disabled, not FAIL):<br>'
        + '<small style="color:#aaa;font-size:10px">Variables: age, gender, bmi, pregnant, smoker, proc, comorb</small>'
        + '<input type="text" value="' + escAttr(node.conditionRule) + '">';
      p.querySelector('input').oninput = function () { node.conditionRule = this.value; };
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
    div.appendChild(body);
  }

  return div;
}
