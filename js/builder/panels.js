// ── Action panel builders ─────────────────────────────────────────────────────
import { parseOptions } from '../utils.js';
import { getAllItems, triggerCalcRecalc } from './_shared.js';
import { refreshExprIcons } from '../render-preview.js';
import { createCustomSelect } from '../ui/custom-select.js';
import { createDatePicker } from '../ui/date-picker.js';
import { tree } from '../state.js';

// ── Panel factory helper ──────────────────────────────────────────────────────
export function addPanel(key, buildFn, div, panels) {
  const p = document.createElement('div');
  p.className = 'hidden-panel';
  p.style.display = 'none';
  buildFn(p);
  panels[key] = p;
  div.appendChild(p);
}

// ── Custom question picker (styled dropdown, handles long titles) ────────────
function buildQuestionSelect(allItems, selectedId, onSelect) {
  const wrap = document.createElement('div');
  wrap.className = 'vis-q-sel';

  const trigger = document.createElement('div');
  trigger.className = 'vis-q-sel-trigger';
  const found = allItems.find(it => it.id === selectedId);
  trigger.textContent = found ? found.label : '\u2014 question \u2014';
  trigger.dataset.tipTitle = found ? found.id : '';

  let dropEl = null;

  const close = () => {
    if (dropEl) { dropEl.remove(); dropEl = null; }
    document.removeEventListener('mousedown', onOutside, true);
  };

  const onOutside = e => {
    if (!wrap.contains(e.target) && !dropEl?.contains(e.target)) close();
  };

  trigger.addEventListener('click', e => {
    e.stopPropagation();
    if (dropEl) { close(); return; }

    dropEl = document.createElement('div');
    dropEl.className = 'vis-q-sel-drop';

    // ── Search input ─────────────────────────────────────────────────────
    const searchInp = document.createElement('input');
    searchInp.type = 'text';
    searchInp.className = 'vis-q-sel-search';
    searchInp.placeholder = 'Search id or title\u2026';
    searchInp.addEventListener('mousedown', ev => ev.stopPropagation());
    dropEl.appendChild(searchInp);

    const blank = document.createElement('div');
    blank.className = 'vis-q-sel-opt' + (!selectedId ? ' vis-q-sel-opt--sel' : '');
    blank.textContent = '\u2014 question \u2014';
    blank.addEventListener('mousedown', () => {
      trigger.textContent = '\u2014 question \u2014';
      delete trigger.dataset.tipTitle;
      onSelect('', null);
      close();
    });
    dropEl.appendChild(blank);

    const optDivs = [];
    for (const it of allItems) {
      const opt = document.createElement('div');
      opt.className = 'vis-q-sel-opt' + (it.id === selectedId ? ' vis-q-sel-opt--sel' : '');
      opt.textContent = it.label;
      opt.dataset.tipTitle = it.id;
      opt.dataset.id = it.id;
      opt.addEventListener('mousedown', () => {
        trigger.textContent = it.label;
        trigger.dataset.tipTitle = it.id;
        onSelect(it.id, it);
        close();
      });
      dropEl.appendChild(opt);
      optDivs.push(opt);
    }

    searchInp.addEventListener('input', () => {
      const q = searchInp.value.toLowerCase();
      for (const opt of optDivs) {
        const match = !q
          || opt.dataset.id.toLowerCase().includes(q)
          || opt.textContent.toLowerCase().includes(q);
        opt.style.display = match ? '' : 'none';
      }
    });

    // Render as portal so it escapes any overflow:hidden/auto ancestor
    const rect = trigger.getBoundingClientRect();
    dropEl.style.top      = (rect.bottom + 2) + 'px';
    dropEl.style.left     = rect.left + 'px';
    dropEl.style.minWidth = rect.width + 'px';
    document.body.appendChild(dropEl);

    setTimeout(() => {
      // Flip upward if dropdown would extend below the viewport
      const dRect = dropEl.getBoundingClientRect();
      if (dRect.bottom > window.innerHeight - 8) {
        dropEl.style.top = Math.max(4, rect.top - dRect.height - 2) + 'px';
      }
      document.addEventListener('mousedown', onOutside, true);
      searchInp.focus();
    }, 0);
  });

  wrap.appendChild(trigger);
  return wrap;
}

// ── Visibility panel (FHIR enableWhen) ───────────────────────────────────────
export function buildVisPanel(node, p, visLink, setActive) {
  if (!Array.isArray(node.enableWhen)) node.enableWhen = [];
  if (!node.enableBehavior) node.enableBehavior = 'all';
  if (node.enableWhenExpression === undefined) node.enableWhenExpression = '';

  const allItems = getAllItems(tree).filter(it => it.id !== node.id);

  const syncActive = () => {
    setActive(visLink, node.enableWhen.length > 0 || !!node.enableWhenExpression);
  };

  // ── AND / ANY behavior selector ──────────────────────────────────────────
  const behaviorRow = document.createElement('div');
  behaviorRow.className = 'vis-behavior-row';
  behaviorRow.appendChild(Object.assign(document.createElement('span'), { textContent: 'Show when ' }));
  const behaviorSel = createCustomSelect({
    items:    [{ value: 'all', label: 'ALL (AND)' }, { value: 'any', label: 'ANY (OR)' }],
    value:    node.enableBehavior || 'all',
    className: 'vis-behavior-sel sc-trigger--sm',
    onChange: v => { node.enableBehavior = v; },
  });
  behaviorRow.appendChild(behaviorSel.el);
  behaviorRow.appendChild(Object.assign(document.createElement('span'), { textContent: ' conditions are met:' }));
  p.appendChild(behaviorRow);

  // ── Condition list ────────────────────────────────────────────────────────
  const condList = document.createElement('div');
  condList.className = 'vis-cond-list';
  p.appendChild(condList);

  const renderCondRow = (ew, idx) => {
    const row = document.createElement('div');
    row.className = 'vis-cond-row';

    const qWidget = buildQuestionSelect(allItems, ew.question || '', (id, it) => {
      ew.question = id;
      delete ew.answerBoolean; delete ew.answerString; delete ew.answerCoding;
      delete ew.answerDecimal; delete ew.answerInteger; delete ew.answerDate;
      ew.operator = '=';
      if (it) buildOpVal(it.itemType || '', it.options || '');
      else opSel.setOptions([{ value: '', label: '\u2014' }]);
      syncActive();
    });

    const opSel = createCustomSelect({ items: [], value: '', className: 'sc-trigger--sm vis-cond-op-wrap' });

    const valWrap = document.createElement('span');
    valWrap.className = 'vis-cond-val';

    const rmBtn = document.createElement('button');
    rmBtn.type = 'button';
    rmBtn.className = 'vis-cond-rm';
    rmBtn.textContent = '\u2715';
    rmBtn.onclick = () => {
      node.enableWhen.splice(idx, 1);
      condList.innerHTML = '';
      node.enableWhen.forEach((e, i) => condList.appendChild(renderCondRow(e, i)));
      syncActive();
    };

    const buildOpVal = (itype, opts) => {
      valWrap.innerHTML = '';

      // Adds "has answer" / "has no answer" to any operator items array
      const _addExistsOpts = (items) => {
        items.push({ value: 'exists|true', label: 'has answer' });
        items.push({ value: 'exists|false', label: 'has no answer' });
      };

      // Wraps opSel handler: re-invokes buildOpVal when switching away from exists
      const _wrapChange = () => {
        opSel.setOnChange(v => {
          if (v.startsWith('exists|')) {
            ew.operator = 'exists';
            ew.answerBoolean = v.endsWith('|true');
            delete ew.answerString; delete ew.answerCoding;
            delete ew.answerDecimal; delete ew.answerInteger; delete ew.answerDate;
            valWrap.innerHTML = '';
          } else {
            const sel = v;
            ew.operator = sel;
            delete ew.answerBoolean;
            buildOpVal(itype, opts);
            opSel.setValue(sel);
          }
        });
      };

      if (itype === 'checkbox') {
        const items = [
          { value: '=|true',     label: 'is Yes (checked)' },
          { value: '=|false',    label: 'is No (unchecked)' },
          { value: 'exists|true',  label: 'has answer' },
          { value: 'exists|false', label: 'has no answer' },
        ];
        opSel.setOptions(items);
        opSel.setValue(ew.operator + '|' + (ew.answerBoolean === false ? 'false' : 'true'));
        opSel.setOnChange(v => {
          const [op, boolStr] = v.split('|');
          ew.operator = op;
          ew.answerBoolean = boolStr === 'true';
          delete ew.answerString; delete ew.answerCoding; delete ew.answerDecimal; delete ew.answerInteger; delete ew.answerDate;
        });
      } else if (itype === 'select' || itype === 'radio' || itype === 'open-choice') {
        const items = [{ value: '=', label: '=' }, { value: '!=', label: '\u2260' }];
        _addExistsOpts(items);
        opSel.setOptions(items);
        if (ew.operator === 'exists') {
          opSel.setValue('exists|' + (ew.answerBoolean === false ? 'false' : 'true'));
        } else {
          opSel.setValue(ew.operator || '=');
          if (opts) {
            const valCsel = createCustomSelect({
              items:    parseOptions(opts).map(({ code, display }) => ({ value: code, label: display || code })),
              value:    ew.answerCoding?.code || '',
              className: 'sc-trigger--sm vis-cond-val-inp',
              onChange: (v, item) => { ew.answerCoding = { code: v, display: item.label }; },
            });
            valWrap.appendChild(valCsel.el);
          } else {
            const inp = document.createElement('input');
            inp.type = 'text'; inp.className = 'vis-cond-val-inp';
            inp.value = ew.answerCoding?.code || ew.answerString || '';
            inp.oninput = () => { ew.answerCoding = { code: inp.value }; delete ew.answerString; };
            valWrap.appendChild(inp);
          }
        }
        _wrapChange();
      } else if (itype === 'number' || itype === 'integer' || itype === 'decimal' || itype === 'quantity') {
        const items = [
          { value: '=', label: '=' }, { value: '!=', label: '\u2260' },
          { value: '>', label: '>' }, { value: '<', label: '<' },
          { value: '>=', label: '\u2265' }, { value: '<=', label: '\u2264' },
        ];
        _addExistsOpts(items);
        opSel.setOptions(items);
        if (ew.operator === 'exists') {
          opSel.setValue('exists|' + (ew.answerBoolean === false ? 'false' : 'true'));
        } else {
          opSel.setValue(ew.operator || '=');
          const inp = document.createElement('input');
          inp.type = 'number'; inp.className = 'vis-cond-val-inp';
          inp.value = ew.answerDecimal !== undefined ? ew.answerDecimal
            : ew.answerInteger !== undefined ? ew.answerInteger : '';
          inp.oninput = () => {
            const n = parseFloat(inp.value);
            if (!isNaN(n)) {
              if (Number.isInteger(n)) { ew.answerInteger = n; delete ew.answerDecimal; }
              else { ew.answerDecimal = n; delete ew.answerInteger; }
            }
          };
          valWrap.appendChild(inp);
        }
        _wrapChange();
      } else if (itype === 'date' || itype === 'dateTime' || itype === 'time') {
        const isTimeOnly = itype === 'time';
        const items = [
          { value: '=', label: '=' }, { value: '!=', label: '\u2260' },
          { value: '>', label: '>' }, { value: '<', label: '<' },
          { value: '>=', label: '\u2265' }, { value: '<=', label: '\u2264' },
        ];
        _addExistsOpts(items);
        opSel.setOptions(items);
        if (ew.operator === 'exists') {
          opSel.setValue('exists|' + (ew.answerBoolean === false ? 'false' : 'true'));
        } else {
          opSel.setValue(ew.operator || '=');
          if (isTimeOnly) {
            const tinp = document.createElement('input');
            tinp.type = 'time'; tinp.className = 'vis-cond-val-inp ctrl-input--time';
            // FHIR time: HH:MM:SS — slice to HH:MM for native input
            tinp.value = (ew.answerTime || '').slice(0, 5);
            tinp.addEventListener('change', () => {
              ew.answerTime = tinp.value ? tinp.value + ':00' : undefined;
              delete ew.answerString;
            });
            valWrap.appendChild(tinp);
          } else {
            const dp = createDatePicker({
              value:    ew.answerDate || ew.answerDateTime || '',
              onChange: v => {
                if (itype === 'dateTime') { ew.answerDateTime = v || undefined; delete ew.answerDate; }
                else { ew.answerDate = v || undefined; delete ew.answerDateTime; }
              },
              withTime:  itype === 'dateTime',
              className: 'sc-trigger--sm vis-cond-val-inp',
            });
            valWrap.appendChild(dp.el);
          }
        }
        _wrapChange();
      } else {
        const items = [{ value: '=', label: '=' }, { value: '!=', label: '\u2260' }];
        _addExistsOpts(items);
        opSel.setOptions(items);
        if (ew.operator === 'exists') {
          opSel.setValue('exists|' + (ew.answerBoolean === false ? 'false' : 'true'));
        } else {
          opSel.setValue(ew.operator || '=');
          const inp = document.createElement('input');
          inp.type = 'text'; inp.className = 'vis-cond-val-inp';
          inp.value = ew.answerString || '';
          inp.oninput = () => { ew.answerString = inp.value; delete ew.answerCoding; delete ew.answerDecimal; };
          valWrap.appendChild(inp);
        }
        _wrapChange();
      }
    };

    const selItem = allItems.find(it => it.id === ew.question);
    if (selItem) buildOpVal(selItem.itemType || '', selItem.options || '');
    else opSel.setOptions([{ value: '', label: '\u2014' }]);

    row.appendChild(qWidget);
    row.appendChild(opSel.el);
    row.appendChild(valWrap);
    row.appendChild(rmBtn);
    return row;
  };

  node.enableWhen.forEach((ew, i) => condList.appendChild(renderCondRow(ew, i)));

  // ── Add condition ─────────────────────────────────────────────────────────
  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'vis-add-btn';
  addBtn.textContent = '+ Add condition';
  addBtn.onclick = () => {
    const newEw = { question: '', operator: '=', answerBoolean: true };
    node.enableWhen.push(newEw);
    condList.appendChild(renderCondRow(newEw, node.enableWhen.length - 1));
    syncActive();
  };
  p.appendChild(addBtn);

  // ── FHIRPath expression (advanced) ────────────────────────────────────────
  const exprSep = document.createElement('div');
  exprSep.className = 'vis-expr-sep';
  exprSep.textContent = '\u2014 or FHIRPath expression (advanced) \u2014';
  p.appendChild(exprSep);

  const exprLbl = document.createElement('div');
  exprLbl.className = 'panel-raw-lbl panel-raw-lbl--sm panel-lbl-row';
  const exprLblTxt = document.createElement('span');
  exprLblTxt.textContent = 'enableWhenExpression (SDC):';
  const exprIcon = document.createElement('span');
  exprIcon.className = 'expr-live-icon';
  exprIcon.dataset.exprIcon = node.enableWhenExpression || '';
  exprLbl.appendChild(exprLblTxt);
  exprLbl.appendChild(exprIcon);
  p.appendChild(exprLbl);

  const exprInp = document.createElement('textarea');
  exprInp.rows = 3;
  exprInp.className = 'expr-textarea';
  exprInp.value = node.enableWhenExpression || '';
  exprInp.placeholder = "e.g. %age > 18 and %gender = 'male'";
  const _resizeExpr = () => { exprInp.style.height = 'auto'; exprInp.style.height = exprInp.scrollHeight + 'px'; };
  exprInp.addEventListener('input', _resizeExpr);
  setTimeout(_resizeExpr, 0);
  exprInp.oninput = () => {
    node.enableWhenExpression = exprInp.value;
    exprIcon.dataset.exprIcon = exprInp.value.trim();
    syncActive();
    clearTimeout(exprInp._d);
    exprInp._d = setTimeout(refreshExprIcons, 400);
  };
  exprInp.onblur = () => { triggerCalcRecalc(); };
  p.appendChild(exprInp);

  syncActive();
}

// ── Expression panel ──────────────────────────────────────────────────────────
// ── Style / Appearance panel ──────────────────────────────────────────────────

