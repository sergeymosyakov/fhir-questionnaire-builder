// ── Preview search ────────────────────────────────────────────────────────────
// Searches visible preview rows (modes 'preview' / 'patient') by text content,
// or the FHIR JSON <pre> (mode 'json') with live syntax-highlighted marks.
// init(elements) — wire DOM nodes once at startup (no getElementById inside)
//   elements: { input, prevBtn, nextBtn, counter, lform, fhirJsonView }

let _previewMode = 'preview';
document.addEventListener('preview-mode-change', e => { _previewMode = e.detail.mode; });
import { highlightJson, highlightJsonWithSearch } from '../utils.js';

let _el      = null;
let _matches = [];   // matched elements (lform-item rows OR <mark> nodes)
let _idx     = -1;   // current match index

// ── Init ──────────────────────────────────────────────────────────────────────
export function init(elements) {
  _el = elements;

  _el.input.addEventListener('input', _onInput);
  _el.input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); _navigate(+1); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); _navigate(-1); }
    if (e.key === 'Escape')    { _el.input.value = ''; _clear(); }
  });
  _el.nextBtn.addEventListener('click', () => _navigate(+1));
  _el.prevBtn.addEventListener('click', () => _navigate(-1));
}

// Called by render-preview.js after every re-render so stale references update.
export function refresh() {
  if (_el && _el.input.value.trim()) _onInput();
}

// ── Dispatch by mode ──────────────────────────────────────────────────────────
function _onInput() {
  const q = _el.input.value.trim().toLowerCase();
  _clearHighlights();

  if (!q) { _clear(); return; }

  if (_previewMode === 'json') {
    _onInputJson(q);
  } else {
    _onInputRows(q);
  }
}

// ── Rows mode (preview / patient) ─────────────────────────────────────────────
function _onInputRows(q) {
  const rows = [..._el.lform.querySelectorAll('[data-preview-id]')];
  _matches = rows.filter(row => row.textContent.toLowerCase().includes(q));

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

// ── JSON mode ─────────────────────────────────────────────────────────────────
function _onInputJson(q) {
  // textContent always gives the raw JSON regardless of what innerHTML contains
  const raw = _el.fhirJsonView.textContent;
  const { html, count } = highlightJsonWithSearch(raw, q);
  _el.fhirJsonView.innerHTML = html;

  if (count === 0) {
    _idx = -1;
    _el.counter.textContent = 'No results';
    _el.counter.classList.add('search-counter--empty');
    _el.input.classList.add('search-input--empty');
    return;
  }

  _el.input.classList.remove('search-input--empty');
  _el.counter.classList.remove('search-counter--empty');
  _matches = [..._el.fhirJsonView.querySelectorAll('mark.search-match')];
  _idx = 0;
  _activateJson();
}

// ── Navigation ────────────────────────────────────────────────────────────────
function _navigate(dir) {
  if (_matches.length === 0) return;
  if (_idx >= 0 && _idx < _matches.length) {
    _matches[_idx].classList.remove('search-match--active');
  }
  _idx = (_idx + dir + _matches.length) % _matches.length;
  if (_previewMode === 'json') {
    _activateJson();
  } else {
    _activate();
  }
}

function _activate() {
  const el = _matches[_idx];
  el.classList.add('search-match--active');
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  _el.counter.textContent = (_idx + 1) + ' / ' + _matches.length;
  _el.counter.classList.remove('search-counter--empty');
}

function _activateJson() {
  _matches.forEach((m, i) => m.classList.toggle('search-match--active', i === _idx));
  _matches[_idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
  _el.counter.textContent = (_idx + 1) + ' / ' + _matches.length;
  _el.counter.classList.remove('search-counter--empty');
}

// ── Clear ─────────────────────────────────────────────────────────────────────
function _clearHighlights() {
  if (_previewMode === 'json' && _el.fhirJsonView.querySelector('mark.search-match')) {
    // Re-render without marks; textContent gives raw JSON before re-render
    const raw = _el.fhirJsonView.textContent;
    _el.fhirJsonView.innerHTML = highlightJson(raw);
  } else {
    _matches.forEach(m => {
      m.classList.remove('search-match');
      m.classList.remove('search-match--active');
    });
  }
  _matches = [];
  _idx = -1;
}

function _clear() {
  _clearHighlights();
  _el.counter.textContent = '';
  _el.counter.classList.remove('search-counter--empty');
  _el.input.classList.remove('search-input--empty');
}
