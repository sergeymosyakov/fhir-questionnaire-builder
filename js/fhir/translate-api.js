// ── translate-api.js ─────────────────────────────────────────────────────────
// Thin wrapper around the unofficial Google Translate gtx endpoint.
// No API key required. Texts are batched via newline-joining to minimise
// round-trips. Each call translates up to BATCH_SIZE texts at once.
//
// Public API:
//   translateBatch(texts, targetLang, sourceLang?)  → Promise<string[]>
//   SUPPORTED_LANGUAGES  Map<code, label>  (from js/fhir/languages.js)
//
// The endpoint is configurable via Settings (CONFIG_KEYS.TRANSLATE_API). Any
// gtx-compatible endpoint (self-hosted proxy) works; falls back to Google gtx.
// ─────────────────────────────────────────────────────────────────────────────
import { LANGUAGES_MAP } from './languages.js';
import { serverConfig, CONFIG_KEYS } from './server-config.js';

// Default unofficial Google Translate gtx endpoint (base URL, query appended below).
const DEFAULT_TRANSLATE_ENDPOINT = 'https://translate.googleapis.com/translate_a/single';

const BATCH_SIZE = 40;   // Google gtx handles ~40 segments per request reliably
// Unique record separator placed on its own line. Google Translate preserves it
// verbatim and never merges it into adjacent text, so multi-line texts (XHTML /
// Markdown that contain their own newlines) split back correctly by index.
const SEP_TOKEN = '\uE000QBSEP\uE000';   // private-use-area sentinel, unlikely in real text
const SEPARATOR = '\n' + SEP_TOKEN + '\n';

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
    // Split result back by the sentinel token (tolerant of surrounding whitespace
    // the translator may add/remove around the separator).
    const parts = translated.split(SEP_TOKEN);
    chunk.forEach(({ i }, idx) => {
      out[i] = (parts[idx] ?? chunk[idx].t).replace(/^\n+|\n+$/g, ''); // trim wrapping newlines
    });
  }

  return out;
}

/**
 * Single request to the unofficial Google Translate gtx endpoint.
 * Returns the translated string (may contain newlines when input has them).
 */
async function _callGtx(text, target, source) {
  const base = serverConfig.get(CONFIG_KEYS.TRANSLATE_API) || DEFAULT_TRANSLATE_ENDPOINT;
  const url = base
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
// SUPPORTED_LANGUAGES is the master language list from languages.js
export const SUPPORTED_LANGUAGES = LANGUAGES_MAP;

// Make accessible to preview-form language switcher (avoids circular import)
if (typeof window !== 'undefined') {
  window._translationModule = { SUPPORTED_LANGUAGES: LANGUAGES_MAP };
}

// UI_STRINGS lives in ui-strings.js (shared with render-ctx.js uiStr helper)
export { UI_STRINGS } from './ui-strings.js';
