// ── Rich tooltip ───────────────────────────────────────────────────────────────
// Replaces native title= with a styled floating panel.
// Usage: add data-tip-title / data-tip-body / data-tip-fhir / data-tip-spec
// to any element, then call init() once.
//
// data-tip-title  — bold heading
// data-tip-body   — description text
// data-tip-fhir   — FHIR field path shown in the reference footer (optional)
// data-tip-spec   — spec version label, e.g. "R4" (optional)

import * as storage from '../storage/storage.js';
import { AppEvents } from '../events.js';

const LS_KEY = 'tooltips-enabled';
let _enabled = true; // initialised from storage in init()
let _el = null;

/** Returns current enabled state. */
export function isEnabled() { return _enabled; }

/** Enable or disable all rich tooltips; persists to storage. */
export function setEnabled(val) {
  _enabled = !!val;
  storage.setItem(LS_KEY, _enabled ? 'true' : 'false');
  if (!_enabled) _hide();
  const badge = document.getElementById('tooltipsOffBadge');
  if (badge) badge.style.display = _enabled ? 'none' : '';
}

function _getEl() {
  if (!_el) {
    _el = document.createElement('div');
    _el.className = 'rich-tooltip';
    _el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(_el);
  }
  return _el;
}

function _build(target) {
  const { tipTitle: title, tipBody: body, tipFhir: fhir, tipSpec: spec } = target.dataset;
  if (!title && !body) return false;

  const tip = _getEl();
  tip.innerHTML = '';

  if (title) {
    const h = document.createElement('div');
    h.className = 'rich-tooltip__title';
    h.textContent = title;
    tip.appendChild(h);
  }

  if (body) {
    const b = document.createElement('div');
    b.className = 'rich-tooltip__body';
    b.textContent = body;
    tip.appendChild(b);
  }

  if (fhir) {
    const row = document.createElement('div');
    row.className = 'rich-tooltip__fhir';

    const badge = document.createElement('span');
    badge.className = 'rich-tooltip__fhir-badge';
    badge.textContent = 'FHIR';
    row.appendChild(badge);

    const code = document.createElement('code');
    code.textContent = fhir;
    row.appendChild(code);

    if (spec) {
      const s = document.createElement('span');
      s.className = 'rich-tooltip__spec';
      s.textContent = spec;
      row.appendChild(s);
    }
    tip.appendChild(row);
  }

  return true;
}

function _position(target) {
  const tip  = _getEl();
  const rect = target.getBoundingClientRect();
  const tipW = tip.offsetWidth  || 260;
  const tipH = tip.offsetHeight || 100;

  // Center horizontally under target, clamp to viewport
  let left = rect.left + rect.width / 2 - tipW / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));

  const spaceBelow = window.innerHeight - rect.bottom;
  const above = spaceBelow < tipH + 12;

  tip.classList.toggle('rich-tooltip--above', above);
  const top = above
    ? rect.top  - tipH - 10
    : rect.bottom + 10;

  tip.style.left = left + 'px';
  tip.style.top  = top  + 'px';
}

function _show(target) {
  if (!_enabled) return;
  if (!_build(target)) return;
  _getEl().style.display = 'block';
  // Position after display:block so offsetWidth/Height are available
  requestAnimationFrame(() => _position(target));
}

function _hide() {
  if (_el) _el.style.display = 'none';
}

export async function init() {
  _enabled = await storage.getItem(LS_KEY) !== 'false';
  // Sync badge to initial persisted state
  const badge = document.getElementById('tooltipsOffBadge');
  if (badge) badge.style.display = _enabled ? 'none' : '';
  document.addEventListener('mouseover', e => {
    const t = e.target.closest('[data-tip-title],[data-tip-body]');
    if (t) _show(t);
  });
  document.addEventListener('mouseout', e => {
    const t = e.target.closest('[data-tip-title],[data-tip-body]');
    if (t) _hide();
  });
  // Hide on scroll / resize to avoid stale position
  window.addEventListener('scroll', _hide, true);
  window.addEventListener('resize', _hide);
  // Signal initial state to settings-menu (may be awaiting async init)
  document.dispatchEvent(new CustomEvent(AppEvents.TIPS_INIT_DONE, { detail: { enabled: _enabled } }));
}

// Self-wire: settings-menu dispatches TIPS_TOGGLED; apply and persist.
if (typeof document !== 'undefined') {
  document.addEventListener(AppEvents.TIPS_TOGGLED, e => setEnabled(e.detail.enabled));
}
