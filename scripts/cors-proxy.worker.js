/**
 * Cloudflare Worker — CORS proxy for FHIR terminology + limited resource
 * requests (Patient search, $populate).
 *
 * Deploy: https://dash.cloudflare.com → Workers → Create → paste this file.
 * Usage:  GET https://<your-worker>.workers.dev/?url=<encoded-fhir-url>
 *
 * Only proxies HTTPS requests whose path matches ALLOWED_PATHS (substring
 * match, not a full server allowlist — the target host itself is not
 * restricted, since users point at their own arbitrary FHIR servers).
 * Access-Control-Allow-Origin is only reflected for ALLOWED_ORIGINS, so other
 * sites can't ride this worker as an open relay. Forwards an incoming
 * Authorization header upstream as-is (for OAuth-protected FHIR servers,
 * issue #63) — never logged, never stored.
 */

const ALLOWED_PATHS = ['/ValueSet/$expand', '/metadata', '/ValueSet/', '/Questionnaire/$validate', '/Questionnaire/$populate', '/Patient'];
const ALLOWED_ORIGINS = [/^https:\/\/fhirbuilder\.com$/, /^https:\/\/sergeymosyakov\.github\.io$/, /^https?:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/];

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin');

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    const incoming = new URL(request.url);
    const target = incoming.searchParams.get('url');

    if (!target) {
      return new Response('Missing ?url= parameter', { status: 400, headers: corsHeaders(origin) });
    }

    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch {
      return new Response('Invalid URL', { status: 400, headers: corsHeaders(origin) });
    }

    // Security: only allow HTTPS and known FHIR paths
    if (targetUrl.protocol !== 'https:') {
      return new Response('Only HTTPS targets allowed', { status: 403, headers: corsHeaders(origin) });
    }
    const pathOk = ALLOWED_PATHS.some(p => targetUrl.pathname.includes(p));
    if (!pathOk) {
      return new Response('Target path not allowed', { status: 403, headers: corsHeaders(origin) });
    }

    try {
      const isBodyMethod = request.method !== 'GET' && request.method !== 'HEAD';
      const authHeader = request.headers.get('Authorization');
      const upstream = await fetch(targetUrl.toString(), {
        method:  request.method,
        headers: {
          Accept: 'application/fhir+json',
          ...(authHeader ? { Authorization: authHeader } : {}),
          ...(isBodyMethod
            ? { 'Content-Type': request.headers.get('Content-Type') || 'application/fhir+json' }
            : {}),
        },
        body: isBodyMethod ? request.body : undefined,
      });

      const body        = await upstream.arrayBuffer();
      const contentType = upstream.headers.get('Content-Type') || 'application/fhir+json';

      return new Response(body, {
        status:  upstream.status,
        headers: { ...corsHeaders(origin), 'Content-Type': contentType },
      });
    } catch (err) {
      return new Response('Upstream error: ' + err.message, { status: 502, headers: corsHeaders(origin) });
    }
  },
};

// Only allowlisted origins get Access-Control-Allow-Origin reflected back.
function corsHeaders(origin) {
  const allowed = origin && ALLOWED_ORIGINS.some(re => re.test(origin));
  return {
    ...(allowed ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept, Content-Type, Authorization',
    Vary: 'Origin',
  };
}
