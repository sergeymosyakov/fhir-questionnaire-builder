// ── Action panel builder ──────────────────────────────────────────────────────
// buildPanels(node, div, ctx) appends all hidden action panels to `div`.
//
// ctx = { renderTree, tree, formTick } (passed through from index.js via node-item/group)
//
// Each panel is keyed and toggled by the action links defined in node-item/group.
import { escAttr } from '../utils.js';
import { getAllItems, buildSuccessValueUI, triggerCalcRecalc } from './_shared.js';

// ── Panel factory helper ──────────────────────────────────────────────────────
export function addPanel(key, buildFn, div, panels) {
  const p = document.createElement('div');
  p.className = 'hidden-panel';
  p.style.display = 'none';
  buildFn(p);
  panels[key] = p;
  div.appendChild(p);
}

// ── Visibility panel ──────────────────────────────────────────────────────────
export function buildVisPanel(node, p, visLink, setActive, ctx) {
  const friendly = document.createElement('div');
  friendly.style.cssText = 'margin-bottom:6px;padding:4px 8px;background:#fff8e1;border:1px solid #ffe082;border-radius:4px;font-size:11px;color:#5d4037;';
  const updateFriendly = () => {
    friendly.innerHTML = node._enableWhenText && node.visibilityRule
      ? '\uD83D\uDD12 <b>Shown when:</b> ' + escAttr(node._enableWhenText)
      : '';
    friendly.style.display = (node._enableWhenText && node.visibilityRule) ? 'block' : 'none';
  };
  updateFriendly();
  p.appendChild(friendly);

  // Visual condition builder
  const builderWrap = document.createElement('div');
  builderWrap.className = 'vis-builder';
  const items = getAllItems(ctx.tree).filter(it => it.id !== node.id);

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
  applyBtn.textContent = 'Use \u2192';

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

  const rawLbl = document.createElement('div');
  rawLbl.style.cssText = 'margin-top:8px;font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:.05em;';
  rawLbl.textContent = 'or type JS directly:';
  p.appendChild(rawLbl);

  const rawInp = document.createElement('input');
  rawInp.type = 'text';
  rawInp.value = node.visibilityRule || '';
  rawInp.oninput = () => {
    node.visibilityRule = rawInp.value;
    if (!rawInp.value) node._enableWhenText = '';
    updateFriendly();
    setActive(visLink, !!rawInp.value);
  };
  p.appendChild(rawInp);
}

// ── Mandatory panel ───────────────────────────────────────────────────────────
export function buildMandPanel(node, p, mandLink, setActive) {
  const label = document.createElement('label');
  label.style.cssText = 'font-size:12px;display:flex;align-items:center;gap:6px;';
  label.textContent = 'Required:';
  const sel = document.createElement('select');
  sel.style.cssText = 'font-size:11px;padding:2px 4px;border-radius:4px;border:1px solid var(--c-border);';
  [['null', 'Not set (acts as required)'], ['true', 'Yes \u2014 required'], ['false', 'No \u2014 optional']].forEach(([val, text]) => {
    const o = document.createElement('option');
    o.value = val; o.textContent = text;
    if (String(node.mandatory) === val) o.selected = true;
    sel.appendChild(o);
  });
  sel.onchange = () => {
    node.mandatory = sel.value === 'null' ? null : sel.value === 'true';
    setActive(mandLink, node.mandatory === true);
  };
  label.appendChild(sel);
  p.appendChild(label);
}

// ── Condition panel ───────────────────────────────────────────────────────────
export function buildCondPanel(node, p, condLink, setActive, isGroup) {
  p.innerHTML = isGroup
    ? 'Condition rule \u2014 if false, group is N/A (disabled, not FAIL):<br>'
      + '<small style="color:#aaa;font-size:10px">Variables: age, gender, bmi, pregnant, smoker, proc, comorb</small>'
      + '<input type="text" value="' + escAttr(node.conditionRule) + '">'
    : 'Condition rule (age, bmi, proc, comorb):<br>'
      + '<input type="text" value="' + escAttr(node.conditionRule) + '">';
  p.querySelector('input').oninput = function () {
    node.conditionRule = this.value;
    setActive(condLink, !!this.value);
  };
}

// ── Type + Options panel (item only) ─────────────────────────────────────────
export function buildTypePanel(node, p) {
  const typeRow = document.createElement('div');
  typeRow.textContent = 'Type: ';
  const typeSelect = document.createElement('select');
  typeSelect.style.width = 'auto';
  for (const t of ['text', 'number', 'date', 'url', 'attachment', 'checkbox', 'select', 'open-choice', 'radio', 'display']) {
    const opt = document.createElement('option');
    opt.value = t; opt.textContent = t;
    if (node.itemType === t) opt.selected = true;
    typeSelect.appendChild(opt);
  }
  typeRow.appendChild(typeSelect);
  p.appendChild(typeRow);

  const optionsDiv = document.createElement('div');
  optionsDiv.style.marginTop = '4px';
  optionsDiv.style.display = (node.itemType === 'select' || node.itemType === 'open-choice') ? 'block' : 'none';
  optionsDiv.innerHTML = 'Options (comma-separated):<br>'
    + '<input type="text" value="' + escAttr(node.options) + '">';
  optionsDiv.querySelector('input').oninput = function () { node.options = this.value; };
  p.appendChild(optionsDiv);

  const successDiv = document.createElement('div');
  p.appendChild(successDiv);
  buildSuccessValueUI(node, successDiv);

  typeSelect.onchange = () => {
    node.itemType = typeSelect.value;
    optionsDiv.style.display = (node.itemType === 'select' || node.itemType === 'open-choice') ? 'block' : 'none';
    buildSuccessValueUI(node, successDiv);
  };
}

// ── Expression panel ──────────────────────────────────────────────────────────
export function buildExprPanel(node, p, exprLink, setActive) {
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
    triggerCalcRecalc();
  };
  p.appendChild(ta);

  const roRow = document.createElement('label');
  roRow.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:11px;margin-top:6px;cursor:pointer;';
  const roCb = document.createElement('input');
  roCb.type = 'checkbox';
  roCb.checked = !!node._readOnly;
  roCb.onchange = () => { node._readOnly = roCb.checked; triggerCalcRecalc(); };
  roRow.appendChild(roCb);
  roRow.appendChild(document.createTextNode('readOnly (computed by expression, not user-editable)'));
  p.appendChild(roRow);
}

// ── Style / Appearance panel ──────────────────────────────────────────────────
export function buildStylePanel(node, p, styleLink, setActive, ctx) {
  const styleRow = (label, fn) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:4px;font-size:12px;';
    const lbl = document.createElement('label');
    lbl.style.cssText = 'min-width:48px;color:#666;';
    lbl.textContent = label;
    row.appendChild(lbl);
    row.appendChild(fn());
    p.appendChild(row);
  };

  const parseStyle = () => {
    const s = node._renderStyle || '';
    return {
      bold:   /font-weight\s*:\s*bold/i.test(s),
      italic: /font-style\s*:\s*italic/i.test(s),
      color:  (s.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i) || [])[1]?.trim() || '',
    };
  };

  const buildStyle = (bold, italic, color) => [
    'font-weight: ' + (bold   ? 'bold'   : 'normal'),
    'font-style: '  + (italic ? 'italic' : 'normal'),
    ...(color ? ['color: ' + color] : []),
  ].join('; ');

  const cur = parseStyle();
  const boldCb   = Object.assign(document.createElement('input'), { type: 'checkbox', checked: cur.bold });
  const italicCb = Object.assign(document.createElement('input'), { type: 'checkbox', checked: cur.italic });
  const colorInp = Object.assign(document.createElement('input'), {
    type: 'color',
    value: cur.color?.startsWith('#') ? cur.color : '#000000',
    style: { cssText: 'width:36px;height:22px;padding:1px;border:1px solid #ccc;cursor:pointer;' },
  });
  const colorClear = Object.assign(document.createElement('button'), {
    type: 'button', textContent: '\u2715',
    style: { cssText: 'font-size:10px;padding:1px 5px;' },
    title: 'Remove color',
  });

  const rawInp = document.createElement('input');
  rawInp.type = 'text';
  rawInp.value = node._renderStyle || '';
  rawInp.placeholder = 'e.g. font-weight: bold; color: blue';
  rawInp.style.cssText = 'width:100%;margin-top:4px;font-size:11px;';

  const sync = () => {
    const color = colorClear._cleared ? '' : (cur.color || colorInp.value);
    const s = buildStyle(boldCb.checked, italicCb.checked, color);
    node._renderStyle = s;
    rawInp.value = s;
    ctx.formTick.value++;
  };
  const syncAndMark = () => { sync(); setActive(styleLink, !!node._renderStyle); };

  boldCb.onchange   = syncAndMark;
  italicCb.onchange = syncAndMark;
  colorInp.oninput  = () => { cur.color = colorInp.value; colorClear._cleared = false; syncAndMark(); };
  colorClear.onclick = () => { colorClear._cleared = true; cur.color = ''; colorInp.value = '#000000'; sync(); };
  rawInp.oninput = () => {
    node._renderStyle = rawInp.value;
    const p2 = parseStyle();
    boldCb.checked   = p2.bold;
    italicCb.checked = p2.italic;
    if (p2.color?.startsWith('#')) colorInp.value = p2.color;
    setActive(styleLink, !!rawInp.value);
    ctx.formTick.value++;
  };

  styleRow('Bold',   () => boldCb);
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
}
