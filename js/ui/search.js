// ── Preview search ────────────────────────────────────────────────────────────
// Searches visible preview rows by title text and linkId.
// init(elements) — wire DOM nodes once at startup (no getElementById inside)
//   elements: { input, prevBtn, nextBtn, counter, lform }
//
// Usage:
//   input → oninput: collect matches, jump to first, show counter
//   prevBtn / nextBtn (or ↑/↓ on input) → navigate
//   Empty query → clear all highlights

let _el      = null;
let _matches = [];   // NodeList of matched .lform-item elements
let _idx     = -1;   // current match index

// ── Init ──────────────────────────────────────────────────────────────────────
export function init(elements) {
  _el = elements;

  _el.input.addEventListener('input', _onInput);
  _el.input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); _navigate(+1); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); _navigate(-1); }
    if (e.key === 'Escape')    { _el.input.value = ''; _clear(); }
  });
  _el.nextBtn.addEventListener('click', () => _navigate(+1));
  _el.prevBtn.addEventListener('click', () => _navigate(-1));
}

// Called by render-preview.js after every effect() re-render
// so stale DOM references are replaced with fresh ones.
export function refresh() {
  if (_el && _el.input.value.trim()) _onInput();
}

// ── Core ──────────────────────────────────────────────────────────────────────
function _onInput() {
  const q = _el.input.value.trim().toLowerCase();
  _clearHighlights();

  if (!q) { _clear(); return; }

  // Collect all rendered preview rows (only truly rendered, not dimmed/disabled)
  const rows = [..._el.lform.querySelectorAll('[data-preview-id]')];
  _matches = rows.filter(row => {
    const text = row.textContent.toLowerCase();
    return text.includes(q);
  });

  if (_matches.length === 0) {
    _idx = -1;
    _el.counter.textContent = 'No results';
    _el.counter.classList.add('search-counter--empty');
    _el.input.classList.add('search-input--empty');
    return;
  }

  _el.input.classList.remove('search-input--empty');
  _el.counter.classList.remove('search-counter--empty');
  _matches.forEach(m => m.classList.add('search-match'));
  _idx = 0;
  _activate();
}

function _navigate(dir) {
  if (_matches.length === 0) return;
  // Remove active from current
  if (_idx >= 0 && _idx < _matches.length) {
    _matches[_idx].classList.remove('search-match--active');
  }
  _idx = (_idx + dir + _matches.length) % _matches.length;
  _activate();
}

function _activate() {
  const el = _matches[_idx];
  el.classList.add('search-match--active');
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  _el.counter.textContent = (_idx + 1) + ' / ' + _matches.length;
  _el.counter.classList.remove('search-counter--empty');
}

function _clearHighlights() {
  _matches.forEach(m => {
    m.classList.remove('search-match');
    m.classList.remove('search-match--active');
  });
  _matches = [];
  _idx = -1;
}

function _clear() {
  _clearHighlights();
  _el.counter.textContent = '';
  _el.counter.classList.remove('search-counter--empty');
  _el.input.classList.remove('search-input--empty');
}
