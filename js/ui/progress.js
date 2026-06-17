// ── Global progress indicator ─────────────────────────────────────────────────
// API:
//   progress.show(label)            — show bar + label, animate indeterminate
//   progress.update(done, total)    — update fill + counter
//   progress.hide()                 — hide bar
//
// DOM nodes injected via init(elements) — no getElementById inside this module.

let _el  = null;
let _op  = '';

export function init() {
  _el = {
    wrap:    document.querySelector('[data-mount="progress-wrap"]'),
    bar:     document.querySelector('[data-mount="progress-bar"]'),
    label:   document.querySelector('[data-mount="progress-label"]'),
    blocker: document.querySelector('[data-mount="ui-blocker"]'),
  };
  _el.wrap.style.display    = 'none';
  _el.blocker.style.display = 'none';
}

export function show(label) {
  if (!_el) return;
  _op = label;
  _el.label.textContent = label;
  _el.bar.style.width = '0%';
  _el.bar.classList.add('progress-bar--indeterminate');
  _el.wrap.style.display    = 'flex';
  _el.blocker.style.display = 'block';
}

export function update(done, total) {
  if (!_el) return;
  _el.bar.classList.remove('progress-bar--indeterminate');
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  _el.bar.style.width = pct + '%';
  _el.label.textContent = _op + ' ' + done + ' / ' + total;
}

export function hide() {
  if (!_el) return;
  _el.wrap.style.display    = 'none';
  _el.blocker.style.display = 'none';
  _el.bar.style.width = '0%';
  _el.bar.classList.remove('progress-bar--indeterminate');
  _op = '';
}
