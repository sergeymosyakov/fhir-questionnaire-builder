// ── TerminologyService ────────────────────────────────────────────────────────
// Singleton service for all FHIR terminology server interactions.
// Handles ValueSet/$expand and server health checks (GET /metadata).
//
// Usage:
//   terminologyService.getServer(node, questMeta)        → string (server URL)
//   terminologyService.expandValueSet(vsUrl, serverUrl)  → Promise<option[]>
//   terminologyService.testServer(serverUrl)             → Promise<{ok, message}>
//   terminologyService.expandAll(treeNodes, questMeta)   → Promise<failure[]>

import { serverConfig, CONFIG_KEYS } from './server-config.js';

// Default terminology server — falls back to HL7 public server.
const FALLBACK_TERMINOLOGY_SERVER = 'https://tx.fhir.org/r4';

function _corsProxy()    { return (serverConfig.get(CONFIG_KEYS.CORS_PROXY)    || '').replace(/\/$/, ''); }
function _termServer()   { return (serverConfig.get(CONFIG_KEYS.TERMINOLOGY_SERVER) || FALLBACK_TERMINOLOGY_SERVER).replace(/\/$/, ''); }
function _nlmApiBase()   { return (serverConfig.get(CONFIG_KEYS.NLM_API_BASE)   || 'https://clinicaltables.nlm.nih.gov/api').replace(/\/$/, ''); }

const EXPAND_COUNT        = 500;
const FETCH_TIMEOUT       = 15_000;
const TEST_TIMEOUT        = 8_000;
const RETRY_STATUSES      = new Set([429, 500, 503, 504]);
const RETRY_DELAY_MS      = 700;
const MAX_RETRIES         = 2;
const MAX_RETRY_AFTER_MS  = 30_000;

/**
 * Resolve the delay before the next retry attempt.
 * Honours the Retry-After response header (RFC 7231) if present, capped at 30s.
 * Falls back to exponential backoff (700ms, 1400ms, …).
 */
function _retryDelayMs(res, attempt) {
  const header = res.headers.get('Retry-After');
  if (header) {
    const secs = Number(header);
    if (!isNaN(secs) && secs > 0) return Math.min(secs * 1000, MAX_RETRY_AFTER_MS);
    const date = new Date(header);
    if (!isNaN(date.getTime())) return Math.min(Math.max(0, date - Date.now()), MAX_RETRY_AFTER_MS);
  }
  return RETRY_DELAY_MS * (attempt + 1);
}

/**
 * Fetch with automatic retry on transient server errors (503, 500, 429, 504).
 * Creates a fresh AbortSignal per attempt so a timeout on one try does not
 * abort subsequent retries.
 * @param {string}   url
 * @param {object}   options   fetch options WITHOUT a signal (signal is managed internally)
 * @param {number}   timeout   per-attempt timeout in ms
 * @param {Function} [onRetry] called before each retry (after the delay)
 */
async function _fetchWithRetry(url, options, timeout, onRetry) {
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let res;
    try {
      res = await fetch(url, { ...options, signal: AbortSignal.timeout(timeout) });
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
        onRetry?.();
      }
      continue;
    }
    if (!RETRY_STATUSES.has(res.status)) return res;
    lastErr = new Error(`HTTP ${res.status} ${res.statusText}`);
    if (attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, _retryDelayMs(res, attempt)));
      onRetry?.();
    }
  }
  throw lastErr;
}

function _collectExternalVsNodes(nodes, out = []) {
  for (const node of nodes) {
    // Skip lookup items — they perform on-demand server-side search, not eager expansion
    if (node._answerValueSet && !node._answerValueSet.startsWith('#') && node._itemControl !== 'lookup') out.push(node);
    if (node.children?.length) _collectExternalVsNodes(node.children, out);
  }
  return out;
}

function _collectUnitVsNodes(nodes, out = []) {
  for (const node of nodes) {
    if (node._unitValueSet) out.push(node);
    if (node.children?.length) _collectUnitVsNodes(node.children, out);
  }
  return out;
}

class TerminologyService {
  /** Wrap a target URL through the CORS proxy if configured. */
  _proxyUrl(url) {
    const proxy = _corsProxy();
    return proxy ? `${proxy}?url=${encodeURIComponent(url)}` : url;
  }

  /**
   * Return a direct (non-proxied) URL for an NLM Clinical Tables API path.
   * clinicaltables.nlm.nih.gov already sends Access-Control-Allow-Origin: *,
   * so routing through the CORS proxy is unnecessary and causes 403 errors.
   * The base URL is read from config.json (key: nlmApiBaseUrl).
   * @param {string} relativePath  Path + query string relative to the NLM API base (no leading slash).
   * @returns {Promise<string>}
   */
  async nlmUrl(relativePath) {
    await serverConfig.ready();
    return `${_nlmApiBase()}/${relativePath}`;
  }

  /** Resolve the server URL for a node using the full fallback chain. */
  getServer(node, questMeta) {
    const url = node?._preferredTermServer
      || questMeta?.preferredTermServer
      || _termServer();
    return url.replace(/\/$/, '');
  }

  /**
   * Expand a ValueSet from a FHIR terminology server.
   * @param {string} vsUrl      Canonical ValueSet URL to expand.
   * @param {string} serverUrl  Base URL of the FHIR terminology server.
   * @returns {Promise<Array<{code: string, display: string, system: string}>>}
   */
  async expandValueSet(vsUrl, serverUrl) {
    await serverConfig.ready();
    const base   = (serverUrl || _termServer()).replace(/\/$/, '');
    const reqUrl = this._proxyUrl(`${base}/ValueSet/$expand?url=${encodeURIComponent(vsUrl)}&_count=${EXPAND_COUNT}`);
    const res = await _fetchWithRetry(reqUrl, {
      headers: { Accept: 'application/fhir+json' },
    }, FETCH_TIMEOUT);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const body = await res.json();
    if (body.resourceType !== 'ValueSet') throw new Error('Response is not a FHIR ValueSet');
    return (body.expansion?.contains || []).map(c => ({
      code:    c.code    ?? '',
      display: c.display || c.code || '',
      system:  c.system  || '',
    }));
  }

  /**
   * Expand a ValueSet with an optional text filter for live server-side lookup.
   * Uses the FHIR $expand operation with a `filter` parameter.
   * @param {string} vsUrl       Canonical ValueSet URL to expand.
   * @param {string} serverUrl   Base URL of the FHIR terminology server.
   * @param {string} [filter]    Optional search text (sent as $expand?filter=).
   * @param {number} [count=50]  Max results to return.
   * @returns {Promise<Array<{code: string, display: string, system: string}>>}
   */
  async expandWithFilter(vsUrl, serverUrl, filter = '', count = 50) {
    await serverConfig.ready();
    const base   = (serverUrl || _termServer()).replace(/\/$/, '');
    const params = new URLSearchParams({ url: vsUrl, _count: String(count) });
    if (filter && filter.trim()) params.set('filter', filter.trim());
    const reqUrl = this._proxyUrl(`${base}/ValueSet/$expand?${params}`);
    const res = await _fetchWithRetry(reqUrl, {
      headers: { Accept: 'application/fhir+json' },
    }, FETCH_TIMEOUT);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const body = await res.json();
    if (body.resourceType !== 'ValueSet') throw new Error('Response is not a FHIR ValueSet');
    return (body.expansion?.contains || []).map(c => ({
      code:    c.code    ?? '',
      display: c.display || c.code || '',
      system:  c.system  || '',
    }));
  }

  /**
   * Test whether a URL points to a reachable FHIR terminology server.
   * Fetches /metadata and checks for a CapabilityStatement response.
   * @returns {Promise<{ok: boolean, message: string}>}
   */
  async testServer(serverUrl, { onRetry } = {}) {
    await serverConfig.ready();
    const base = (serverUrl || '').trim().replace(/\/$/, '');
    if (!base) return { ok: false, message: 'No URL provided' };
    try {
      const res = await _fetchWithRetry(this._proxyUrl(`${base}/metadata`), {
        headers: { Accept: 'application/fhir+json' },
      }, TEST_TIMEOUT, onRetry);
      if (!res.ok) return { ok: false, message: `HTTP ${res.status} ${res.statusText}` };
      const body = await res.json();
      if (body.resourceType !== 'CapabilityStatement') {
        return { ok: false, message: 'Not a FHIR server (no CapabilityStatement)' };
      }
      const name = [body.software?.name, body.software?.version].filter(Boolean).join(' ') || 'OK';
      return { ok: true, message: name };
    } catch (err) {
      return { ok: false, message: err.message };
    }
  }

  /**
   * Test whether a specific ValueSet URL can be expanded by a terminology server.
   * Returns the number of codes on success, or an error message on failure.
   * @param {string} vsUrl      Canonical ValueSet URL to expand.
   * @param {string} [serverUrl] Terminology server base URL (falls back to default).
   * @returns {Promise<{ok: boolean, message: string, count?: number}>}
   */
  async testExpand(vsUrl, serverUrl) {
    if (!vsUrl) return { ok: false, message: 'No URL provided' };
    try {
      const codes = await this.expandValueSet(vsUrl, serverUrl || _termServer());
      return { ok: true, message: `${codes.length} code${codes.length !== 1 ? 's' : ''}`, count: codes.length };
    } catch (err) {
      return { ok: false, message: err.message };
    }
  }

  /**
   * Expand all external answerValueSets in the tree and cache results on each node.
   * Results are stored in node._vsCache (array of options, empty on failure).
   * @param {Array}  treeNodes  Root nodes of the questionnaire tree.
   * @param {object} questMeta  questMeta object (for questionnaire-level server).
   * @returns {Promise<Array<{node, vsUrl, server, error}>>} List of failures (empty = all OK).
   */
  async expandAll(treeNodes, questMeta) {
    const nodes = _collectExternalVsNodes(treeNodes);
    const unitNodes = _collectUnitVsNodes(treeNodes);
    if (!nodes.length && !unitNodes.length) return [];
    const failures = [];
    for (const node of nodes) {
      const server = this.getServer(node, questMeta);
      try {
        node._vsCache = await this.expandValueSet(node._answerValueSet, server);
      } catch (err) {
        node._vsCache = [];
        const isCors = err instanceof TypeError && err.message.includes('fetch');
        const msg = isCors
          ? `Network error (possible CORS restriction — the server may not allow browser requests): ${err.message}`
          : err.message;
        failures.push({ node, vsUrl: node._answerValueSet, server, error: msg });
      }
    }
    for (const node of unitNodes) {
      const server = this.getServer(node, questMeta);
      try {
        node._unitVsCache = await this.expandValueSet(node._unitValueSet, server);
      } catch (err) {
        node._unitVsCache = [];
        const isCors = err instanceof TypeError && err.message.includes('fetch');
        const msg = isCors
          ? `Network error (possible CORS restriction — the server may not allow browser requests): ${err.message}`
          : err.message;
        failures.push({ node, vsUrl: node._unitValueSet, server, error: msg });
      }
    }
    return failures;
  }
}

export const terminologyService = new TerminologyService();
