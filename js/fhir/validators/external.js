// ── ExternalValidator ─────────────────────────────────────────────────────────
// Sends a Questionnaire to a remote FHIR server's $validate operation and
// converts the returned OperationOutcome into the common Issue[] format.
//
// Retries up to `retries` times on network errors before giving up.
// Requires a CORS proxy when called from the browser (reads corsProxyUrl from
// /config.json via the shared _loadConfig helper).

import { Validator } from './base.js';
import { BUILDER_VERSION_EXTENSION_URL } from '../format-registry.js';
import { AppEvents, EventState } from '../../events.js';
import { serverConfig, CONFIG_KEYS } from '../server-config.js';
/** Thrown for non-retryable validation failures (e.g. HTTP 413 / 4xx). */
class ValidatorFatalError extends Error {}

/** Map a builder version id to the matching HAPI public-server base path. */
const _HAPI_BASE_BY_VERSION = { R4: 'baseR4', R4B: 'baseR4B', R5: 'baseR5' };

function _proxied(url) {
  const proxy = (serverConfig.get(CONFIG_KEYS.CORS_PROXY) || '').replace(/\/$/, '');
  return proxy ? `${proxy}?url=${encodeURIComponent(url)}` : url;
}

/** Turn an error response body into a readable one-line message.
 *  Parses a FHIR OperationOutcome (issue[].diagnostics / details.text) when
 *  present; otherwise falls back to a trimmed raw snippet. */
function _outcomeMessage(text) {
  const raw = (text || '').trim();
  try {
    const oo = JSON.parse(raw);
    if (oo?.resourceType === 'OperationOutcome' && Array.isArray(oo.issue)) {
      const parts = oo.issue
        .map(i => i.diagnostics || i.details?.text || i.details?.coding?.[0]?.display || i.code)
        .filter(Boolean);
      if (parts.length) return parts.join('; ');
    }
  } catch { /* not JSON — fall through to raw snippet */ }
  return raw.slice(0, 200);
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
   * @param {{ name: string, url: string, retries?: number, getFhirTarget?: () => string }} cfg
   * getFhirTarget is optional — used only in tests; production reads from EventState.
   */
  constructor({ name, url, retries = 3, getFhirTarget }) {
    super();
    this.enabled  = false; // off by default; toggled via VALIDATOR_TOGGLE event
    this._name    = name;
    this._url     = url.replace(/\/$/, '');
    this._retries = retries;
    this._getFhirTargetOverride = getFhirTarget || null;
  }

  _getFhirTarget() {
    if (this._getFhirTargetOverride) return this._getFhirTargetOverride();
    return EventState.get(AppEvents.FHIR_VERSION_CHANGED)?.versionId
        ?? EventState.get(AppEvents.APP_CONTEXT_READY)?.questDoc?.meta?.fhirTarget
        ?? 'R4';
  }

  get id()   { return 'external'; }
  get name() {
    const target = this._getFhirTarget();
    return target ? `${this._name} ${target}` : this._name;
  }
  get type() { return 'external'; }

  /** Build the version-specific base URL for the active FHIR target. */
  _baseUrl() {
    const target = this._getFhirTarget();
    const base = _HAPI_BASE_BY_VERSION[target];
    // Swap a trailing /baseRxx segment for the target version's base; if the
    // configured URL has no recognised base segment, use it unchanged.
    if (base && /\/baseR[0-9A-Z]+$/.test(this._url)) {
      return this._url.replace(/\/baseR[0-9A-Z]+$/, `/${base}`);
    }
    return this._url;
  }

  async _run(questJson) {
    await serverConfig.ready();

    // Never POST a body that is not a valid Questionnaire. Some callers invoke
    // validation without a questJson (e.g. the ValueSet-expansion report); that
    // would serialise `{}` and get a confusing HTTP 400 "missing resourceType".
    if (!questJson || questJson.resourceType !== 'Questionnaire') return [];

    const endpoint = _proxied(`${this._baseUrl()}/Questionnaire/$validate`);
    // Strip the builder-target-version extension — it is a builder-internal
    // round-trip marker that the FHIR server does not recognise (would produce
    // a spurious "Unknown extension" warning). The exported file keeps it.
    const payload = { ...questJson };
    if (Array.isArray(payload.extension)) {
      const filtered = payload.extension.filter(e => e?.url !== BUILDER_VERSION_EXTENSION_URL);
      if (filtered.length) payload.extension = filtered;
      else delete payload.extension;
    }
    const body = JSON.stringify(payload);

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
          const snippet = _outcomeMessage(text);
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
