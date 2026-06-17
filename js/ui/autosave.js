// ── Autosave ──────────────────────────────────────────────────────────────────
// Saves the current questionnaire to a per-questionnaire storage slot.

import * as storage from '../storage/storage.js';
// Key = Questionnaire.url  OR  identifier[fhir-qb.app/editor].value (auto-gen).
//
// API:
//   init({ buildFn, questMeta, onSaved }) — start the interval
//   getMostRecentDraft() → { meta, key } | null
//   getDraftData(key)    → parsedJson | null
//   clearDraft()         — remove current questionnaire's slot

const EDITOR_SYSTEM  = 'https://fhir-qb.app/editor';
const KEY_PREFIX     = 'autosave:';
const META_PREFIX    = 'autosave-meta:';
const LS_ENABLED_KEY = 'autosave-enabled';
const INTERVAL_MS    = 15_000;

let _buildFn   = null;
let _questMeta = null;
let _timer     = null;
let _onSaved   = null;
let _enabled   = true; // initialised from storage in init()

export function isEnabled() { return _enabled; }
export function setEnabled(val) {
  _enabled = !!val;
  storage.setItem(LS_ENABLED_KEY, String(_enabled));
}

/** Compute the autosave slot key for the current questionnaire.
 *  Auto-generates an editor identifier if the questionnaire has no url. */
function _getKey(q) {
  if (q.url) return q.url;
  const existing = (_questMeta._rawIdentifier || []).find(i => i.system === EDITOR_SYSTEM);
  if (existing?.value) return existing.value;
  // Auto-generate — stored in questMeta so it will be included in exports
  const value = crypto.randomUUID();
  _questMeta._rawIdentifier.push({ system: EDITOR_SYSTEM, value });
  return value;
}

function _save() {
  if (!_enabled || !_buildFn) return;
  try {
    const q = _buildFn();
    if (!q.item || q.item.length === 0) return;
    const key = _getKey(q);
    storage.setItem(KEY_PREFIX  + key, JSON.stringify(q));
    storage.setItem(META_PREFIX + key, JSON.stringify({
      savedAt: new Date().toISOString(),
      title:   q.title || 'Untitled',
      key,
    }));
    if (_onSaved) _onSaved(new Date());
  } catch (_) { /* storage full — fail silently */ }
}

/** Start autosave interval. Call once after app is ready. */
export async function init({ buildFn, questMeta, onSaved }) {
  _buildFn   = buildFn;
  _questMeta = questMeta;
  _onSaved   = onSaved ?? null;
  _enabled   = await storage.getItem(LS_ENABLED_KEY) !== 'false';
  // One-time cleanup of old single-slot keys from previous version
  storage.removeItem('autosave-draft');
  storage.removeItem('autosave-meta');
  if (_timer) clearInterval(_timer);
  _timer = setInterval(_save, INTERVAL_MS);
}

/** Return { meta, key } for the most recently saved draft across all slots,
 *  or null if no drafts exist. */
export async function getMostRecentDraft() {
  let best = null;
  for (const lsKey of await storage.keys()) {
    if (!lsKey.startsWith(META_PREFIX)) continue;
    try {
      const meta = JSON.parse(await storage.getItem(lsKey));
      if (!best || meta.savedAt > best.meta.savedAt) best = { meta, key: meta.key };
    } catch (_) { /* malformed meta — skip */ }
  }
  return best;
}

/** Return a saved questionnaire as a parsed object, or null. */
export async function getDraftData(key) {
  try {
    const raw = await storage.getItem(KEY_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

/** Remove the current questionnaire's autosave slot. */
export function clearDraft() {
  if (!_buildFn || !_questMeta) return;
  try {
    const q = _buildFn();
    const key = q.url
      || (_questMeta._rawIdentifier || []).find(i => i.system === EDITOR_SYSTEM)?.value;
    if (!key) return;
    storage.removeItem(KEY_PREFIX  + key);
    storage.removeItem(META_PREFIX + key);
  } catch (_) { /* key may not exist */ }
}

// Self-wire: clear draft when QuestionnaireLoader resets
import('../events.js').then(({ AppEvents }) => {
  document.addEventListener(AppEvents.AUTOSAVE_CLEAR_DRAFT, () => clearDraft());
});
