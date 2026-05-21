// ── Autosave ───────────────────────────────────────────────────────────────────
// Saves the current questionnaire as FHIR JSON to localStorage every 15 seconds.
// On page load, if a draft exists it can be restored via the returned promise.
//
// API:
//   init(buildFn, importFn, renderFn) — start the interval; returns draft metadata
//   hasDraft()  → boolean
//   loadDraft(importFn, renderFn) — restore the saved draft
//   clearDraft() — remove saved draft

const LS_KEY         = 'autosave-draft';
const LS_META_KEY    = 'autosave-meta';
const LS_ENABLED_KEY = 'autosave-enabled';
const INTERVAL_MS    = 15_000;

let _buildFn  = null;
let _timer    = null;
let _enabled  = localStorage.getItem(LS_ENABLED_KEY) !== 'false';
let _onSaved  = null;

export function isEnabled()       { return _enabled; }
export function setEnabled(val) {
  _enabled = val;
  localStorage.setItem(LS_ENABLED_KEY, String(val));
}

function _save() {
  if (!_enabled || !_buildFn) return;
  try {
    const q = _buildFn();
    if (!q.item || q.item.length === 0) return; // nothing to save
    localStorage.setItem(LS_KEY,      JSON.stringify(q));
    localStorage.setItem(LS_META_KEY, JSON.stringify({
      savedAt: new Date().toISOString(),
      title:   q.title || 'Untitled',
    }));
    if (_onSaved) _onSaved(new Date());
  } catch (_) {
    // localStorage full or unavailable — fail silently
  }
}

/** Start autosave interval. Call once after app is ready.
 *  onSaved(date) — optional callback fired after each successful save. */
export function init(buildFn, onSaved) {
  _buildFn = buildFn;
  _onSaved = onSaved || null;
  // _enabled already set from localStorage
  if (_timer) clearInterval(_timer);
  _timer = setInterval(_save, INTERVAL_MS);
}

/** Returns { savedAt, title } metadata or null. */
export function getDraftMeta() {
  try {
    const raw = localStorage.getItem(LS_META_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

/** Return the stored draft as a parsed object, or null. */
export function getDraftData() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

/** Remove the saved draft from localStorage. */
export function clearDraft() {
  localStorage.removeItem(LS_KEY);
  localStorage.removeItem(LS_META_KEY);
}
