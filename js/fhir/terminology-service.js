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

const EXPAND_COUNT  = 500;
const FETCH_TIMEOUT = 15_000;
const TEST_TIMEOUT  = 8_000;

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
    const res = await fetch(reqUrl, {
      headers: { Accept: 'application/fhir+json' },
      signal:  AbortSignal.timeout(FETCH_TIMEOUT),
    });
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
  async testServer(serverUrl) {
    await _loadConfig();
    const base = (serverUrl || '').trim().replace(/\/$/, '');
    if (!base) return { ok: false, message: 'No URL provided' };
    try {
      const res = await fetch(this._proxyUrl(`${base}/metadata`), {
        headers: { Accept: 'application/fhir+json' },
        signal:  AbortSignal.timeout(TEST_TIMEOUT),
      });
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
