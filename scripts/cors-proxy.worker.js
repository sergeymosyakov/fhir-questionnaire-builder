/**
 * Cloudflare Worker — CORS proxy for FHIR terminology server requests.
 *
 * Deploy: https://dash.cloudflare.com → Workers → Create → paste this file.
 * Usage:  GET https://<your-worker>.workers.dev/?url=<encoded-fhir-url>
 *
 * Only proxies HTTPS requests to FHIR server paths (/$expand, /metadata,
 * /$validate). Refuses to proxy arbitrary URLs to prevent misuse.
 */

const ALLOWED_PATHS = ['/ValueSet/$expand', '/metadata', '/ValueSet/', '/Questionnaire/$validate'];

export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    const incoming = new URL(request.url);
    const target = incoming.searchParams.get('url');

    if (!target) {
      return new Response('Missing ?url= parameter', { status: 400, headers: corsHeaders() });
    }

    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch {
      return new Response('Invalid URL', { status: 400, headers: corsHeaders() });
    }

    // Security: only allow HTTPS and known FHIR paths
    if (targetUrl.protocol !== 'https:') {
      return new Response('Only HTTPS targets allowed', { status: 403, headers: corsHeaders() });
    }
    const pathOk = ALLOWED_PATHS.some(p => targetUrl.pathname.includes(p));
    if (!pathOk) {
      return new Response('Target path not allowed', { status: 403, headers: corsHeaders() });
    }

    try {
      const isBodyMethod = request.method !== 'GET' && request.method !== 'HEAD';
      const upstream = await fetch(targetUrl.toString(), {
        method:  request.method,
        headers: {
          Accept: 'application/fhir+json',
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
        headers: { ...corsHeaders(), 'Content-Type': contentType },
      });
    } catch (err) {
      return new Response('Upstream error: ' + err.message, { status: 502, headers: corsHeaders() });
    }
  },
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept, Content-Type',
  };
}
