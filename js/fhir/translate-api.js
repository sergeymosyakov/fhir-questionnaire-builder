// ── translate-api.js ─────────────────────────────────────────────────────────
// Thin wrapper around the unofficial Google Translate gtx endpoint.
// No API key required. Texts are batched via newline-joining to minimise
// round-trips. Each call translates up to BATCH_SIZE texts at once.
//
// Public API:
//   translateBatch(texts, targetLang, sourceLang?)  → Promise<string[]>
//   SUPPORTED_LANGUAGES  Map<code, label>
// ─────────────────────────────────────────────────────────────────────────────

const BATCH_SIZE = 40;   // Google gtx handles ~40 segments per request reliably
const SEPARATOR  = '\n'; // newline is preserved by gtx (not a separator in output)

/**
 * Translate an array of strings to `targetLang` (BCP-47, e.g. 'es', 'fr').
 * Returns an array of translated strings in the same order.
 * Empty strings pass through unchanged.
 *
 * @param {string[]} texts
 * @param {string}   targetLang  BCP-47 target language code
 * @param {string}   [sourceLang='auto']
 * @returns {Promise<string[]>}
 */
export async function translateBatch(texts, targetLang, sourceLang = 'auto') {
  const out    = new Array(texts.length).fill('');
  const nonEmpty = texts
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t && t.trim());

  for (let start = 0; start < nonEmpty.length; start += BATCH_SIZE) {
    const chunk = nonEmpty.slice(start, start + BATCH_SIZE);
    const joined = chunk.map(({ t }) => t).join(SEPARATOR);
    const translated = await _callGtx(joined, targetLang, sourceLang);
    // Split result back by newline — same separator, same count
    const parts = translated.split(SEPARATOR);
    chunk.forEach(({ i }, idx) => {
      out[i] = parts[idx] ?? chunk[idx].t; // fallback to original on mismatch
    });
  }

  return out;
}

/**
 * Single request to the unofficial Google Translate gtx endpoint.
 * Returns the translated string (may contain newlines when input has them).
 */
async function _callGtx(text, target, source) {
  const url = 'https://translate.googleapis.com/translate_a/single'
    + `?client=gtx&sl=${encodeURIComponent(source)}&tl=${encodeURIComponent(target)}`
    + `&dt=t&q=${encodeURIComponent(text)}`;

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Translation request failed: ${resp.status}`);

  const data = await resp.json();
  // Response format: [ [[translated, original, null, null, 1], ...], ... ]
  // Concatenate all translated segments from data[0]
  return (data[0] ?? []).map(seg => seg[0] ?? '').join('');
}

// ── Supported languages ───────────────────────────────────────────────────────
// A practical subset of languages supported by Google Translate.
// Code = BCP-47 / ISO 639-1.
export const SUPPORTED_LANGUAGES = new Map([
  ['ar', 'Arabic'],
  ['zh', 'Chinese (Simplified)'],
  ['zh-TW', 'Chinese (Traditional)'],
  ['hr', 'Croatian'],
  ['cs', 'Czech'],
  ['da', 'Danish'],
  ['nl', 'Dutch'],
  ['fi', 'Finnish'],
  ['fr', 'French'],
  ['de', 'German'],
  ['el', 'Greek'],
  ['he', 'Hebrew'],
  ['hi', 'Hindi'],
  ['hu', 'Hungarian'],
  ['id', 'Indonesian'],
  ['it', 'Italian'],
  ['ja', 'Japanese'],
  ['ko', 'Korean'],
  ['ms', 'Malay'],
  ['no', 'Norwegian'],
  ['fa', 'Persian'],
  ['pl', 'Polish'],
  ['pt', 'Portuguese'],
  ['ro', 'Romanian'],
  ['ru', 'Russian'],
  ['sk', 'Slovak'],
  ['sl', 'Slovenian'],
  ['es', 'Spanish'],
  ['sw', 'Swahili'],
  ['sv', 'Swedish'],
  ['tl', 'Tagalog'],
  ['ta', 'Tamil'],
  ['th', 'Thai'],
  ['tr', 'Turkish'],
  ['uk', 'Ukrainian'],
  ['ur', 'Urdu'],
  ['vi', 'Vietnamese'],
]);

// Make accessible to preview-form language switcher (avoids circular import)
if (typeof window !== 'undefined') {
  window._translationModule = { SUPPORTED_LANGUAGES };
}

// UI_STRINGS lives in ui-strings.js (shared with render-ctx.js uiStr helper)
export { UI_STRINGS } from './ui-strings.js';
