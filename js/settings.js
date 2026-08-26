// ── Settings page script ──────────────────────────────────────────────────────
// Reads current config from serverConfig, renders fields, saves user overrides
// to LocalStorageConfigProvider.
import {
  serverConfig,
  LocalStorageConfigProvider,
  CONFIG_KEYS,
} from './fhir/server-config.js';
import * as auth       from './auth/auth.js';
import { loadSettings, saveSettings, supabaseProvider } from './fhir/server-config-cloud.js';
import { createCustomSelect } from './ui/custom-select.js';
import { TRANSLATE_PROVIDERS, getProvider } from './fhir/translate-providers.js';
import { ensureLoggedIn } from './fhir/oauth-client.js';
import { startScheduler } from './fhir/oauth-scheduler.js';
import { fhirAuthHeaderFor } from './fhir/fhir-search.js';

// ── Defaults (fallback labels shown in placeholders) ─────────────────────────
const DEFAULTS = {
  [CONFIG_KEYS.TERMINOLOGY_SERVER]: 'https://tx.fhir.org/r4',
  [CONFIG_KEYS.FHIR_BASE]:          '',
  [CONFIG_KEYS.CORS_PROXY]:         '',
  [CONFIG_KEYS.NLM_API_BASE]:       'https://clinicaltables.nlm.nih.gov/api',
  [CONFIG_KEYS.SDC_SERVER]:          '',
  [CONFIG_KEYS.TRANSLATE_API]:      'https://translate.googleapis.com/translate_a/single',
  [CONFIG_KEYS.TRANSLATE_PROVIDER]: 'gtx',
  [CONFIG_KEYS.TRANSLATE_API_KEY]:  '',
};

// ── Translation provider picker ──────────────────────────────────────────────
let _translateProvider = 'gtx';
let _provSelect = null;

function _applyProviderUI(id) {
  const p = getProvider(id);
  const keyField = _el('translateKeyField');
  if (keyField) keyField.hidden = !p.keyLabel;
  const keyLabel = _el('translateApiKeyLabel');
  if (keyLabel) keyLabel.textContent = p.keyLabel || 'API Key';
  const ep = _el('translateApiInput');
  if (ep) ep.placeholder = p.endpointPlaceholder || '';
  const hint = _el('translateEndpointHint');
  if (hint) hint.textContent = p.hint;
}

function _renderTranslateProvider() {
  const mount = _el('translateProviderMount');
  if (!mount) return;
  _translateProvider = serverConfig.get(CONFIG_KEYS.TRANSLATE_PROVIDER) || 'gtx';
  _provSelect = createCustomSelect({
    items: TRANSLATE_PROVIDERS.map(p => ({ value: p.id, label: p.label })),
    value: _translateProvider,
    testid: 'translate-provider-select',
    ariaLabel: 'Translation provider',
    onChange: (v) => { _translateProvider = v; _applyProviderUI(v); },
  });
  mount.appendChild(_provSelect.el);
  _applyProviderUI(_translateProvider);
}

function _collectProvider() {
  const val = _translateProvider === 'gtx' ? null : _translateProvider;
  _lsProvider.set(CONFIG_KEYS.TRANSLATE_PROVIDER, val);
  if (_currentUser) supabaseProvider.set(CONFIG_KEYS.TRANSLATE_PROVIDER, val);
}

// ── Register providers (same order as app.js but settings page is standalone) ─
const _lsProvider = new LocalStorageConfigProvider();
serverConfig.register(_lsProvider);
// SupabaseConfigProvider is registered by server-config-cloud.js import above
serverConfig.load('./config.json');

// ── Track current user ────────────────────────────────────────────────────────
let _currentUser = null;
// Load settings + populate fields once (on the initial auth check). Supabase
// re-fires onAuthChange periodically (e.g. TOKEN_REFRESHED) while the user
// stays logged in on this page — reloading/re-rendering fields on those would
// clobber whatever the user is actively typing, so we deliberately don't react
// to auth events again after the first one.
let _initialAuthLoadDone = false;
auth.onAuthChange(async (_event, user) => {
  _currentUser = user;
  _updateCloudBadge(user);
  if (_initialAuthLoadDone) return;
  _initialAuthLoadDone = true;
  if (user) await loadSettings(user.id);
  await serverConfig.ready();
  _refreshAllFields();
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function _el(id) { return document.getElementById(id); }

function _markCustom(input, resetBtn, key) {
  const hasOverride = _lsProvider.get(key) != null;
  input.classList.toggle('is-custom', hasOverride);
  if (resetBtn) resetBtn.disabled = !hasOverride;
}

function _setResult(el, { ok, message, loading = false }) {
  el.className = 's-test-result' + (loading ? '' : ok ? ' ok' : ' fail');
  el.textContent = loading ? 'Testing…' : (ok ? '✓ ' : '✗ ') + message;
}

// ── Render validators list ────────────────────────────────────────────────────
function _renderValidators(validators) {
  const wrap = _el('validatorsDisplay');
  if (!validators || validators.length === 0) {
    wrap.innerHTML = '<p class="s-empty-note">No validators configured in config.json.</p>';
    return;
  }
  wrap.innerHTML = '';
  for (const v of validators) {
    const row = document.createElement('div');
    row.className = 's-validator-row';

    const typeEl = document.createElement('span');
    typeEl.className = 's-validator-type';
    typeEl.textContent = v.type || 'local';

    const nameEl = document.createElement('span');
    nameEl.className = 's-validator-name';
    nameEl.textContent = v.name || '—';

    const urlEl = document.createElement('span');
    urlEl.className = 's-validator-url';
    urlEl.textContent = v.url || '(built-in)';

    row.append(typeEl, nameEl, urlEl);
    wrap.appendChild(row);
  }
}

// ── Render provider list ──────────────────────────────────────────────────────
function _renderProviders() {
  const wrap = _el('providersDisplay');
  const providers = serverConfig.getProviders();
  wrap.innerHTML = '';
  providers.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 's-provider-row';

    const rank = document.createElement('span');
    rank.className = 's-provider-rank';
    rank.textContent = '#' + (i + 1);

    const badge = document.createElement('span');
    badge.className = 's-provider-badge' +
      (p.label.includes('Custom') ? ' custom' : p.label.includes('Cloud') ? ' cloud' : '');
    badge.textContent = p.label;

    row.append(rank, badge);
    wrap.appendChild(row);
  });
}

// ── Wire input field ──────────────────────────────────────────────────────────
function _wireField(inputId, resetId, key) {
  const input = _el(inputId);
  const resetBtn = _el(resetId);
  if (!input) return;

  // Set current value
  const current = serverConfig.get(key) || '';
  input.value = current;
  _markCustom(input, resetBtn, key);

  // Listener: mark dirty but don't save yet
  input.addEventListener('input', () => {
    _markCustom(input, resetBtn, key);
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      _lsProvider.set(key, null);
      input.value = serverConfig.get(key) || '';
      _markCustom(input, resetBtn, key);
      _showStatus('Reset to default.');
    });
  }
}

// ── Test connection ───────────────────────────────────────────────────────────
async function _testFhirServer(url, resultEl, testBtn, serverKey) {
  if (!url) { _setResult(resultEl, { ok: false, message: 'No URL entered' }); return; }
  _setResult(resultEl, { ok: false, message: '', loading: true });
  testBtn.disabled = true;
  try {
    const targetUrl = url.replace(/\/$/, '') + '/metadata';
    // Log in first (if this server has OAuth configured) — still inside this
    // click handler, so a login popup is allowed by the browser.
    if (serverKey) {
      try { await ensureLoggedIn(serverKey); startScheduler(serverKey); }
      catch (err) {
        if (err.message === 'login-cancelled') { _setResult(resultEl, { ok: false, message: 'Login cancelled' }); return; }
        _setResult(resultEl, { ok: false, message: `Login failed: ${err.message}` }); return;
      }
    }
    const proxy = serverConfig.get(CONFIG_KEYS.CORS_PROXY) || '';
    const fetchUrl = proxy ? `${proxy}?url=${encodeURIComponent(targetUrl)}` : targetUrl;
    const res = await fetch(fetchUrl, {
      headers: { Accept: 'application/fhir+json', ...await fhirAuthHeaderFor(targetUrl, serverKey) },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) { _setResult(resultEl, { ok: false, message: `HTTP ${res.status}` }); return; }
    const body = await res.json();
    if (body.resourceType !== 'CapabilityStatement') {
      _setResult(resultEl, { ok: false, message: 'Not a FHIR server' }); return;
    }
    const name = [body.software?.name, body.software?.version].filter(Boolean).join(' ') || 'OK';
    _setResult(resultEl, { ok: true, message: name });
  } catch (err) {
    _setResult(resultEl, { ok: false, message: err.message });
  } finally {
    testBtn.disabled = false;
  }
}

// ── Save ──────────────────────────────────────────────────────────────────────
function _showStatus(msg, isOk = false) {
  const el = _el('saveStatus');
  el.className = 's-status' + (isOk ? ' saved' : '');
  el.textContent = msg;
  if (isOk) setTimeout(() => { el.textContent = ''; el.className = 's-status'; }, 3000);
}

function _collectField(inputId, key) {
  const input = _el(inputId);
  if (!input) return;
  const val = input.value.trim();
  const defaultVal = DEFAULTS[key] || '';
  const finalVal = (val && val !== defaultVal) ? val : null;
  _lsProvider.set(key, finalVal);
  // Also update supabaseProvider cache so saveSettings() persists the new value
  if (_currentUser) supabaseProvider.set(key, finalVal);
  _markCustom(input, null, key);
}


// ── Cloud badge ───────────────────────────────────────────────────────────────
function _updateCloudBadge(user) {
  const bar = _el('saveStatus')?.closest('.s-save-bar');
  if (!bar) return;
  let badge = bar.querySelector('.s-cloud-badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 's-cloud-badge';
    bar.insertBefore(badge, bar.querySelector('.s-status'));
  }
  badge.textContent = user ? '☁️ Synced to cloud' : '';
  badge.style.display = user ? '' : 'none';
}

// Refresh all input fields from current serverConfig values (after cloud load)
function _refreshAllFields() {
  const map = {
    [CONFIG_KEYS.TERMINOLOGY_SERVER]: 'termServerInput',
    [CONFIG_KEYS.FHIR_BASE]:          'fhirBaseInput',
    [CONFIG_KEYS.CORS_PROXY]:         'corsProxyInput',
    [CONFIG_KEYS.NLM_API_BASE]:       'nlmApiInput',
    [CONFIG_KEYS.SDC_SERVER]:         'sdcServerInput',
    [CONFIG_KEYS.TRANSLATE_API]:      'translateApiInput',
    [CONFIG_KEYS.TRANSLATE_API_KEY]:  'translateApiKeyInput',
    [CONFIG_KEYS.FHIR_BASE_OAUTH_AUTHORIZE_URL]:  'fhirBaseOauthAuthorizeInput',
    [CONFIG_KEYS.FHIR_BASE_OAUTH_TOKEN_URL]:      'fhirBaseOauthTokenInput',
    [CONFIG_KEYS.FHIR_BASE_OAUTH_CLIENT_ID]:      'fhirBaseOauthClientIdInput',
    [CONFIG_KEYS.FHIR_BASE_OAUTH_SCOPE]:          'fhirBaseOauthScopeInput',
    [CONFIG_KEYS.SDC_SERVER_OAUTH_AUTHORIZE_URL]: 'sdcServerOauthAuthorizeInput',
    [CONFIG_KEYS.SDC_SERVER_OAUTH_TOKEN_URL]:     'sdcServerOauthTokenInput',
    [CONFIG_KEYS.SDC_SERVER_OAUTH_CLIENT_ID]:     'sdcServerOauthClientIdInput',
    [CONFIG_KEYS.SDC_SERVER_OAUTH_SCOPE]:         'sdcServerOauthScopeInput',
  };
  for (const [key, inputId] of Object.entries(map)) {
    const inp = _el(inputId);
    // Never overwrite a field the user is actively editing.
    if (inp && document.activeElement !== inp) inp.value = serverConfig.get(key) || '';
  }
  _translateProvider = serverConfig.get(CONFIG_KEYS.TRANSLATE_PROVIDER) || 'gtx';
  _provSelect?.setValue(_translateProvider);
  _applyProviderUI(_translateProvider);
}

_el('saveBtn').addEventListener('click', () => {
  _collectField('termServerInput', CONFIG_KEYS.TERMINOLOGY_SERVER);
  _collectField('fhirBaseInput',   CONFIG_KEYS.FHIR_BASE);
  _collectField('corsProxyInput',  CONFIG_KEYS.CORS_PROXY);
  _collectField('nlmApiInput',     CONFIG_KEYS.NLM_API_BASE);
  _collectField('sdcServerInput',  CONFIG_KEYS.SDC_SERVER);
  _collectField('translateApiInput', CONFIG_KEYS.TRANSLATE_API);
  _collectField('translateApiKeyInput', CONFIG_KEYS.TRANSLATE_API_KEY);
  _collectField('fhirBaseOauthAuthorizeInput', CONFIG_KEYS.FHIR_BASE_OAUTH_AUTHORIZE_URL);
  _collectField('fhirBaseOauthTokenInput',     CONFIG_KEYS.FHIR_BASE_OAUTH_TOKEN_URL);
  _collectField('fhirBaseOauthClientIdInput',  CONFIG_KEYS.FHIR_BASE_OAUTH_CLIENT_ID);
  _collectField('fhirBaseOauthScopeInput',     CONFIG_KEYS.FHIR_BASE_OAUTH_SCOPE);
  _collectField('sdcServerOauthAuthorizeInput', CONFIG_KEYS.SDC_SERVER_OAUTH_AUTHORIZE_URL);
  _collectField('sdcServerOauthTokenInput',     CONFIG_KEYS.SDC_SERVER_OAUTH_TOKEN_URL);
  _collectField('sdcServerOauthClientIdInput',  CONFIG_KEYS.SDC_SERVER_OAUTH_CLIENT_ID);
  _collectField('sdcServerOauthScopeInput',     CONFIG_KEYS.SDC_SERVER_OAUTH_SCOPE);
  _collectProvider();
  // Re-sync all reset button states and input custom styles
  document.querySelectorAll('[data-reset]').forEach(btn => {
    const key = btn.dataset.reset;
    btn.disabled = _lsProvider.get(key) == null;
    const map = {
      [CONFIG_KEYS.TERMINOLOGY_SERVER]: 'termServerInput',
      [CONFIG_KEYS.FHIR_BASE]:          'fhirBaseInput',
      [CONFIG_KEYS.CORS_PROXY]:         'corsProxyInput',
      [CONFIG_KEYS.NLM_API_BASE]:       'nlmApiInput',
      [CONFIG_KEYS.SDC_SERVER]:         'sdcServerInput',
      [CONFIG_KEYS.TRANSLATE_API]:      'translateApiInput',
      [CONFIG_KEYS.TRANSLATE_API_KEY]:  'translateApiKeyInput',
    };
    const inp = _el(map[key]);
    if (inp) inp.classList.toggle('is-custom', _lsProvider.get(key) != null);
  });
  if (_currentUser) {
    saveSettings(_currentUser.id)
      .then(() => _showStatus('Saved to cloud.', true))
      .catch(() => _showStatus('Saved locally (cloud sync failed).', true));
  } else {
    _showStatus('Settings saved.', true);
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  await serverConfig.ready();

  _wireField('termServerInput', null, CONFIG_KEYS.TERMINOLOGY_SERVER);
  _wireField('fhirBaseInput',   null, CONFIG_KEYS.FHIR_BASE);
  _wireField('corsProxyInput',  null, CONFIG_KEYS.CORS_PROXY);
  _wireField('nlmApiInput',     null, CONFIG_KEYS.NLM_API_BASE);
  _wireField('sdcServerInput',  null, CONFIG_KEYS.SDC_SERVER);
  _wireField('translateApiInput', null, CONFIG_KEYS.TRANSLATE_API);
  _wireField('translateApiKeyInput', null, CONFIG_KEYS.TRANSLATE_API_KEY);
  _wireField('fhirBaseOauthAuthorizeInput', null, CONFIG_KEYS.FHIR_BASE_OAUTH_AUTHORIZE_URL);
  _wireField('fhirBaseOauthTokenInput',     null, CONFIG_KEYS.FHIR_BASE_OAUTH_TOKEN_URL);
  _wireField('fhirBaseOauthClientIdInput',  null, CONFIG_KEYS.FHIR_BASE_OAUTH_CLIENT_ID);
  _wireField('fhirBaseOauthScopeInput',     null, CONFIG_KEYS.FHIR_BASE_OAUTH_SCOPE);
  _wireField('sdcServerOauthAuthorizeInput', null, CONFIG_KEYS.SDC_SERVER_OAUTH_AUTHORIZE_URL);
  _wireField('sdcServerOauthTokenInput',     null, CONFIG_KEYS.SDC_SERVER_OAUTH_TOKEN_URL);
  _wireField('sdcServerOauthClientIdInput',  null, CONFIG_KEYS.SDC_SERVER_OAUTH_CLIENT_ID);
  _wireField('sdcServerOauthScopeInput',     null, CONFIG_KEYS.SDC_SERVER_OAUTH_SCOPE);
  _renderTranslateProvider();

  // Wire reset buttons by data-reset attribute
  document.querySelectorAll('[data-reset]').forEach(btn => {
    const key = btn.dataset.reset;
    btn.disabled = _lsProvider.get(key) == null;
    btn.addEventListener('click', () => {
      _lsProvider.set(key, null);
      // Refresh corresponding input
      const map = {
        [CONFIG_KEYS.TERMINOLOGY_SERVER]: 'termServerInput',
        [CONFIG_KEYS.FHIR_BASE]:          'fhirBaseInput',
        [CONFIG_KEYS.CORS_PROXY]:         'corsProxyInput',
        [CONFIG_KEYS.NLM_API_BASE]:       'nlmApiInput',
        [CONFIG_KEYS.SDC_SERVER]:         'sdcServerInput',
        [CONFIG_KEYS.TRANSLATE_API]:      'translateApiInput',
        [CONFIG_KEYS.TRANSLATE_API_KEY]:  'translateApiKeyInput',
      };
      const inp = _el(map[key]);
      if (inp) {
        inp.value = serverConfig.get(key) || '';
        inp.classList.remove('is-custom');
      }
      btn.disabled = true;
      _showStatus('Reset to default.');
    });
  });

  // Render validators (read-only — defined in config.json)
  const validators = serverConfig.getParsed(CONFIG_KEYS.VALIDATORS);
  _renderValidators(validators);

  // Render providers
  _renderProviders();

  // Test buttons
  _el('testTermServerBtn').addEventListener('click', () => {
    const url = _el('termServerInput').value.trim() || serverConfig.get(CONFIG_KEYS.TERMINOLOGY_SERVER);
    _testFhirServer(url, _el('testTermServerResult'), _el('testTermServerBtn'));
  });
  _el('testSdcServerBtn').addEventListener('click', () => {
    const url = _el('sdcServerInput').value.trim() || serverConfig.get(CONFIG_KEYS.SDC_SERVER);
    _testFhirServer(url, _el('testSdcServerResult'), _el('testSdcServerBtn'), 'SDC_SERVER');
  });

  _el('testFhirBaseBtn').addEventListener('click', () => {
    const url = _el('fhirBaseInput').value.trim() || serverConfig.get(CONFIG_KEYS.FHIR_BASE);
    _testFhirServer(url, _el('testFhirBaseResult'), _el('testFhirBaseBtn'), 'FHIR_BASE');
  });
}

init();
