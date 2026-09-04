// ── Copyright notice ──────────────────────────────────────────────────────────
// Single source of truth for the "© year Name, Name · Free to use…" markup —
// reused by the top panel, both collapsed-rail tabs, and generated documents.
// Self-mounts on import.
export const COPYRIGHT_HTML = '&copy; 2026 <a href="https://www.linkedin.com/in/mosyakov/" target="_blank" rel="noopener">Sergey Mosyakov</a>, '
  + '<a href="https://www.linkedin.com/in/huthaifa-khan-541b282a/" target="_blank" rel="noopener">Huthaifa Khan</a> &middot; Free to use with attribution';

export function mount() {
  document.querySelectorAll('[data-mount="copyright-notice"]').forEach(el => {
    el.innerHTML = COPYRIGHT_HTML;
  });
}

if (typeof document !== 'undefined') mount();
