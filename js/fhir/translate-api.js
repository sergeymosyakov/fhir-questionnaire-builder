// ── translate-api.js ─────────────────────────────────────────────────────────
// Batches translatable texts and delegates to the active machine-translation
// provider (see translate-providers.js). Empty strings pass through unchanged.
//
// Public API:
//   translateBatch(texts, targetLang, sourceLang?)  → Promise<string[]>
//   SUPPORTED_LANGUAGES  Map<code, label>  (from js/fhir/languages.js)
//
// The provider, endpoint and API key are configurable via Settings
// (CONFIG_KEYS.TRANSLATE_PROVIDER / TRANSLATE_API / TRANSLATE_API_KEY).
// Defaults to the free, key-less Google gtx provider.
// ─────────────────────────────────────────────────────────────────────────────
import { LANGUAGES_MAP } from './languages.js';
import { serverConfig, CONFIG_KEYS } from './server-config.js';
import { getProvider } from './translate-providers.js';

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
  const out = new Array(texts.length).fill('');
  const nonEmpty = texts
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t && t.trim());
  if (!nonEmpty.length) return out;

  const provider = getProvider(serverConfig.get(CONFIG_KEYS.TRANSLATE_PROVIDER) || 'gtx');
  const opts = {
    endpoint:  serverConfig.get(CONFIG_KEYS.TRANSLATE_API)     || provider.defaultEndpoint || '',
    apiKey:    serverConfig.get(CONFIG_KEYS.TRANSLATE_API_KEY) || '',
    corsProxy: serverConfig.get(CONFIG_KEYS.CORS_PROXY)        || '',
  };

  const translated = await provider.translate(nonEmpty.map(({ t }) => t), targetLang, sourceLang, opts);
  nonEmpty.forEach(({ i }, idx) => { out[i] = translated[idx] ?? nonEmpty[idx].t; });
  return out;
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
