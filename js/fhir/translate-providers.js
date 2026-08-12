// ── translate-providers.js ────────────────────────────────────────────────────
// Registry of machine-translation providers. Each provider knows how to turn a
// batch of texts into translated texts using its own protocol/auth. The active
// provider is selected in Settings (CONFIG_KEYS.TRANSLATE_PROVIDER).
//
// Provider shape:
//   { id, label, keyLabel?, optionalKey?, defaultEndpoint, endpointPlaceholder, hint,
//     translate(texts, target, source, { endpoint, apiKey, corsProxy }) → Promise<string[]> }
//
// translate() receives ONLY non-empty texts (the caller restores empties/order)
// and must return a same-length array of translated strings, same order.

const BATCH = 40;

// Record separator on its own line: gtx/Libre preserve it verbatim so multi-line
// rich text (XHTML/Markdown) splits back by index. Private-use-area sentinel.
const SEP_TOKEN = '\uE000QBSEP\uE000';
const SEPARATOR = '\n' + SEP_TOKEN + '\n';

const DEFAULT_GTX    = 'https://translate.googleapis.com/translate_a/single';
const DEFAULT_DEEPL  = 'https://api-free.deepl.com/v2/translate';
const DEFAULT_OPENAI = 'https://api.openai.com/v1/chat/completions';

const enc = encodeURIComponent;

function _chunks(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// Route a request through the configured CORS proxy (`?url=` forwarder).
function _viaProxy(url, corsProxy) {
  return corsProxy ? `${corsProxy}?url=${enc(url)}` : url;
}

// ── Google Translate (unofficial gtx endpoint) ────────────────────────────────
async function gtxTranslate(texts, target, source, { endpoint }) {
  const base = endpoint || DEFAULT_GTX;
  const out = [];
  for (const chunk of _chunks(texts, BATCH)) {
    const joined = chunk.join(SEPARATOR);
    const url = base
      + `?client=gtx&sl=${enc(source)}&tl=${enc(target)}&dt=t&q=${enc(joined)}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Translation request failed: ${resp.status}`);
    const data = await resp.json();
    // Response: [ [[translated, original, …], …], … ] — concat data[0] segments.
    const translated = (data[0] ?? []).map(seg => seg[0] ?? '').join('');
    const parts = translated.split(SEP_TOKEN);
    chunk.forEach((t, i) => out.push((parts[i] ?? t).replace(/^\n+|\n+$/g, '')));
  }
  return out;
}

// ── DeepL v2 ──────────────────────────────────────────────────────────────────
// Browsers cannot call DeepL directly (no CORS) — a CORS proxy is required.
function _deeplLang(code) {
  const up = code.toUpperCase();
  const KEEP = new Set(['EN-GB', 'EN-US', 'PT-BR', 'PT-PT']);
  return KEEP.has(up) ? up : up.split('-')[0];
}
async function deeplTranslate(texts, target, source, { endpoint, apiKey, corsProxy }) {
  if (!apiKey) throw new Error('DeepL requires an API key (Settings → Translation API).');
  const base = endpoint || DEFAULT_DEEPL;
  const out = [];
  for (const chunk of _chunks(texts, BATCH)) {
    const params = new URLSearchParams();
    params.set('target_lang', _deeplLang(target));
    if (source && source !== 'auto') params.set('source_lang', _deeplLang(source));
    chunk.forEach(t => params.append('text', t));
    const resp = await fetch(_viaProxy(base, corsProxy), {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    if (!resp.ok) throw new Error(`DeepL request failed: ${resp.status}`);
    const data = await resp.json();
    (data.translations ?? []).forEach(tr => out.push(tr.text ?? ''));
  }
  return out;
}

// ── LibreTranslate (self-hosted) ──────────────────────────────────────────────
function _libreLang(code) {
  return code === 'auto' ? 'auto' : code.split('-')[0];
}
async function libreTranslate(texts, target, source, { endpoint, apiKey, corsProxy }) {
  if (!endpoint) throw new Error('LibreTranslate requires an endpoint URL (Settings → Translation API).');
  const out = [];
  for (const chunk of _chunks(texts, BATCH)) {
    const body = { q: chunk, source: _libreLang(source), target: _libreLang(target), format: 'text' };
    if (apiKey) body.api_key = apiKey;
    const resp = await fetch(_viaProxy(endpoint, corsProxy), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`LibreTranslate request failed: ${resp.status}`);
    const data = await resp.json();
    const t = data.translatedText;
    if (Array.isArray(t)) t.forEach((x, i) => out.push(x ?? chunk[i]));
    else out.push(t ?? chunk[0]);
  }
  return out;
}

// ── OpenAI chat completions ───────────────────────────────────────────────────
async function openaiTranslate(texts, target, source, { endpoint, apiKey }) {
  if (!apiKey) throw new Error('OpenAI requires an API key (Settings → Translation API).');
  const base = endpoint || DEFAULT_OPENAI;
  const out = [];
  for (const chunk of _chunks(texts, BATCH)) {
    const sys = `You are a translation engine. Translate each element of the user's JSON `
      + `array into ${target} (BCP-47). Preserve any HTML/Markdown formatting. Respond with `
      + `a JSON object {"translations":[…]} whose array has the same length and order.`;
    const resp = await fetch(base, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: JSON.stringify(chunk) },
        ],
      }),
    });
    if (!resp.ok) throw new Error(`OpenAI request failed: ${resp.status}`);
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content ?? '{}';
    let arr = [];
    try {
      const parsed = JSON.parse(content);
      arr = Array.isArray(parsed) ? parsed : (parsed.translations ?? []);
    } catch { arr = []; }
    chunk.forEach((t, i) => out.push(arr[i] ?? t));
  }
  return out;
}

// ── Registry ──────────────────────────────────────────────────────────────────
export const TRANSLATE_PROVIDERS = [
  {
    id: 'gtx', label: 'Google Translate (free)',
    defaultEndpoint: DEFAULT_GTX,
    endpointPlaceholder: DEFAULT_GTX,
    hint: 'Free, no API key. Optionally point at a self-hosted gtx-compatible proxy.',
    translate: gtxTranslate,
  },
  {
    id: 'deepl', label: 'DeepL',
    keyLabel: 'DeepL Auth Key',
    defaultEndpoint: DEFAULT_DEEPL,
    endpointPlaceholder: DEFAULT_DEEPL,
    hint: 'Requires a DeepL API key. Browser calls need a CORS Proxy (set it in Settings).',
    translate: deeplTranslate,
  },
  {
    id: 'libre', label: 'LibreTranslate (self-hosted)',
    keyLabel: 'API Key (optional)', optionalKey: true,
    defaultEndpoint: '',
    endpointPlaceholder: 'https://libretranslate.example.com/translate',
    hint: 'Self-hosted LibreTranslate. Set the /translate endpoint; API key optional.',
    translate: libreTranslate,
  },
  {
    id: 'openai', label: 'OpenAI',
    keyLabel: 'OpenAI API Key',
    defaultEndpoint: DEFAULT_OPENAI,
    endpointPlaceholder: DEFAULT_OPENAI,
    hint: 'Requires an OpenAI API key. Uses gpt-4o-mini.',
    translate: openaiTranslate,
  },
];

const PROVIDER_MAP = new Map(TRANSLATE_PROVIDERS.map(p => [p.id, p]));

export function getProvider(id) {
  return PROVIDER_MAP.get(id) || PROVIDER_MAP.get('gtx');
}
