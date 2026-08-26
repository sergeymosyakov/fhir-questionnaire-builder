// ── Background token renewal scheduler ────────────────────────────────────────
// One self-rescheduling timer per OAuth-configured server; silently renews via
// refresh_token, or dispatches AppEvents.OAUTH_LOGIN_REQUIRED when that's no
// longer possible (js/ui/oauth-login-banner.js listens and shows the popup
// login prompt). See docs/FHIR-SERVER-AUTH-PLAN.md.
import { getStoredToken, refreshAccessToken, clearStoredToken, isOauthConfigured } from './oauth-client.js';
import { AppEvents } from '../events.js';

export const OAUTH_SERVER_KEYS = ['FHIR_BASE', 'SDC_SERVER'];

const BASE_INTERVAL_MS = 5 * 60 * 1000;
const EXPIRY_BUFFER_MS = 5 * 1000;

const _timers = {}; // serverKey -> timeout id

function _scheduleNext(serverKey, delayMs) {
  clearTimeout(_timers[serverKey]);
  _timers[serverKey] = setTimeout(() => _tick(serverKey), Math.max(0, delayMs));
}

async function _tick(serverKey) {
  const stored = getStoredToken(serverKey);
  if (!stored) return; // logged out / never logged in — nothing to renew

  const msLeft = stored.expiresAt - Date.now();
  if (msLeft > BASE_INTERVAL_MS) { _scheduleNext(serverKey, BASE_INTERVAL_MS); return; }
  if (msLeft > EXPIRY_BUFFER_MS) { _scheduleNext(serverKey, msLeft - EXPIRY_BUFFER_MS); return; }

  // At/past the renewal threshold.
  if (!stored.refreshToken) {
    clearStoredToken(serverKey);
    document.dispatchEvent(new CustomEvent(AppEvents.OAUTH_LOGIN_REQUIRED, { detail: { serverKey } }));
    return; // scheduler stops here until a fresh login restarts it
  }
  try {
    await refreshAccessToken(serverKey);
    _scheduleNext(serverKey, BASE_INTERVAL_MS);
  } catch {
    clearStoredToken(serverKey);
    document.dispatchEvent(new CustomEvent(AppEvents.OAUTH_LOGIN_REQUIRED, { detail: { serverKey } }));
  }
}

/** Start (or restart) the renewal scheduler for a server. No-op if not logged in. */
export function startScheduler(serverKey) {
  if (!isOauthConfigured(serverKey) || !getStoredToken(serverKey)) return;
  _tick(serverKey);
}

/** Stop the scheduler for a server (e.g. after logout/decline). */
export function stopScheduler(serverKey) {
  clearTimeout(_timers[serverKey]);
  delete _timers[serverKey];
}

/** Called once at app boot — resumes schedulers for any server with a stored token. */
export function resumeSchedulersFromStorage() {
  OAUTH_SERVER_KEYS.forEach(startScheduler);
}
