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

export function createCustomSelect({ items = [], value = '', onChange, className = '', testid, searchable } = {}) {
  let _items    = items.slice();
  let _value    = value;
  let _handler  = onChange || null;

  // ── Trigger ───────────────────────────────────────────────────────────────
  const trigger = document.createElement('div');
  trigger.className = 'sc-trigger' + (className ? ' ' + className : '');
  trigger.tabIndex  = 0;
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
    document.removeEventListener('mousedown', _onOutside, true);
    document.removeEventListener('keydown',   _onKey,     true);
  };

  const _onOutside = e => {
    if (!trigger.contains(e.target) && !dropEl?.contains(e.target)) _close();
  };

  const _onKey = e => {
    if (e.key === 'Escape') { _close(); trigger.focus(); }
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
      });

      document.body.appendChild(dropEl);
      _position();
      document.addEventListener('mousedown', _onOutside, true);
      document.addEventListener('keydown',   _onKey,     true);
      setTimeout(() => searchInp.focus(), 0);
    } else {
      _renderOpts(dropEl);
      document.body.appendChild(dropEl);
      _position();
      document.addEventListener('mousedown', _onOutside, true);
      document.addEventListener('keydown',   _onKey,     true);
    }
  };

  const _renderOpts = (container) => {
    const created = [];
    for (const item of _items) {
      const opt = document.createElement('div');
      opt.className = 'oc-opt' + (item.value === _value ? ' oc-opt--sel' : '');
      opt.textContent = item.label;
      opt.dataset.val = item.value;
      if (item.title) opt.title = item.title;
      opt.addEventListener('mousedown', e => { e.preventDefault(); _pick(item); });
      container.appendChild(opt);
      created.push(opt);
    }
    return created;
  };

  const _position = () => {
    const rect = trigger.getBoundingClientRect();
    dropEl.style.left     = rect.left + 'px';
    dropEl.style.minWidth = rect.width + 'px';
    // Flip upward if needed
    const dropH = dropEl.offsetHeight;
    if (rect.bottom + dropH + 4 <= window.innerHeight) {
      dropEl.style.top = (rect.bottom + 2) + 'px';
    } else {
      dropEl.style.top = Math.max(4, rect.top - dropH - 2) + 'px';
    }
  };

  trigger.addEventListener('click', _open);
  trigger.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _open(); }
    if (e.key === 'Escape') _close();
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
          opt.classList.toggle('oc-opt--sel', opt.dataset.val === _value);
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
