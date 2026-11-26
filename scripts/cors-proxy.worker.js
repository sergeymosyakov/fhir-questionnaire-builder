/**
 * Cloudflare Worker — CORS proxy for FHIR terminology + limited resource
 * requests (Patient search, $populate).
 *
 * Deploy: wrangler (wrangler.toml, deploy-cors-proxy.yml) — it bundles ./cors-proxy-rules.js.
 * Usage:  GET https://<your-worker>.workers.dev/?url=<encoded-fhir-url>
 *
 * Only proxies HTTPS requests whose path ends in one of ALLOWED_PATHS (the
 * target host itself is not restricted, since users point at their own
 * arbitrary FHIR servers) and only for browsers on ALLOWED_ORIGINS, so other
 * sites can't ride this worker through a visitor's browser (the Origin check
 * is a browser-only guard: a script can send any Origin). Forwards an incoming
 * Authorization header upstream as-is (for OAuth-protected FHIR servers,
 * issue #63) — never logged, never stored.
 */

import { isAllowedTarget, MAX_BODY_BYTES, isAllowedOrigin } from './cors-proxy-rules.js';

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin');

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    if (!isAllowedOrigin(origin)) return new Response('Origin not allowed', { status: 403 });
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
    const pathOk = isAllowedTarget(targetUrl);
    if (!pathOk) {
      return new Response('Target path not allowed', { status: 403, headers: corsHeaders(origin) });
    }

    try {
      const isBodyMethod = request.method !== 'GET' && request.method !== 'HEAD';
      const body0 = isBodyMethod ? await request.arrayBuffer() : undefined; // measured, not trusted from Content-Length
      if (body0 && body0.byteLength > MAX_BODY_BYTES) {
        return new Response('Request body too large', { status: 413, headers: corsHeaders(origin) });
      }
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
        body: body0,
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
  const allowed = isAllowedOrigin(origin);
  return {
    ...(allowed ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept, Content-Type, Authorization',
    Vary: 'Origin',
  };
}
