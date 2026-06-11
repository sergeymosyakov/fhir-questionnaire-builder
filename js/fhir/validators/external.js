// ── ExternalValidator ─────────────────────────────────────────────────────────
// Sends a Questionnaire to a remote FHIR server's $validate operation and
// converts the returned OperationOutcome into the common Issue[] format.
//
// Retries up to `retries` times on network errors before giving up.
// Requires a CORS proxy when called from the browser (reads corsProxyUrl from
// /config.json via the shared _loadConfig helper).

import { Validator } from './base.js';
/** Thrown for non-retryable validation failures (e.g. HTTP 413 / 4xx). */
class ValidatorFatalError extends Error {}
const CORS_PROXY_KEY = 'corsProxyUrl';
let _proxyUrl = '';
let _proxyLoaded = false;
let _proxyPromise = null;

function _loadProxy() {
  if (_proxyLoaded) return Promise.resolve();
  if (_proxyPromise) return _proxyPromise;
  _proxyPromise = fetch('./config.json')
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
    this.enabled  = false; // off by default; toggled via VALIDATOR_TOGGLE event
    this._name    = name;
    this._url     = url.replace(/\/$/, '');
    this._retries = retries;
  }

  get id()   { return 'external'; }
  get name() { return this._name; }
  get type() { return 'external'; }

  async _run(questJson) {
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

        // 413 Payload Too Large: the questionnaire exceeds the server's request
        // size limit. Retrying will not help — surface a clear, actionable error.
        if (resp.status === 413) {
          const sizeKb = Math.round(body.length / 1024);
          throw new ValidatorFatalError(
            `Questionnaire is too large (${sizeKb} KB) for the external validator ` +
            `(${this._name}). The public server rejected it with HTTP 413. ` +
            `Use the built-in validator, or point to a self-hosted FHIR server with a higher request limit.`,
          );
        }

        if (!resp.ok) {
          // Other client errors (4xx) are not retryable; server errors (5xx) are.
          const text = await resp.text().catch(() => '');
          const snippet = text.trim().slice(0, 200);
          const msg = `External validator returned HTTP ${resp.status} ${resp.statusText}${snippet ? ` — ${snippet}` : ''}`;
          if (resp.status >= 400 && resp.status < 500) throw new ValidatorFatalError(msg);
          throw new Error(msg);
        }

        const outcome = await resp.json();
        return _parseOutcome(outcome, questJson);
      } catch (err) {
        // Fatal errors (413, other 4xx) are not retryable — rethrow immediately.
        if (err instanceof ValidatorFatalError) throw err;
        lastErr = err;
        if (attempt < this._retries) {
          await new Promise(r => setTimeout(r, 800 * attempt));
        }
      }
    }
    throw new Error(`External validation failed after ${this._retries} attempts: ${lastErr?.message || lastErr}`);
  }
}
