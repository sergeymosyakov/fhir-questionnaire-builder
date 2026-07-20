// ── Docs portal viewer ────────────────────────────────────────────────────────
// A dependency-free Markdown documentation viewer. Content lives as Markdown
// files under docs-site/pages/, listed in docs-site/manifest.json. This engine
// is generic and fixed-size: it does not grow as documentation grows — adding a
// page means adding a .md file + a manifest entry, never editing HTML.
//
// Rendering uses the marked + DOMPurify libraries already shipped in lib/.
// Routing:  #/<page-id>   (e.g. #/what-is-this)
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  const marked    = window.marked;
  const DOMPurify = window.DOMPurify;

  const contentEl = document.getElementById('docContent');
  const sidebarEl = document.getElementById('docSidebar');
  const tocEl     = document.getElementById('docToc');
  const searchEl  = document.getElementById('docSearch');

  let manifest   = null;
  const pageById = new Map(); // id → page
  const fileToId = new Map(); // file → id (for rewriting cross-links)

  async function init() {
    try {
      manifest = await fetch('docs-site/manifest.json').then(r => r.json());
    } catch {
      contentEl.textContent = 'Failed to load the documentation manifest.';
      return;
    }
    for (const sec of manifest.sections) {
      for (const p of sec.pages) { pageById.set(p.id, p); fileToId.set(p.file, p.id); }
    }
    buildSidebar();
    wireSearch();
    window.addEventListener('hashchange', route);
    route();
  }

  // ── Sidebar ────────────────────────────────────────────────────────────────
  function buildSidebar() {
    sidebarEl.textContent = '';
    for (const sec of manifest.sections) {
      const h = document.createElement('div');
      h.className = 'doc-nav-section';
      h.textContent = sec.label;
      sidebarEl.appendChild(h);

      const ul = document.createElement('ul');
      ul.className = 'doc-nav-list';
      for (const p of sec.pages) {
        const li = document.createElement('li');
        const a  = document.createElement('a');
        a.className = 'doc-nav-link';
        a.href = '#/' + p.id;
        a.textContent = p.title;
        a.dataset.id = p.id;
        li.appendChild(a);
        ul.appendChild(li);
      }
      sidebarEl.appendChild(ul);
    }
  }

  function highlightActive(id) {
    sidebarEl.querySelectorAll('.doc-nav-link').forEach(a =>
      a.classList.toggle('doc-nav-link--active', a.dataset.id === id));
  }

  // ── Routing ──────────────────────────────────────────────────────────────────
  function currentId() {
    const m = location.hash.match(/^#\/(.+)$/);
    if (m) return decodeURIComponent(m[1]);
    return manifest.sections[0]?.pages[0]?.id || null;
  }

  async function route() {
    const id = currentId();
    if (!id || !pageById.has(id)) { renderNotFound(id); return; }
    const page = pageById.get(id);
    highlightActive(id);

    let md;
    try {
      const res = await fetch('docs-site/pages/' + page.file);
      if (!res.ok) throw new Error(String(res.status));
      md = await res.text();
    } catch {
      renderComingSoon(page);
      return;
    }
    renderMarkdown(md);
    document.title = page.title + ' · Docs — FHIR Questionnaire Builder';
    window.scrollTo(0, 0);
    contentEl.focus?.();
  }

  // ── Rendering ────────────────────────────────────────────────────────────────
  function renderMarkdown(md) {
    contentEl.innerHTML = DOMPurify.sanitize(marked.parse(md));
    rewriteLinks();
    addHeadingAnchors();
    buildToc();
  }

  function renderComingSoon(page) {
    contentEl.textContent = '';
    const h = document.createElement('h1');
    h.textContent = page.title;
    const p = document.createElement('p');
    p.className = 'doc-placeholder';
    p.textContent = '📝 This page is being written.';
    contentEl.append(h, p);
    tocEl.classList.add('doc-hidden');
  }

  function renderNotFound(id) {
    contentEl.textContent = '';
    const h = document.createElement('h1');
    h.textContent = 'Page not found';
    const p = document.createElement('p');
    p.className = 'doc-placeholder';
    p.textContent = id ? `No documentation page for "${id}".` : 'No page selected.';
    contentEl.append(h, p);
    tocEl.classList.add('doc-hidden');
  }

  // Convert in-repo `*.md` links to hash routes; open external links in a new tab.
  function rewriteLinks() {
    contentEl.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href');
      if (/^https?:\/\//i.test(href)) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        return;
      }
      const file = href.split('/').pop();
      if (file && fileToId.has(file)) a.setAttribute('href', '#/' + fileToId.get(file));
    });
  }

  const slug = (t) => t.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '');

  function addHeadingAnchors() {
    contentEl.querySelectorAll('h2, h3').forEach(h => { if (!h.id) h.id = slug(h.textContent); });
  }

  // ── Table of contents ────────────────────────────────────────────────────────
  function buildToc() {
    tocEl.textContent = '';
    const heads = contentEl.querySelectorAll('h2, h3');
    if (heads.length < 2) { tocEl.classList.add('doc-hidden'); return; }
    tocEl.classList.remove('doc-hidden');

    const title = document.createElement('div');
    title.className = 'doc-toc-title';
    title.textContent = 'On this page';
    tocEl.appendChild(title);

    heads.forEach(h => {
      const a = document.createElement('a');
      a.className = 'doc-toc-link doc-toc-link--' + h.tagName.toLowerCase();
      a.href = '#' + h.id;
      a.textContent = h.textContent;
      a.addEventListener('click', e => {
        e.preventDefault();
        document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      tocEl.appendChild(a);
    });
  }

  // ── Search (live sidebar filter by title) ─────────────────────────────────────
  function wireSearch() {
    if (!searchEl) return;
    searchEl.addEventListener('input', () => {
      const q = searchEl.value.toLowerCase().trim();
      sidebarEl.querySelectorAll('.doc-nav-link').forEach(a => {
        a.parentElement.classList.toggle('doc-hidden', !!q && !a.textContent.toLowerCase().includes(q));
      });
      sidebarEl.querySelectorAll('.doc-nav-section').forEach(h => {
        const ul = h.nextElementSibling;
        const anyVisible = ul && [...ul.children].some(li => !li.classList.contains('doc-hidden'));
        h.classList.toggle('doc-hidden', !anyVisible);
        if (ul) ul.classList.toggle('doc-hidden', !anyVisible);
      });
    });
  }

  init();
})();
