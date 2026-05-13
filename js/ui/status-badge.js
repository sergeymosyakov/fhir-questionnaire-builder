// ── Status badge: live PASS / FAIL indicator with issue dropdown ──────────────
// API:
//   init(elements, navigateFn)  — wire up { btn, dropdown, wrap }; navigateFn(id)
//   update(state)               — state: { anyVisible, hasCriteria, finalOk, failingItems }
//                                 failingItems: [{ title, id }]

let _btn        = null;
let _dropdown   = null;
let _wrap       = null;
let _open       = false;
let _navigateFn = null;

export function init(elements, navigateFn) {
  _btn        = elements.btn;
  _dropdown   = elements.dropdown;
  _wrap       = elements.wrap;
  _navigateFn = navigateFn || null;

  _btn.addEventListener('click', e => {
    e.stopPropagation();
    _open = !_open;
    _dropdown.style.display = _open ? 'block' : 'none';
  });

  document.addEventListener('click', () => {
    if (_open) _close();
  });
}

export function update({ anyVisible, hasCriteria, finalOk, failingItems }) {
  if (!_btn) return;

  if (!anyVisible || !hasCriteria) {
    _wrap.style.display = 'none';
    _close();
    return;
  }

  _wrap.style.display = 'inline-flex';

  if (finalOk) {
    _btn.className   = 'status-badge status-badge--pass';
    _btn.textContent = '\u2713 PASS';
  } else {
    const n = failingItems.length;
    _btn.className   = 'status-badge status-badge--fail';
    _btn.textContent = '\u2717 FAIL \u00b7 ' + n + ' issue' + (n !== 1 ? 's' : '');
  }

  _renderList(failingItems);
}

function _close() {
  _open = false;
  if (_dropdown) _dropdown.style.display = 'none';
}

function _renderList(items) {
  if (!_dropdown) return;
  _dropdown.innerHTML = '';

  if (items.length === 0) {
    const msg = document.createElement('div');
    msg.className   = 'status-dropdown-msg';
    msg.textContent = 'All criteria met';
    _dropdown.appendChild(msg);
    return;
  }

  const hdr = document.createElement('div');
  hdr.className   = 'status-dropdown-header';
  hdr.textContent = items.length + ' issue' + (items.length !== 1 ? 's' : '') + ' to resolve';
  _dropdown.appendChild(hdr);

  items.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'status-dropdown-row';
    row.title = 'Click to navigate';
    row.addEventListener('click', e => {
      e.stopPropagation();
      _close();
      if (_navigateFn) _navigateFn(item.id);
    });

    const num = document.createElement('span');
    num.className   = 'status-dropdown-num';
    num.textContent = (i + 1) + '.';
    row.appendChild(num);

    const label = document.createElement('span');
    label.className = 'status-dropdown-label';
    label.textContent = item.title;
    row.appendChild(label);

    const arrow = document.createElement('span');
    arrow.className = 'status-dropdown-arrow';
    arrow.textContent = '\u2197';
    row.appendChild(arrow);

    _dropdown.appendChild(row);
  });
}
