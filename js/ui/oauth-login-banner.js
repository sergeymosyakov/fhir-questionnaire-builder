// ── OAuth re-login banner ──────────────────────────────────────────────────────
// Self-wires to AppEvents.OAUTH_LOGIN_REQUIRED (dispatched by oauth-scheduler.js
// when it can no longer silently renew a session). window.open() only happens
// on this banner's own click — browsers block popups opened from non-gesture
// contexts like a timer.
import { startLogin } from '../fhir/oauth-client.js';
import { startScheduler } from '../fhir/oauth-scheduler.js';
import { showError } from './toast.js';
import { AppEvents } from '../events.js';

const SERVER_LABELS = {
  FHIR_BASE:  'FHIR server',
  SDC_SERVER: 'SDC server',
};

class OauthLoginBanner {
  constructor() {
    this._banners = new Map(); // serverKey -> element
  }

  show(serverKey) {
    if (this._banners.has(serverKey)) return;

    const el = document.createElement('div');
    el.className = 'oauth-login-banner';
    el.dataset.testid = `oauth-login-banner-${serverKey}`;

    const msg = document.createElement('span');
    msg.className = 'oauth-login-banner-msg';
    msg.textContent = `Session for the ${SERVER_LABELS[serverKey] || serverKey} expired \u2014 log in to keep using it.`;

    const loginBtn = document.createElement('button');
    loginBtn.type = 'button';
    loginBtn.className = 'oauth-login-banner-btn';
    loginBtn.dataset.testid = `oauth-login-banner-login-${serverKey}`;
    loginBtn.textContent = 'Log in';
    loginBtn.addEventListener('click', () => this._login(serverKey));

    const dismissBtn = document.createElement('button');
    dismissBtn.type = 'button';
    dismissBtn.className = 'oauth-login-banner-dismiss';
    dismissBtn.setAttribute('aria-label', 'Dismiss');
    dismissBtn.textContent = '\u00d7';
    dismissBtn.addEventListener('click', () => this._remove(serverKey));

    el.append(msg, loginBtn, dismissBtn);
    document.body.appendChild(el);
    this._banners.set(serverKey, el);
  }

  async _login(serverKey) {
    try {
      await startLogin(serverKey);
      this._remove(serverKey);
      startScheduler(serverKey);
    } catch (err) {
      if (err.message !== 'login-cancelled') showError(`Login failed: ${err.message}`);
    }
  }

  _remove(serverKey) {
    this._banners.get(serverKey)?.remove();
    this._banners.delete(serverKey);
  }
}

const _instance = new OauthLoginBanner();

document.addEventListener(AppEvents.OAUTH_LOGIN_REQUIRED, e => _instance.show(e.detail.serverKey));
