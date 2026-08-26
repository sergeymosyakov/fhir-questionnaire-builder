// ── FHIR debug login (client_credentials) ────────────────────────────────────
// Interim local-testing bridge — issue #63. NOT the production OAuth flow
// (see docs/FHIR-SERVER-AUTH-PLAN.md). Gets a Bearer token via client_credentials
// and stores it where fhir-search.js / sdc-populate.js read it (getFhirAuthHeader).
import { serverConfig, CONFIG_KEYS, LocalStorageConfigProvider } from '../fhir/server-config.js';
import { showError, showInfo } from '../ui/toast.js';

serverConfig.register(new LocalStorageConfigProvider());

// Convenience-only fields (Token URL / Client ID / Client Secret) — separate
// from CONFIG_KEYS since no production code reads them, just this page.
const LS_PREFIX = 'fhirqb.debugLogin.';

function _el(id) { return document.getElementById(id); }

function _restoreFields() {
  _el('tokenUrl').value     = localStorage.getItem(LS_PREFIX + 'tokenUrl') || '';
  _el('clientId').value     = localStorage.getItem(LS_PREFIX + 'clientId') || '';
  _el('clientSecret').value = localStorage.getItem(LS_PREFIX + 'clientSecret') || '';
}

function _rememberFields() {
  localStorage.setItem(LS_PREFIX + 'tokenUrl', _el('tokenUrl').value.trim());
  localStorage.setItem(LS_PREFIX + 'clientId', _el('clientId').value.trim());
  localStorage.setItem(LS_PREFIX + 'clientSecret', _el('clientSecret').value);
}

function _renderStatus() {
  const token     = serverConfig.get(CONFIG_KEYS.FHIR_ACCESS_TOKEN);
  const expiresAt = Number(serverConfig.get(CONFIG_KEYS.FHIR_TOKEN_EXPIRES_AT));
  const statusEl  = _el('status');
  if (!token || !expiresAt || Date.now() >= expiresAt) {
    statusEl.textContent = 'No active token.';
    statusEl.className = 'dev-fhir-login-status dev-fhir-login-status--none';
    return;
  }
  const mins = Math.max(0, Math.round((expiresAt - Date.now()) / 60000));
  statusEl.textContent = `Token active — expires in ~${mins} min.`;
  statusEl.className = 'dev-fhir-login-status dev-fhir-login-status--ok';
}

async function _getToken() {
  const tokenUrl     = _el('tokenUrl').value.trim();
  const clientId     = _el('clientId').value.trim();
  const clientSecret = _el('clientSecret').value;
  if (!tokenUrl || !clientId || !clientSecret) {
    showError('Token URL, Client ID and Client Secret are all required.');
    return;
  }
  _rememberFields();

  const btn = _el('getTokenBtn');
  btn.disabled = true;
  try {
    const res = await fetch(tokenUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}${text ? ' — ' + text.substring(0, 150) : ''}`);
    }
    const data = await res.json();
    if (!data.access_token) throw new Error('Response did not contain an access_token.');

    serverConfig.set(CONFIG_KEYS.FHIR_ACCESS_TOKEN, data.access_token);
    serverConfig.set(CONFIG_KEYS.FHIR_TOKEN_EXPIRES_AT, String(Date.now() + (Number(data.expires_in) || 3600) * 1000));
    showInfo('Token acquired.');
    _renderStatus();
  } catch (err) {
    showError(`Token request failed: ${err.message}`);
  } finally {
    btn.disabled = false;
  }
}

function _forgetToken() {
  serverConfig.set(CONFIG_KEYS.FHIR_ACCESS_TOKEN, null);
  serverConfig.set(CONFIG_KEYS.FHIR_TOKEN_EXPIRES_AT, null);
  showInfo('Token cleared.');
  _renderStatus();
}

_restoreFields();
_renderStatus();
_el('getTokenBtn').addEventListener('click', _getToken);
_el('forgetTokenBtn').addEventListener('click', _forgetToken);
