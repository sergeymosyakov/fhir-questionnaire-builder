// The one place that decides whether a request goes through the configured CORS proxy (`?url=` forwarder).

// Public servers that already send CORS headers: a proxy hop adds nothing there.
export const CORS_ENABLED_HOSTS = [
  'hapi.fhir.org',
  'r4.smarthealthit.org',
  'launch.smarthealthit.org',
  'test.ahdis.ch',        // Matchbox SDC server
];

/** @param {string} url @param {string} [proxy] proxy base URL; empty means no proxy @returns {string} */
export function proxyUrl(url, proxy) {
  const base = (proxy || '').replace(/\/$/, '');
  if (!base) return url;
  try {
    if (CORS_ENABLED_HOSTS.includes(new URL(url).hostname)) return url;
  } catch { /* invalid URL: let the caller's fetch report it */ }
  return `${base}?url=${encodeURIComponent(url)}`;
}
