// ── Undo / redo history ───────────────────────────────────────────────────────
// Hooks into _formTick via effect() — debounced 400ms + requestIdleCallback.
// Snapshots = FHIR JSON strings; restored via importFn(parsed, renderFn).
// Stack resets automatically on questionnaire-loaded / questionnaire-cleared.
//
// API:
//   init({ buildFn, importFn, renderFn, formTick, effect, onChange })
//   undo() / redo()
//   canUndo() / canRedo()  → boolean

const MAX         = 50;
const DEBOUNCE_MS = 400;
const _ric        = cb => (window.requestIdleCallback ?? (fn => setTimeout(fn, 0)))(cb);

let _buildFn   = null;
let _importFn  = null;
let _renderFn  = null;
let _onChange  = null;
let _stack     = [];   // JSON strings, oldest first
let _cursor    = -1;   // index of current state
let _timer     = null;
let _pending   = false;   // debounce ticking → undo/redo disabled
let _restoring = false;   // import in progress → suppress scheduling

// ── Public state ──────────────────────────────────────────────────────────────
export const canUndo = () => !_pending && _cursor > 0;
export const canRedo = () => !_pending && _cursor < _stack.length - 1;

function _notify() { _onChange?.(); }

// ── Stack management ──────────────────────────────────────────────────────────
function _push(json) {
  _stack = _stack.slice(0, _cursor + 1);
  _stack.push(json);
  if (_stack.length > MAX) _stack.shift();
  _cursor = _stack.length - 1;
  _notify();
}

function _takeSnapshot() {
  if (!_buildFn || _restoring) return;
  _push(JSON.stringify(_buildFn()));
  _pending = false;
  _notify();
}

function _schedule() {
  if (_restoring) return;
  _pending = true;
  _notify();
  clearTimeout(_timer);
  _timer = setTimeout(() => _ric(_takeSnapshot), DEBOUNCE_MS);
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
export function init({ buildFn, importFn, renderFn, formTick, effect, onChange }) {
  _buildFn  = buildFn;
  _importFn = importFn;
  _renderFn = renderFn;
  _onChange = onChange ?? null;

  // Take an initial snapshot so the first real change has something to undo to
  _ric(() => { _push(JSON.stringify(_buildFn())); });

  // Reset stack when a new questionnaire is loaded (not during undo/redo)
  document.addEventListener('questionnaire-loaded', () => {
    if (_restoring) return;
    clearTimeout(_timer);
    _pending = false;
    _stack   = [];
    _cursor  = -1;
    _ric(() => { _push(JSON.stringify(_buildFn())); });
  });

  document.addEventListener('questionnaire-cleared', () => {
    if (_restoring) return;
    clearTimeout(_timer);
    _pending = false;
    _stack   = [];
    _cursor  = -1;
    _notify();
  });

  // Watch formTick — any tree mutation schedules a snapshot
  let _skipFirst = true;
  effect(() => {
    formTick.value; // subscribe
    if (_skipFirst) { _skipFirst = false; return; }
    _schedule();
  });
}

// ── Undo / Redo ───────────────────────────────────────────────────────────────
export function undo() {
  if (!canUndo()) return;
  _cursor--;
  _restoring = true;
  try {
    _importFn(JSON.parse(_stack[_cursor]), _renderFn);
    document.dispatchEvent(new CustomEvent('questionnaire-loaded'));
  } finally {
    _restoring = false;
  }
  _notify();
}

export function redo() {
  if (!canRedo()) return;
  _cursor++;
  _restoring = true;
  try {
    _importFn(JSON.parse(_stack[_cursor]), _renderFn);
    document.dispatchEvent(new CustomEvent('questionnaire-loaded'));
  } finally {
    _restoring = false;
  }
  _notify();
}
