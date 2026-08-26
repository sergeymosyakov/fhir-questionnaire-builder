// ── FHIR resource search utility ─────────────────────────────────────────────
// Shared by ReferenceNode (preview) and SdcPopulateModal.
// Requires fhirBaseUrl and optional corsProxyUrl from serverConfig.
import { serverConfig, CONFIG_KEYS, getFhirAuthHeader } from './server-config.js';
import { getValidAccessToken, refreshAccessToken, clearStoredToken } from './oauth-client.js';

const CORS_ENABLED_HOSTS = [
  'hapi.fhir.org',
  'r4.smarthealthit.org',
  'launch.smarthealthit.org',
  'test.ahdis.ch',        // Matchbox SDC server
  'terminology.hl7.org',  // HL7 terminology server
];

/**
 * Proxy a URL through corsProxyUrl if configured and needed.
 * Skips proxy for known CORS-enabled servers.
 * @param {string} url
 * @returns {string}
 */
export function proxiedUrl(url, corsProxy) {
  const proxy = ((corsProxy ?? serverConfig.get(CONFIG_KEYS.CORS_PROXY)) || '').replace(/\/$/, '');
  if (!proxy) return url;
  try {
    const { hostname } = new URL(url);
    if (CORS_ENABLED_HOSTS.includes(hostname)) return url;
  } catch { /* invalid URL */ }
  return `${proxy}?url=${encodeURIComponent(url)}`;
}

/**
 * Auth header for a FHIR request — real per-server OAuth token (issue #63)
 * if logged in, else the interim debug bridge (fetches a fresh token per
 * call — see getFhirAuthHeader); empty for known public demo servers
 * (neither is meant for them).
 * @param {string} url
 * @param {'FHIR_BASE'|'SDC_SERVER'} [serverKey]
 * @returns {Promise<{Authorization?: string}>}
 */
export async function fhirAuthHeaderFor(url, serverKey) {
  try {
    if (CORS_ENABLED_HOSTS.includes(new URL(url).hostname)) return {};
  } catch { /* invalid URL, fall through */ }
  const oauthToken = serverKey && getValidAccessToken(serverKey);
  if (oauthToken) return { Authorization: `Bearer ${oauthToken}` };
  return getFhirAuthHeader();
}

/**
 * Refresh serverKey's OAuth token (if any) after a 401 and return a fresh
 * auth header for a retry. Clears the token if the refresh itself fails, so
 * the next feature use re-triggers a lazy login.
 * @param {string} url
 * @param {'FHIR_BASE'|'SDC_SERVER'} [serverKey]
 */
export async function reauthHeaderFor(url, serverKey) {
  if (serverKey) {
    try { await refreshAccessToken(serverKey); }
    catch { clearStoredToken(serverKey); }
  }
  return fhirAuthHeaderFor(url, serverKey);
}

/**
 * Extract a human-readable display name from a FHIR resource.
 * @param {object} resource
 * @returns {string}
 */
export function displayName(resource) {
  const type = resource.resourceType;
  if (['Patient', 'Practitioner', 'RelatedPerson', 'Person'].includes(type)) {
    const name = resource.name?.[0];
    if (name) {
      const family = name.family || '';
      const given  = (name.given || []).join(' ');
      return [family, given].filter(Boolean).join(', ') || name.text || resource.id;
    }
  }
  if (['Organization', 'Location', 'HealthcareService'].includes(type)) return resource.name || resource.id;
  if (['Encounter', 'EpisodeOfCare'].includes(type)) {
    const patName = resource.subject?.display || resource.patient?.display || '';
    const status  = resource.status ? `[${resource.status}]` : '';
    const date    = resource.period?.start?.slice(0, 10) || '';
    return [patName, date, status].filter(Boolean).join(' ') || resource.id;
  }
  if (['Condition', 'Observation', 'Procedure'].includes(type)) {
    const code    = resource.code?.coding?.[0]?.display || resource.code?.text || '';
    const patient = resource.subject?.display || '';
    return [code, patient].filter(Boolean).join(' — ') || resource.id;
  }
  return resource.name || resource.title || resource.id;
}

/** Search parameter name by resource type. */
function _searchParam(resourceType) {
  if (['Patient', 'Practitioner', 'RelatedPerson', 'Person'].includes(resourceType)) return 'name';
  if (['Organization', 'Location', 'HealthcareService', 'Medication'].includes(resourceType)) return 'name';
  if (['Encounter', 'EpisodeOfCare', 'Condition', 'Observation', 'Procedure',
       'DiagnosticReport', 'MedicationRequest', 'ServiceRequest'].includes(resourceType)) return 'patient.name';
  if (['Medication', 'Substance'].includes(resourceType)) return 'code';
  return '_id';
}

/**
 * Search a FHIR server for resources of a given type matching a query string.
 * @param {string} resourceType - FHIR resource type (e.g. 'Patient')
 * @param {string} query        - Search text
 * @param {number} [count=10]   - Max results
 * @returns {Promise<Array<{id: string, display: string}>>}
 */
export async function searchFhir(resourceType, query, count = 10, opts = {}) {
  const base = ((opts.fhirBase ?? serverConfig.get(CONFIG_KEYS.FHIR_BASE)) || '').replace(/\/$/, '');
  if (!base || !resourceType || !query.trim()) return [];

  const params = new URLSearchParams({ _count: String(count) });
  params.set(_searchParam(resourceType), query);

  const targetUrl = `${base}/${resourceType}?${params}`;
  const url = proxiedUrl(targetUrl, opts.corsProxy);
  let res = await fetch(url, {
    headers: { Accept: 'application/fhir+json', ...await fhirAuthHeaderFor(targetUrl, 'FHIR_BASE') },
    signal: AbortSignal.timeout(6000),
  });
  if (res.status === 401) {
    res = await fetch(url, {
      headers: { Accept: 'application/fhir+json', ...await reauthHeaderFor(targetUrl, 'FHIR_BASE') },
      signal: AbortSignal.timeout(6000),
    });
  }
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const oo = await res.json();
      const diag = oo?.issue?.[0]?.diagnostics;
      if (diag) msg += ' — ' + diag.substring(0, 120);
    } catch { /* keep default */ }
    throw new Error(msg);
  }

  const bundle = await res.json();
  return (bundle.entry || [])
    .map(e => ({ id: e.resource?.id || '', display: displayName(e.resource) }))
    .filter(r => r.id);
}
