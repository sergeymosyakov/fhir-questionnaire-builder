// ── ExternalValidator ─────────────────────────────────────────────────────────
// Sends a Questionnaire to a remote FHIR server's $validate operation and
// converts the returned OperationOutcome into the common Issue[] format.
//
// Retries up to `retries` times on network errors before giving up.
// Requires a CORS proxy when called from the browser (reads corsProxyUrl from
// /config.json via the shared _loadConfig helper).

import { Validator } from './base.js';

const CORS_PROXY_KEY = '_corsProxyUrl';
let _proxyUrl = '';
let _proxyLoaded = false;
let _proxyPromise = null;

function _loadProxy() {
  if (_proxyLoaded) return Promise.resolve();
  if (_proxyPromise) return _proxyPromise;
  _proxyPromise = fetch('/config.json')
    .then(r => r.json())
    .then(cfg => { _proxyUrl = (cfg[CORS_PROXY_KEY] || '').replace(/\/$/, ''); })
    .catch(() => {})
    .finally(() => { _proxyLoaded = true; });
  return _proxyPromise;
}

function _proxied(url) {
  return _proxyUrl ? `${_proxyUrl}?url=${encodeURIComponent(url)}` : url;
}

/** Parse OperationOutcome issues into the common Issue[] format. */
function _parseOutcome(outcome, questJson) {
  const issues = [];
  const ooIssues = outcome?.issue || [];

  for (const oi of ooIssues) {
    const severity = oi.severity === 'error' || oi.severity === 'fatal' ? 'error' : 'warning';
    const message  = oi.diagnostics || oi.details?.text || oi.details?.coding?.[0]?.display || 'Unknown issue';

    // Try to map expression path like "Questionnaire.item[2].answerOption[0]"
    // back to a node linkId by counting item[] indices in the tree.
    let nodeId = '(external)';
    const expr = oi.expression?.[0] || oi.location?.[0] || '';
    const match = expr.match(/item\[(\d+)\]/g);
    if (match && questJson?.item) {
      let items = questJson.item;
      let node  = null;
      for (const seg of match) {
        const idx = parseInt(seg.match(/\d+/)[0], 10);
        node  = items?.[idx];
        items = node?.item || [];
      }
      if (node?.linkId) nodeId = node.linkId;
    }

    issues.push({ severity, nodeId, message });
  }
  return issues;
}

export class ExternalValidator extends Validator {
  /**
   * @param {{ name: string, url: string, retries?: number }} cfg
   */
  constructor({ name, url, retries = 3 }) {
    super();
    this._name    = name;
    this._url     = url.replace(/\/$/, '');
    this._retries = retries;
  }

  get name() { return this._name; }
  get type() { return 'external'; }

  async run(questJson) {
    await _loadProxy();

    const endpoint = _proxied(`${this._url}/Questionnaire/$validate`);
    const body     = JSON.stringify(questJson);

    let lastErr;
    for (let attempt = 1; attempt <= this._retries; attempt++) {
      try {
        const resp = await fetch(endpoint, {
          method:  'POST',
          headers: { 'Content-Type': 'application/fhir+json', 'Accept': 'application/fhir+json' },
          body,
        });

        const outcome = await resp.json();
        return _parseOutcome(outcome, questJson);
      } catch (err) {
        lastErr = err;
        if (attempt < this._retries) {
          await new Promise(r => setTimeout(r, 800 * attempt));
        }
      }
    }
    throw new Error(`External validation failed after ${this._retries} attempts: ${lastErr?.message || lastErr}`);
  }
}
