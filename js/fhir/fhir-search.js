// ── FHIR resource search utility ─────────────────────────────────────────────
// Shared by ReferenceNode (preview) and SdcPopulateModal.
// Requires fhirBaseUrl and optional corsProxyUrl from serverConfig.
import { serverConfig, CONFIG_KEYS } from './server-config.js';

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
export function proxiedUrl(url) {
  const proxy = (serverConfig.get(CONFIG_KEYS.CORS_PROXY) || '').replace(/\/$/, '');
  if (!proxy) return url;
  try {
    const { hostname } = new URL(url);
    if (CORS_ENABLED_HOSTS.includes(hostname)) return url;
  } catch { /* invalid URL */ }
  return `${proxy}?url=${encodeURIComponent(url)}`;
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
export async function searchFhir(resourceType, query, count = 10) {
  const base = (serverConfig.get(CONFIG_KEYS.FHIR_BASE) || '').replace(/\/$/, '');
  if (!base || !resourceType || !query.trim()) return [];

  const params = new URLSearchParams({ _count: String(count) });
  params.set(_searchParam(resourceType), query);

  const url = proxiedUrl(`${base}/${resourceType}?${params}`);
  const res = await fetch(url, {
    headers: { Accept: 'application/fhir+json' },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const bundle = await res.json();
  return (bundle.entry || [])
    .map(e => ({ id: e.resource?.id || '', display: displayName(e.resource) }))
    .filter(r => r.id);
}
