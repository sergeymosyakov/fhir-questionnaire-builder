// ── OAuth2 Authorization Code + PKCE client (per-server) ──────────────────────
// Real popup-based login for FHIR servers configured in Settings — issue #63,
// design in docs/FHIR-SERVER-AUTH-PLAN.md. Scope: 'FHIR_BASE' | 'SDC_SERVER'.
//
// Tokens are stored in plain localStorage under their own prefix — NEVER via
// serverConfig (which can sync to Supabase cloud). Only the non-secret OAuth
// config (authorize/token URL, client id, scope) lives in serverConfig.
import { serverConfig, CONFIG_KEYS } from './server-config.js';

const TOKEN_LS_PREFIX = 'fhirqb.oauthToken.';
const STATE_SS_PREFIX = 'fhirqb.oauthState.';
// Extensionless — GitHub Pages (and the local `serve` dev server) resolve this
// straight to oauth-callback.html; requesting the `.html` path instead gets
// 301-redirected by `serve`'s clean-URL rewriting, which drops the query
// string (code/state) in the process.
const CALLBACK_PATH   = 'oauth-callback';

const SERVER_OAUTH_CONFIG_KEYS = {
  FHIR_BASE: {
    authorizeUrl: CONFIG_KEYS.FHIR_BASE_OAUTH_AUTHORIZE_URL,
    tokenUrl:     CONFIG_KEYS.FHIR_BASE_OAUTH_TOKEN_URL,
    clientId:     CONFIG_KEYS.FHIR_BASE_OAUTH_CLIENT_ID,
    scope:        CONFIG_KEYS.FHIR_BASE_OAUTH_SCOPE,
  },
  SDC_SERVER: {
    authorizeUrl: CONFIG_KEYS.SDC_SERVER_OAUTH_AUTHORIZE_URL,
    tokenUrl:     CONFIG_KEYS.SDC_SERVER_OAUTH_TOKEN_URL,
    clientId:     CONFIG_KEYS.SDC_SERVER_OAUTH_CLIENT_ID,
    scope:        CONFIG_KEYS.SDC_SERVER_OAUTH_SCOPE,
  },
};

/** OAuth config for a server, or null if not (fully) configured. */
function _oauthConfig(serverKey) {
  const keys = SERVER_OAUTH_CONFIG_KEYS[serverKey];
  if (!keys) return null;
  const authorizeUrl = serverConfig.get(keys.authorizeUrl);
  const tokenUrl     = serverConfig.get(keys.tokenUrl);
  const clientId     = serverConfig.get(keys.clientId);
  if (!authorizeUrl || !tokenUrl || !clientId) return null;
  return { authorizeUrl, tokenUrl, clientId, scope: serverConfig.get(keys.scope) || '' };
}

export function isOauthConfigured(serverKey) {
  return _oauthConfig(serverKey) != null;
}

// ── Token storage (plain localStorage, not serverConfig) ─────────────────────
function _tokenKey(serverKey, field) { return `${TOKEN_LS_PREFIX}${serverKey}.${field}`; }

/** @returns {{accessToken: string, expiresAt: number, refreshToken: string|null}|null} */
export function getStoredToken(serverKey) {
  const accessToken = localStorage.getItem(_tokenKey(serverKey, 'accessToken'));
  const expiresAt    = Number(localStorage.getItem(_tokenKey(serverKey, 'expiresAt')));
  if (!accessToken || !expiresAt) return null;
  return { accessToken, expiresAt, refreshToken: localStorage.getItem(_tokenKey(serverKey, 'refreshToken')) };
}

function _storeToken(serverKey, { accessToken, refreshToken, expiresIn }) {
  localStorage.setItem(_tokenKey(serverKey, 'accessToken'), accessToken);
  localStorage.setItem(_tokenKey(serverKey, 'expiresAt'), String(Date.now() + (Number(expiresIn) || 3600) * 1000));
  if (refreshToken) localStorage.setItem(_tokenKey(serverKey, 'refreshToken'), refreshToken);
}

export function clearStoredToken(serverKey) {
  ['accessToken', 'refreshToken', 'expiresAt'].forEach(f => localStorage.removeItem(_tokenKey(serverKey, f)));
}

/** A valid (non-expired) access token for serverKey, or null. */
export function getValidAccessToken(serverKey) {
  const t = getStoredToken(serverKey);
  if (!t || Date.now() >= t.expiresAt) return null;
  return t.accessToken;
}

// ── PKCE helpers ──────────────────────────────────────────────────────────────
function _base64url(bytes) {
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function _randomString(byteLen = 48) {
  const bytes = new Uint8Array(byteLen);
  crypto.getRandomValues(bytes);
  return _base64url(bytes);
}

async function _codeChallenge(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return _base64url(new Uint8Array(digest));
}

async function _exchangeToken(cfg, body) {
  const res = await fetch(cfg.tokenUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Token endpoint returned HTTP ${res.status}`);
  return res.json();
}

/**
 * Start a popup-based Authorization Code + PKCE login for a server.
 * MUST be called from within a user-gesture handler (click) — browsers block
 * window.open() calls made outside one.
 * @param {'FHIR_BASE'|'SDC_SERVER'} serverKey
 * @returns {Promise<string>} resolves with the new access token
 */
export async function startLogin(serverKey) {
  const cfg = _oauthConfig(serverKey);
  if (!cfg) throw new Error(`No OAuth config for ${serverKey} — set it up in Settings first.`);

  const state     = _randomString(18);
  const verifier  = _randomString(48);
  const challenge = await _codeChallenge(verifier);
  sessionStorage.setItem(STATE_SS_PREFIX + state, verifier);

  const redirectUri = new URL(CALLBACK_PATH, window.location.href).toString();
  const authUrl = new URL(cfg.authorizeUrl);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', cfg.clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  if (cfg.scope) authUrl.searchParams.set('scope', cfg.scope);

  const popup = window.open(authUrl.toString(), 'fhirqb-oauth-login', 'width=480,height=680');
  if (!popup) {
    sessionStorage.removeItem(STATE_SS_PREFIX + state);
    throw new Error('Popup blocked — please allow popups for this site and try again.');
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      clearInterval(pollClosed);
      sessionStorage.removeItem(STATE_SS_PREFIX + state);
      if (!popup.closed) popup.close();
    };

    function onMessage(ev) {
      if (ev.origin !== window.location.origin) return;
      if (ev.data?.source !== 'fhirqb-oauth-callback' || ev.data.state !== state) return;
      settled = true;
      cleanup();
      if (ev.data.error) { reject(new Error(ev.data.error)); return; }
      _exchangeToken(cfg, new URLSearchParams({
        grant_type:    'authorization_code',
        code:          ev.data.code,
        redirect_uri:  redirectUri,
        client_id:     cfg.clientId,
        code_verifier: verifier,
      })).then(data => {
        _storeToken(serverKey, { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in });
        resolve(data.access_token);
      }, reject);
    }

    const pollClosed = setInterval(() => {
      if (popup.closed && !settled) {
        settled = true;
        cleanup();
        reject(new Error('login-cancelled'));
      }
    }, 500);

    window.addEventListener('message', onMessage);
  });
}

/** Silent renewal via refresh_token. Throws if there's no refresh token or the call fails. */
export async function refreshAccessToken(serverKey) {
  const cfg    = _oauthConfig(serverKey);
  const stored = getStoredToken(serverKey);
  if (!cfg || !stored?.refreshToken) throw new Error('no-refresh-token');
  const data = await _exchangeToken(cfg, new URLSearchParams({
    grant_type:    'refresh_token',
    refresh_token: stored.refreshToken,
    client_id:     cfg.clientId,
  }));
  _storeToken(serverKey, {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token || stored.refreshToken, // some IdPs don't rotate it
    expiresIn:    data.expires_in,
  });
  return data.access_token;
}

/**
 * Ensure a valid access token for serverKey, logging in (popup) if needed.
 * MUST be called from within a user-gesture handler when no token/refresh
 * token exists yet — falls straight through to startLogin() in that case.
 * Returns null if the server has no OAuth configured (caller proceeds
 * unauthenticated, same as before this feature existed).
 * @param {'FHIR_BASE'|'SDC_SERVER'} serverKey
 */
export async function ensureLoggedIn(serverKey) {
  if (!isOauthConfigured(serverKey)) return null;
  const existing = getValidAccessToken(serverKey);
  if (existing) return existing;
  const stored = getStoredToken(serverKey);
  if (stored?.refreshToken) {
    try { return await refreshAccessToken(serverKey); } catch { clearStoredToken(serverKey); }
  }
  return startLogin(serverKey);
}
