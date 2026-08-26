// ── OAuth callback relay ───────────────────────────────────────────────────────
// Runs only inside the login popup after the IdP redirects back here. Relays
// the result to the opener via postMessage and closes itself. See oauth-client.js.
const params = new URLSearchParams(window.location.search);

if (window.opener) {
  window.opener.postMessage({
    source: 'fhirqb-oauth-callback',
    code:   params.get('code'),
    state:  params.get('state'),
    error:  params.get('error_description') || params.get('error') || null,
  }, window.location.origin);
}
window.close();
