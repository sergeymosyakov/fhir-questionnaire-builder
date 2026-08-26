// ── FHIR debug login (client_credentials, fresh token per request) ───────────
// Interim local-testing bridge — issue #63. NOT the production OAuth flow
// (see docs/FHIR-SERVER-AUTH-PLAN.md). Saves client_credentials to
// sessionStorage; js/fhir/server-config.js's getFhirAuthHeader() fetches a
// brand-new token from them on every FHIR call (some partner servers issue
// single-use tokens — a cached/reused one gets rejected as "already used").
import { showError, showInfo } from '../ui/toast.js';

const SS_PREFIX = 'fhirqb.debugLogin.';
const FIELDS = ['tokenUrl', 'clientId', 'clientSecret'];

function _el(id) { return document.getElementById(id); }

function _isSaved() {
  return FIELDS.every(f => sessionStorage.getItem(SS_PREFIX + f));
}

function _restoreFields() {
  FIELDS.forEach(f => { _el(f).value = sessionStorage.getItem(SS_PREFIX + f) || ''; });
}

function _renderStatus() {
  const statusEl = _el('status');
  if (_isSaved()) {
    statusEl.textContent = 'Saved — a fresh token is requested automatically for every FHIR request.';
    statusEl.className = 'dev-fhir-login-status dev-fhir-login-status--ok';
  } else {
    statusEl.textContent = 'Not configured.';
    statusEl.className = 'dev-fhir-login-status dev-fhir-login-status--none';
  }
}

function _fieldValues() {
  return {
    tokenUrl:     _el('tokenUrl').value.trim(),
    clientId:     _el('clientId').value.trim(),
    clientSecret: _el('clientSecret').value, // don't trim a secret
  };
}

function _save() {
  const { tokenUrl, clientId, clientSecret } = _fieldValues();
  if (!tokenUrl || !clientId || !clientSecret) {
    showError('Token URL, Client ID and Client Secret are all required.');
    return;
  }
  sessionStorage.setItem(SS_PREFIX + 'tokenUrl', tokenUrl);
  sessionStorage.setItem(SS_PREFIX + 'clientId', clientId);
  sessionStorage.setItem(SS_PREFIX + 'clientSecret', clientSecret);
  showInfo('Saved.');
  _renderStatus();
}

async function _test() {
  const { tokenUrl, clientId, clientSecret } = _fieldValues();
  if (!tokenUrl || !clientId || !clientSecret) {
    showError('Token URL, Client ID and Client Secret are all required.');
    return;
  }
  const btn = _el('testBtn');
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
    // Verify-only — this token is not stored or reused (see file header).
    showInfo('Credentials work — token endpoint returned an access_token.');
  } catch (err) {
    showError(`Test failed: ${err.message}`);
  } finally {
    btn.disabled = false;
  }
}

function _reset() {
  FIELDS.forEach(f => { sessionStorage.removeItem(SS_PREFIX + f); _el(f).value = ''; });
  showInfo('Reset.');
  _renderStatus();
}

_restoreFields();
_renderStatus();
_el('saveBtn').addEventListener('click', _save);
_el('testBtn').addEventListener('click', _test);
_el('resetBtn').addEventListener('click', _reset);
