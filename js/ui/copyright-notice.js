// ── Copyright notice ──────────────────────────────────────────────────────────
// Single source of truth for the "© year Name, Name · Free to use…" markup —
// reused by the top panel, both collapsed-rail tabs, and generated documents.
// Self-mounts on import.
import { COPYRIGHT_HTML } from '../core/copyright.js';

export function mount() {
  document.querySelectorAll('[data-mount="copyright-notice"]').forEach(el => {
    el.innerHTML = COPYRIGHT_HTML;
  });
}

if (typeof document !== 'undefined') mount();
