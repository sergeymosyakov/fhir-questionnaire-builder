// ── TerminologyService ────────────────────────────────────────────────────────
// Singleton service for all FHIR terminology server interactions.
// Handles ValueSet/$expand and server health checks (GET /metadata).
//
// Usage:
//   terminologyService.getServer(node, questMeta)        → string (server URL)
//   terminologyService.expandValueSet(vsUrl, serverUrl)  → Promise<option[]>
//   terminologyService.testServer(serverUrl)             → Promise<{ok, message}>
//   terminologyService.expandAll(treeNodes, questMeta)   → Promise<failure[]>

export const DEFAULT_TERMINOLOGY_SERVER = 'https://tx.fhir.org/r4';

// CORS proxy URL is read from /config.json at runtime (key: corsProxyUrl).
// See scripts/cors-proxy.worker.js for the Cloudflare Worker implementation.
let _corsProxyUrl = '';
let _configLoaded = false;
let _configPromise = null;

function _loadConfig() {
  if (_configLoaded) return Promise.resolve();
  if (_configPromise) return _configPromise;
  _configPromise = fetch('/config.json')
    .then(r => r.json())
    .then(cfg => { _corsProxyUrl = (cfg.corsProxyUrl || '').replace(/\/$/, ''); })
    .catch(() => {})
    .finally(() => { _configLoaded = true; });
  return _configPromise;
}

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
    if (node._answerValueSet && !node._answerValueSet.startsWith('#')) out.push(node);
    if (node.children?.length) _collectExternalVsNodes(node.children, out);
  }
  return out;
}

class TerminologyService {
  /** Wrap a target URL through the CORS proxy if configured. */
  _proxyUrl(url) {
    return _corsProxyUrl ? `${_corsProxyUrl}?url=${encodeURIComponent(url)}` : url;
  }

  /** Resolve the server URL for a node using the full fallback chain. */
  getServer(node, questMeta) {
    const url = node?._preferredTermServer
      || questMeta?.preferredTermServer
      || DEFAULT_TERMINOLOGY_SERVER;
    return url.replace(/\/$/, '');
  }

  /**
   * Expand a ValueSet from a FHIR terminology server.
   * @param {string} vsUrl      Canonical ValueSet URL to expand.
   * @param {string} serverUrl  Base URL of the FHIR terminology server.
   * @returns {Promise<Array<{code: string, display: string, system: string}>>}
   */
  async expandValueSet(vsUrl, serverUrl) {
    await _loadConfig();
    const base   = (serverUrl || DEFAULT_TERMINOLOGY_SERVER).replace(/\/$/, '');
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
   * Test whether a URL points to a reachable FHIR terminology server.
   * Fetches /metadata and checks for a CapabilityStatement response.
   * @returns {Promise<{ok: boolean, message: string}>}
   */
  async testServer(serverUrl, { onRetry } = {}) {
    await _loadConfig();
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
      const codes = await this.expandValueSet(vsUrl, serverUrl || DEFAULT_TERMINOLOGY_SERVER);
      return { ok: true, message: `${codes.length} code${codes.length !== 1 ? 's' : ''}`, count: codes.length };
    } catch (err) {
      return { ok: false, message: err.message };
    }
  }

  /**
   * Expand all external answerValueSets in the tree and cache results on each node.
   * Results are stored in node._vsCache (array of options, empty on failure).
   * @param {Array}  treeNodes  Root nodes of the questionnaire tree.
   * @param {object} questMeta  Reactive questMeta object (for questionnaire-level server).
   * @returns {Promise<Array<{node, vsUrl, server, error}>>} List of failures (empty = all OK).
   */
  async expandAll(treeNodes, questMeta) {
    const nodes = _collectExternalVsNodes(treeNodes);
    if (!nodes.length) return [];
    const failures = [];
    await Promise.allSettled(nodes.map(async node => {
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
    }));
    return failures;
  }
}

export const terminologyService = new TerminologyService();
