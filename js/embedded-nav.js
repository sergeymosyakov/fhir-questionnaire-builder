// ── Embedded navigation guard ─────────────────────────────────────────────────
// Secondary pages (settings.html, help.html, docs.html) show a "Back to Builder"
// link so they can stand on their own. When one of them is embedded inside a
// modal iframe, the host adds an `embedded` marker to the URL — in that case the
// back link is redundant (the modal already has its own Close control), so we
// hide it. A hash fragment is used rather than a query string because the dev
// server's clean-URL redirects drop query strings but preserve the hash.
// Loaded as a module, this runs after the document is parsed.
if (location.hash === '#embedded' || new URLSearchParams(location.search).has('embedded')) {
  for (const el of document.querySelectorAll('[data-back-link]')) el.hidden = true;
}
