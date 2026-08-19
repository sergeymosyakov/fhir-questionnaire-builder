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
let _inited = false;
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
    // Close button — only visible in bottom-sheet mode (CSS controls display).
    const closeBtn = document.createElement('button');
    closeBtn.className = 'rich-tooltip__close';
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.addEventListener('click', e => { e.stopPropagation(); _hide(); });
    _el.appendChild(closeBtn);
    document.body.appendChild(_el);
  }
  return _el;
}

function _build(target) {
  const { tipTitle: title, tipBody: body, tipFhir: fhir, tipSpec: spec } = target.dataset;
  if (!title && !body) return false;

  const tip = _getEl();
  // Remove content children but keep the close button.
  [...tip.children].forEach(c => { if (!c.classList.contains('rich-tooltip__close')) c.remove(); });

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
  if (!_el) return;
  _el.style.display = 'none';
  _el.classList.remove('rich-tooltip--sheet');
  _shownByClick = false;
  _shownTarget  = null;
}

/** True when the viewport is in mobile mode (our 1024px breakpoint). */
const _isMobile = () => window.innerWidth < 1024;

let _shownByClick = false;
let _shownTarget  = null; // element whose tooltip is currently shown

/** Show as a bottom-sheet on tap (mobile). */
function _showSheet(target) {
  if (!_enabled) return;
  if (!_build(target)) return;
  const tip = _getEl();
  tip.classList.add('rich-tooltip--sheet');
  tip.style.left = '';
  tip.style.top  = '';
  tip.style.display = 'block';
  _shownByClick = true;
  _shownTarget  = target;
}

export async function init() {
  if (_inited) return; // document-delegated — one init covers the whole page
  _inited = true;
  // Tooltips must not depend on persistence (the embedded widget has no storage
  // adapter registered) — fall back to enabled if storage is unavailable.
  try { _enabled = await storage.getItem(LS_KEY) !== 'false'; } catch { _enabled = true; }
  // Sync badge to initial persisted state
  const badge = document.getElementById('tooltipsOffBadge');
  if (badge) badge.style.display = _enabled ? 'none' : '';

  // Desktop: hover shows/hides the floating tooltip.
  document.addEventListener('mouseover', e => {
    if (_isMobile()) return;
    const t = e.target.closest('[data-tip-title],[data-tip-body]');
    if (t) _show(t);
  });
  document.addEventListener('mouseout', e => {
    if (_isMobile()) return;
    const t = e.target.closest('[data-tip-title],[data-tip-body]');
    if (t) _hide();
  });

  // Mobile: tap on tipped element shows bottom-sheet.
  // capture:true fires before any element-level stopPropagation calls.
  document.addEventListener('click', e => {
    if (!_isMobile()) return;
    const t = e.target.closest('[data-tip-title],[data-tip-body]');
    // Close sheet if tap outside.
    if (!t) {
      if (_shownByClick && _el && !_el.contains(e.target)) _hide();
      return;
    }
    // Skip elements that have their own tap action.
    const hasOwnAction = !!t.closest(
      'button, a, [role="button"], .calc-badge--explain, ' +
      '.preview-condition-hint--explain, .preview-calc-value--explain, ' +
      '.status-dropdown-row, .support-link-patient-btn, .preview-nav-btn'
    );
    if (hasOwnAction) return;
    // Same element: toggle (close). Different element: switch immediately.
    if (_shownByClick) {
      _hide();
      if (t === _shownTarget) return; // was same element → just close
    }
    _showSheet(t);
  }, { capture: true });

  // Close sheet when clicking outside on desktop too.
  document.addEventListener('click', e => {
    if (_isMobile()) return;
    if (_shownByClick && _el && !_el.contains(e.target)) _hide();
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
