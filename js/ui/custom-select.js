// ── Custom select widget ──────────────────────────────────────────────────────
// Consistent custom dropdown used system-wide. Matches the preview select style
// (sc-trigger / oc-drop / oc-opt CSS classes from controls.css).
//
// createCustomSelect({ items, value, onChange, className, testid, searchable })
//   items:      Array<{value: string, label: string, title?: string}>
//   value:      string  — initially selected value
//   onChange:   (value, item) => void
//   className:  string  — extra classes added to the trigger element
//   testid:     string  — data-testid on the trigger
//   searchable: boolean — force search input (auto when items.length > 8)
//
// Returns { el, getValue(), setValue(v), setOptions(items), setOnChange(fn) }
//   el is the trigger <div> — insert it wherever the native <select> was.

import { nextUid } from '../id.js';

export function createCustomSelect({ items = [], value = '', onChange, className = '', testid, searchable, ariaLabel } = {}) {
  let _items    = items.slice();
  let _value    = value;
  let _handler  = onChange || null;
  let _activeIdx = -1;
  const _uid = nextUid('csel');

  // ── Trigger ───────────────────────────────────────────────────
  const trigger = document.createElement('div');
  trigger.className = 'sc-trigger' + (className ? ' ' + className : '');
  trigger.tabIndex  = 0;
  // ARIA combobox semantics (a11y).
  trigger.setAttribute('role', 'combobox');
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  if (ariaLabel) trigger.setAttribute('aria-label', ariaLabel);
  if (testid) trigger.dataset.testid = testid;

  const textSpan = document.createElement('span');
  textSpan.className = 'sc-trigger-text';
  trigger.appendChild(textSpan);

  const _updateLabel = () => {
    const found = _items.find(it => it.value === _value);
    textSpan.textContent = found ? found.label : ('\u2014 ' + (_value || 'select') + ' \u2014');
    trigger.classList.toggle('sc-trigger--empty', !found);
    trigger.dataset.value = _value;
  };
  _updateLabel();

  // ── Portal dropdown ───────────────────────────────────────────────────────
  let dropEl = null;

  const _close = () => {
    if (dropEl) { dropEl.remove(); dropEl = null; }
    _activeIdx = -1;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.removeAttribute('aria-activedescendant');
    document.removeEventListener('mousedown', _onOutside, true);
    document.removeEventListener('keydown',   _onKey,     true);
  };

  const _onOutside = e => {
    if (!trigger.contains(e.target) && !dropEl?.contains(e.target)) _close();
  };

  // Visible option elements in the open dropdown (respects search filtering).
  const _visibleOpts = () => dropEl
    ? [...dropEl.querySelectorAll('.oc-opt')].filter(o => o.style.display !== 'none')
    : [];

  const _setActive = (idx) => {
    const opts = _visibleOpts();
    if (!opts.length) return;
    _activeIdx = Math.max(0, Math.min(idx, opts.length - 1));
    opts.forEach((o, i) => o.classList.toggle('oc-opt--active', i === _activeIdx));
    const el = opts[_activeIdx];
    trigger.setAttribute('aria-activedescendant', el.id);
    el.scrollIntoView({ block: 'nearest' });
  };

  const _onKey = e => {
    if (e.key === 'Escape') { _close(); trigger.focus(); return; }
    const opts = _visibleOpts();
    if (!opts.length) return;
    if (e.key === 'ArrowDown')      { e.preventDefault(); _setActive(_activeIdx + 1); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); _setActive(_activeIdx - 1); }
    else if (e.key === 'Home')      { e.preventDefault(); _setActive(0); }
    else if (e.key === 'End')       { e.preventDefault(); _setActive(opts.length - 1); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const el = opts[_activeIdx] || opts[0];
      const item = _items.find(it => it.value === el.dataset.val);
      if (item) _pick(item);
    }
  };

  const _pick = (item) => {
    _value = item.value;
    _updateLabel();
    if (_handler) _handler(item.value, item);
    _close();
    trigger.focus();
  };

  const _open = () => {
    if (dropEl) { _close(); return; }

    const useSearch = searchable !== undefined ? searchable : _items.length > 8;

    dropEl = document.createElement('div');
    dropEl.className = 'oc-drop csel-drop';
    dropEl.dataset.testid = 'csel-drop';
    dropEl.id = _uid + '-list';
    dropEl.setAttribute('role', 'listbox');
    trigger.setAttribute('aria-controls', dropEl.id);
    trigger.setAttribute('aria-expanded', 'true');

    // Highlight the currently-selected (or first) option once rendered.
    const _initActive = () => {
      const opts = _visibleOpts();
      const sel = opts.findIndex(o => o.dataset.val === _value);
      _setActive(sel >= 0 ? sel : 0);
    };

    if (useSearch) {
      const searchInp = document.createElement('input');
      searchInp.type        = 'text';
      searchInp.className   = 'vis-q-sel-search';
      searchInp.placeholder = 'Search\u2026';
      searchInp.addEventListener('mousedown', ev => ev.stopPropagation());
      dropEl.appendChild(searchInp);

      const opts = _renderOpts(dropEl);

      searchInp.addEventListener('input', () => {
        const q = searchInp.value.toLowerCase();
        for (const opt of opts) {
          const match = !q
            || opt.dataset.val.toLowerCase().includes(q)
            || opt.textContent.toLowerCase().includes(q);
          opt.style.display = match ? '' : 'none';
        }
        _setActive(0);
      });

      document.body.appendChild(dropEl);
      _position();
      _initActive();
      document.addEventListener('mousedown', _onOutside, true);
      document.addEventListener('keydown',   _onKey,     true);
      setTimeout(() => searchInp.focus(), 0);
    } else {
      _renderOpts(dropEl);
      document.body.appendChild(dropEl);
      _position();
      _initActive();
      document.addEventListener('mousedown', _onOutside, true);
      document.addEventListener('keydown',   _onKey,     true);
    }
  };

  const _renderOpts = (container) => {
    const created = [];
    _items.forEach((item, i) => {
      const opt = document.createElement('div');
      opt.className = 'oc-opt' + (item.value === _value ? ' oc-opt--sel' : '');
      opt.id = _uid + '-opt-' + i;
      opt.setAttribute('role', 'option');
      opt.setAttribute('aria-selected', String(item.value === _value));
      opt.textContent = item.label;
      opt.dataset.val = item.value;
      if (item.title) opt.dataset.tipTitle = item.title;
      opt.addEventListener('mousedown', e => { e.preventDefault(); _pick(item); });
      container.appendChild(opt);
      created.push(opt);
    });
    return created;
  };

  const _position = () => {
    const rect       = trigger.getBoundingClientRect();
    const vh         = window.innerHeight;
    const spaceBelow = vh - rect.bottom - 4;
    const spaceAbove = rect.top - 4;
    const maxAllowed = 200; // matches CSS max-height

    dropEl.style.left     = rect.left + 'px';
    dropEl.style.minWidth = rect.width + 'px';

    if (spaceBelow >= Math.min(maxAllowed, spaceAbove)) {
      // Open downward — cap height to available space
      const cap = Math.min(maxAllowed, Math.max(spaceBelow, 60));
      dropEl.style.maxHeight = cap + 'px';
      dropEl.style.top       = (rect.bottom + 2) + 'px';
    } else {
      // Open upward — cap height to available space above
      const cap = Math.min(maxAllowed, Math.max(spaceAbove, 60));
      dropEl.style.maxHeight = cap + 'px';
      dropEl.style.top       = (rect.top - Math.min(cap, dropEl.offsetHeight || cap) - 2) + 'px';
    }
  };

  trigger.addEventListener('click', _open);
  trigger.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!dropEl) _open();
    } else if (e.key === 'Escape') {
      _close();
    }
  });

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    el: trigger,

    getValue() { return _value; },

    setValue(v) {
      _value = v;
      _updateLabel();
      // Refresh open dropdown if visible
      if (dropEl) {
        for (const opt of dropEl.querySelectorAll('.oc-opt')) {
          const sel = opt.dataset.val === _value;
          opt.classList.toggle('oc-opt--sel', sel);
          opt.setAttribute('aria-selected', String(sel));
        }
      }
    },

    setOptions(newItems) {
      _items = newItems.slice();
      const prev = _value;
      // Keep value if it still exists in new items
      if (!_items.find(it => it.value === prev)) _value = _items[0]?.value ?? '';
      _updateLabel();
      if (dropEl) { _close(); }
    },

    setOnChange(fn) { _handler = fn; },
  };
}
