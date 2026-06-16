// ── ChoiceNode / RadioNode / OpenChoiceNode ───────────────────────────────────
// Closed/open answer-list questions.
// Optional FHIR-imported: _optionOrdinals, _optionPrefixes, _optionExclusives,
//   _optionWeights, _answerMedias, _choiceOrientation,
//   _answerValueSet, _openLabel, _initialSelected, _choiceColumns
import { ItemNode } from './item-node.js';
import { NODE_REGISTRY } from './registry.js';
import { BaseNode, createWrap } from './base-node.js';
import { terminologyService } from '../fhir/terminology-service.js';
import {
  _nodeOpts, _evalAnswerOpts, _resolveColValue, _findRawOpt,
  _getColDisplayLabel, _buildColHeader, _buildColRow, _appendOptionExtras,
} from './choice-helpers.js';

export class ChoiceNode extends ItemNode {
  constructor(data = {}) {
    super(data);
    this.itemType = 'select';
  }

  buildControl(ctx) {
    const node = this;
    const { getValue, setValue, onChange, _reCalc } = ctx;
    const wrap = createWrap();

    const opts   = _evalAnswerOpts(node, ctx._fpCtx);
    let selected = getValue(node.id) || '';
    // display cache for codes selected via live lookup — stored on node to survive re-renders
    if (!node._lookupDisplayCache) node._lookupDisplayCache = {};

    const trigger = document.createElement('div');
    trigger.className = 'sc-trigger';
    trigger.tabIndex  = 0;

    const textSpan = document.createElement('span');
    textSpan.className = 'sc-trigger-text';
    trigger.appendChild(textSpan);

    const setLabel = () => {
      const found = opts.find(o => o.code === selected);
      if (found) {
        let label = _getColDisplayLabel(node, found.code, found.display || found.code);
        if (node._optionPrefixes && node._optionPrefixes[found.code] !== undefined)
          label = node._optionPrefixes[found.code] + '\u00A0' + label;
        if (node._optionOrdinals && node._optionOrdinals[found.code] !== undefined)
          label += '\u00A0(' + node._optionOrdinals[found.code] + ')';
        textSpan.textContent = label;
        trigger.classList.remove('sc-trigger--empty');
      } else if (selected && node._lookupDisplayCache[selected]) {
        textSpan.textContent = node._lookupDisplayCache[selected];
        trigger.classList.remove('sc-trigger--empty');
      } else {
        textSpan.textContent = '\u2014 select \u2014';
        trigger.classList.add('sc-trigger--empty');
      }
    };
    setLabel();

    let dropEl = null;
    let _open  = false;

    const close = () => {
      if (dropEl) { dropEl.remove(); dropEl = null; }
      _open = false;
      document.removeEventListener('mousedown', _onOutside, true);
    };

    const _onOutside = e => {
      if (!wrap.contains(e.target) && !dropEl?.contains(e.target)) close();
    };

    const _pick = code => {
      selected = code;
      setValue(node.id, code);
      setLabel();
      _reCalc(); onChange(); BaseNode.notifyChanged();
      close();
      trigger.focus();
    };

    const _buildOpts = (container, filter = '') => {
      const q   = filter.toLowerCase();
      const cols = node._choiceColumns;
      if (cols && cols.length) container.appendChild(_buildColHeader(cols));
      for (const { code, display } of opts) {
        const label = display || code;
        if (q && !label.toLowerCase().includes(q) && !code.toLowerCase().includes(q)) continue;
        if (cols && cols.length) {
          const rawOpt = _findRawOpt(node, code);
          const row = _buildColRow(cols, rawOpt, code, display);
          if (code === selected) row.classList.add('oc-opt--sel');
          row.addEventListener('mousedown', e => { e.preventDefault(); _pick(code); });
          container.appendChild(row);
        } else {
          const opt   = document.createElement('div');
          opt.className = 'oc-opt';
          if (node._optionPrefixes && node._optionPrefixes[code] !== undefined) {
            const pfx = document.createElement('span');
            pfx.className = 'option-prefix';
            pfx.textContent = node._optionPrefixes[code] + '\u00A0';
            opt.appendChild(pfx);
          }
          if (node._optionOrdinals && node._optionOrdinals[code] !== undefined) {
            opt.appendChild(document.createTextNode(label));
            const ord = document.createElement('span');
            ord.className = 'option-ordinal';
            ord.textContent = '\u00A0(' + node._optionOrdinals[code] + ')';
            opt.appendChild(ord);
          } else {
            opt.appendChild(document.createTextNode(label));
          }
          _appendOptionExtras(opt, node, code);
          if (code === selected) opt.classList.add('oc-opt--sel');
          opt.addEventListener('mousedown', e => { e.preventDefault(); _pick(code); });
          container.appendChild(opt);
        }
      }
    };

    const _fillDropDefault = () => {
      _buildOpts(dropEl);
    };

    const _fillDropAutocomplete = () => {
      const searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.className = 'oc-search';
      searchInput.placeholder = 'Search\u2026';
      searchInput.dataset.testid = 'autocomplete-search';
      const listBox = document.createElement('div');
      _buildOpts(listBox);
      searchInput.addEventListener('input', () => {
        listBox.innerHTML = '';
        _buildOpts(listBox, searchInput.value);
      });
      dropEl.appendChild(searchInput);
      dropEl.appendChild(listBox);
      requestAnimationFrame(() => searchInput.focus());
    };

    const _fillDropLookup = () => {
      const searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.className = 'oc-search';
      searchInput.placeholder = 'Search codes\u2026';
      searchInput.dataset.testid = 'lookup-search';
      const statusEl = document.createElement('div');
      statusEl.className = 'oc-lookup-status';
      statusEl.dataset.testid = 'lookup-status';
      statusEl.style.display = 'none';
      const listBox = document.createElement('div');
      let _lookupTimer = null;
      const _doLookup = filter => {
        clearTimeout(_lookupTimer);
        statusEl.textContent = 'Searching\u2026';
        statusEl.style.display = '';
        listBox.innerHTML = '';
        _lookupTimer = setTimeout(async () => {
          if (!node._answerValueSet) { statusEl.textContent = 'No ValueSet configured'; statusEl.style.display = ''; return; }
          try {
            const serverUrl = terminologyService.getServer(node, null);
            const results = await terminologyService.expandWithFilter(node._answerValueSet, serverUrl, filter);
            statusEl.textContent = results.length ? '' : 'No results';
            statusEl.style.display = results.length ? 'none' : '';
            listBox.innerHTML = '';
            for (const { code, display } of results) {
              const opt = document.createElement('div');
              opt.className = 'oc-opt';
              opt.textContent = display || code;
              if (code === selected) opt.classList.add('oc-opt--sel');
                opt.addEventListener('mousedown', e => {
                  e.preventDefault();
                  node._lookupDisplayCache[code] = display || code;
                  _pick(code);
                });
              listBox.appendChild(opt);
            }
            _reposition();
          } catch (err) {
            statusEl.textContent = '\u2717 ' + (err.message || 'Search failed');
            statusEl.style.display = '';
            listBox.innerHTML = '';
          }
        }, filter.trim() ? 300 : 0);
      };
      searchInput.addEventListener('input', () => _doLookup(searchInput.value));
      dropEl.appendChild(searchInput);
      dropEl.appendChild(statusEl);
      dropEl.appendChild(listBox);
      requestAnimationFrame(() => { searchInput.focus(); _doLookup(''); });
    };

    const _reposition = () => {
      if (!dropEl) return;
      const rect       = trigger.getBoundingClientRect();
      const vh         = window.innerHeight;
      const spaceBelow = vh - rect.bottom - 4;
      const spaceAbove = rect.top - 4;
      const maxAllowed = 200;

      dropEl.style.left = rect.left + 'px';
      if (node._choiceColumns && node._choiceColumns.length) {
        dropEl.style.minWidth = rect.width + 'px';
        dropEl.style.width = 'auto';
      } else {
        dropEl.style.width = rect.width + 'px';
      }

      if (spaceBelow >= Math.min(maxAllowed, spaceAbove)) {
        const cap = Math.min(maxAllowed, Math.max(spaceBelow, 60));
        dropEl.style.maxHeight = cap + 'px';
        dropEl.style.top = (rect.bottom + 2) + 'px';
      } else {
        const cap = Math.min(maxAllowed, Math.max(spaceAbove, 60));
        dropEl.style.maxHeight = cap + 'px';
        dropEl.style.top = (rect.top - Math.min(cap, dropEl.offsetHeight || cap) - 2) + 'px';
      }
    };

    const openDrop = () => {
      if (dropEl) { close(); return; }
      dropEl = document.createElement('div');
      dropEl.className = 'oc-drop';

      switch (node._itemControl) {
        case 'autocomplete': _fillDropAutocomplete(); break;
        case 'lookup':       _fillDropLookup();       break;
        default:             _fillDropDefault();      break;
      }

      document.body.appendChild(dropEl);
      _open = true;
      _reposition();
      document.addEventListener('mousedown', _onOutside, true);
    };

    trigger.addEventListener('click', openDrop);
    trigger.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDrop(); }
      if (e.key === 'Escape') close();
    });

    wrap.appendChild(trigger);
    return wrap;
  }
}

export class RadioNode extends ItemNode {
  constructor(data = {}) {
    super(data);
    this.itemType = 'radio';
  }

  buildControl(ctx) {
    const node = this;
    const { getValue, setValue, onChange, _reCalc } = ctx;
    const wrap = createWrap();

    const opts = _evalAnswerOpts(node, ctx._fpCtx);
    if (!opts.length) {
      const msg = document.createElement('span');
      msg.className = 'radio-no-opts';
      msg.textContent = '(no options)';
      wrap.appendChild(msg);
      return wrap;
    }

    if (node._choiceOrientation === 'vertical') wrap.classList.add('ctrl-wrap--vertical');
    else if (node._choiceOrientation === 'horizontal') wrap.classList.add('ctrl-wrap--horizontal');

    const rbName = 'radio_' + node.id;

    for (const { code, display } of opts) {
      const lbl = document.createElement('label');
      lbl.className = 'radio-label';
      const rb = document.createElement('input');
      rb.type = 'radio'; rb.name = rbName; rb.value = code;
      rb.checked = getValue(node.id) === code;
      rb.onchange = () => { if (rb.checked) { setValue(node.id, code); _reCalc(); onChange(); BaseNode.notifyChanged(); } };
      lbl.appendChild(rb);
      if (node._optionPrefixes && node._optionPrefixes[code] !== undefined) {
        const pfx = document.createElement('span');
        pfx.className = 'option-prefix';
        pfx.textContent = node._optionPrefixes[code] + '\u00A0';
        lbl.appendChild(pfx);
      }
      lbl.appendChild(document.createTextNode(display));
      if (node._optionOrdinals && node._optionOrdinals[code] !== undefined) {
        const ord = document.createElement('span');
        ord.className = 'option-ordinal';
        ord.textContent = '\u00A0(' + node._optionOrdinals[code] + ')';
        lbl.appendChild(ord);
      }
      _appendOptionExtras(lbl, node, code);
      wrap.appendChild(lbl);
    }
    return wrap;
  }
}

export class OpenChoiceNode extends ItemNode {
  constructor(data = {}) {
    super(data);
    this.itemType = 'open-choice';
  }

  buildControl(ctx) {
    const node = this;
    const { getValue, setValue, onChange, _reCalc } = ctx;
    const wrap = createWrap();

    const parsed = _evalAnswerOpts(node, ctx._fpCtx);

    const box = document.createElement('div');
    box.className = 'oc-wrap';

    const el = document.createElement('input');
    el.type        = 'text';
    el.className   = 'oc-input';
    el.placeholder = node._openLabel || 'Choose or type\u2026';
    el.value       = getValue(node.id) !== undefined ? getValue(node.id) : '';
    el.autocomplete = 'off';

    // optionsOnly: no free-text allowed — input is read-only, acts as display
    const optionsOnly = node._answerConstraint === 'optionsOnly';
    if (optionsOnly) {
      el.readOnly = true;
      el.placeholder = node._openLabel || 'Choose\u2026';
      el.classList.add('choice-open-readonly');
    }

    const btn = document.createElement('button');
    btn.type      = 'button';
    btn.className = 'oc-btn';
    btn.innerHTML = '&#x25BE;';
    btn.dataset.tipTitle = 'Show options';

    box.appendChild(el);
    box.appendChild(btn);

    let dropEl = null;
    let _open  = false;

    const close = () => {
      if (dropEl) { dropEl.remove(); dropEl = null; }
      _open = false;
      document.removeEventListener('mousedown', _onOutside, true);
    };

    const _onOutside = e => {
      if (!box.contains(e.target) && !dropEl?.contains(e.target)) close();
    };

    const _pick = display => {
      el.value = display;
      setValue(node.id, display);
      _reCalc(); onChange(); BaseNode.notifyChanged();
      close();
      el.focus();
    };

    const openDrop = (filter = '') => {
      if (dropEl) dropEl.remove();
      const q = filter.toLowerCase();
      const matches = q
        ? parsed.filter(({ display, code }) => (display || code).toLowerCase().includes(q))
        : parsed;
      if (!matches.length) { _open = false; return; }

      dropEl = document.createElement('div');
      dropEl.className = 'oc-drop';
      for (const { display, code } of matches) {
        const label = display || code;
        const opt = document.createElement('div');
        opt.className = 'oc-opt';
        opt.textContent = label;
        if (label === el.value) opt.classList.add('oc-opt--sel');
        opt.addEventListener('mousedown', e => { e.preventDefault(); _pick(label); });
        dropEl.appendChild(opt);
      }
      document.body.appendChild(dropEl);
      _open = true;
      const rect = el.getBoundingClientRect();
      dropEl.style.left     = rect.left + 'px';
      dropEl.style.minWidth = rect.width + 'px';
      const dropH = dropEl.offsetHeight;
      if (rect.bottom + dropH + 4 <= window.innerHeight) {
        dropEl.style.top = (rect.bottom + 2) + 'px';
      } else {
        dropEl.style.top = Math.max(4, rect.top - dropH - 2) + 'px';
      }
      document.addEventListener('mousedown', _onOutside, true);
    };

    el.addEventListener('input', () => { if (optionsOnly) return; setValue(node.id, el.value); _reCalc(); onChange(); openDrop(el.value); });
    el.addEventListener('change', () => { BaseNode.notifyChanged(); });
    el.addEventListener('focus', () => { if (parsed.length) openDrop(el.value); });
    el.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    btn.addEventListener('click', e => { e.stopPropagation(); if (_open) { close(); } else { el.focus(); openDrop(el.value); } });

    wrap.appendChild(box);
    return wrap;
  }
}

export class ChecklistNode extends ItemNode {
  constructor(data = {}) {
    super(data);
    this.itemType = 'checklist';
  }

  supportsRepeat() { return false; }

  buildControl(ctx) {
    const node = this;
    const { getValue, setValue, onChange, _reCalc } = ctx;
    const wrap = createWrap();

    const opts = _evalAnswerOpts(node, ctx._fpCtx);
    if (!opts.length) {
      const msg = document.createElement('span');
      msg.className = 'radio-no-opts';
      msg.textContent = '(no options)';
      wrap.appendChild(msg);
      return wrap;
    }

    if (node._choiceOrientation === 'horizontal') wrap.classList.add('ctrl-wrap--horizontal');
    else wrap.classList.add('ctrl-wrap--vertical');

    // Value is a comma-separated string of selected codes
    const parseSelected = () => {
      const raw = getValue(node.id);
      if (!raw || raw === '') return new Set();
      return new Set(String(raw).split(','));
    };
    const serializeSelected = set => [...set].join(',');

    const exclusives = node._optionExclusives || {};
    const allCheckboxes = [];

    for (const { code, display } of opts) {
      const lbl = document.createElement('label');
      lbl.className = 'radio-label';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = code;
      cb.checked = parseSelected().has(code);
      allCheckboxes.push(cb);
      cb.onchange = () => {
        const sel = parseSelected();
        if (cb.checked) {
          if (exclusives[code]) {
            // exclusive option: deselect everything else
            sel.clear();
            sel.add(code);
            for (const other of allCheckboxes) {
              other.checked = other.value === code;
            }
          } else {
            // non-exclusive: deselect all exclusives
            sel.add(code);
            for (const exCode of Object.keys(exclusives)) {
              sel.delete(exCode);
            }
            for (const other of allCheckboxes) {
              if (exclusives[other.value]) other.checked = false;
            }
          }
        } else {
          sel.delete(code);
        }
        const v = serializeSelected(sel);
        setValue(node.id, v || undefined);
        _reCalc(); onChange(); BaseNode.notifyChanged();
      };
      lbl.appendChild(cb);
      if (node._optionPrefixes && node._optionPrefixes[code] !== undefined) {
        const pfx = document.createElement('span');
        pfx.className = 'option-prefix';
        pfx.textContent = node._optionPrefixes[code] + '\u00A0';
        lbl.appendChild(pfx);
      }
      lbl.appendChild(document.createTextNode(display));
      if (node._optionOrdinals && node._optionOrdinals[code] !== undefined) {
        const ord = document.createElement('span');
        ord.className = 'option-ordinal';
        ord.textContent = '\u00A0(' + node._optionOrdinals[code] + ')';
        lbl.appendChild(ord);
      }
      _appendOptionExtras(lbl, node, code);
      wrap.appendChild(lbl);
    }
    return wrap;
  }
}

NODE_REGISTRY.set('select',      ChoiceNode);
NODE_REGISTRY.set('radio',       RadioNode);
NODE_REGISTRY.set('checklist',   ChecklistNode);
NODE_REGISTRY.set('open-choice', OpenChoiceNode);
