// ── Pure utility functions ────────────────────────────────────────────────────
// No imports, no side effects — safe to use from anywhere.

// ── Internal namespace ────────────────────────────────────────────────────────
// UUID-based prefix for all system-generated constraint keys.
// Guarantees no collision with user-defined keys.
export const ITLH_NS = 'e3a8c2f1-6b4d-4e9a-87c5';
// System constraint keys
export const ITLH_KEY_GROUP_OR = ITLH_NS + ':group-or';

// Escape a string for use in an HTML attribute value.
export const escAttr = s => (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Remove the node with the given id from a tree (mutates in place).
export function findAndRemove(id, nodes) {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) { const [n] = nodes.splice(i, 1); n.destroy?.(); return true; }
    if (nodes[i].type === 'group' && findAndRemove(id, nodes[i].children)) return true;
  }
  return false;
}

// Destroy all listeners on every node in the tree, then empty the array.
export function destroyTree(nodes) {
  nodes.forEach(n => n.destroy?.());
  nodes.splice(0);
}

// Returns true if nodeId is anywhere inside group's subtree (recursive).
export function isDescendant(nodeId, group) {
  for (const ch of group.children) {
    if (ch.id === nodeId) return true;
    if (ch.type === 'group' && isDescendant(nodeId, ch)) return true;
  }
  return false;
}

// Returns array of group IDs that are ancestors of nodeId in the tree.
export function findAncestorGroupIds(nodeId, nodes, ancestors = []) {
  for (const n of nodes) {
    if (n.id === nodeId) return ancestors;
    if (n.type === 'group') {
      const found = findAncestorGroupIds(nodeId, n.children, [...ancestors, n.id]);
      if (found) return found;
    }
  }
  return null;
}

// Parse a single option token: "code=display" → { code, display }
// Backward compat: "value" (no =) → { code: value, display: value }
export function parseOption(s) {
  const eq = s.indexOf('=');
  if (eq === -1) return { code: s, display: s };
  return { code: s.slice(0, eq).trim(), display: s.slice(eq + 1).trim() };
}

// Parse comma-separated options string → [{ code, display }]
export function parseOptions(str) {
  return (str || '').split(',').map(s => s.trim()).filter(Boolean).map(parseOption);
}

// ── JSON syntax highlighter ───────────────────────────────────────────────────
// Tokenises a pretty-printed JSON string and wraps each token in a <span>.
// Safe: HTML special chars are escaped BEFORE the regex runs.
// Sentinel chars \x01 / \x02 are preserved (used by highlightJsonWithSearch).
export function highlightJson(raw) {
  const esc = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return esc.replace(
    /("(?:\\u[0-9a-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)/g,
    match => {
      let cls;
      if (/^"/.test(match)) { cls = /:$/.test(match) ? 'jv-k' : 'jv-s'; }
      else if (match === 'true' || match === 'false') { cls = 'jv-b'; }
      else if (match === 'null') { cls = 'jv-null'; }
      else { cls = 'jv-n'; }
      return '<span class="' + cls + '">' + match + '</span>';
    }
  );
}

// Like highlightJson but also wraps every case-insensitive occurrence of
// `query` in <mark class="search-match"> tags.
// Returns { html: string, count: number }.
export function highlightJsonWithSearch(raw, query) {
  if (!query) return { html: highlightJson(raw), count: 0 };
  const lq = query.toLowerCase();
  const lr = raw.toLowerCase();
  const positions = [];
  let pos = 0;
  while ((pos = lr.indexOf(lq, pos)) !== -1) {
    positions.push(pos);
    pos += lq.length;
  }
  if (positions.length === 0) return { html: highlightJson(raw), count: 0 };
  // Insert sentinels (\x01 = open, \x02 = close) — not HTML-escapable,
  // not valid JSON, pass through highlightJson unchanged.
  let marked = '';
  let last = 0;
  for (const start of positions) {
    marked += raw.slice(last, start) + '\x01' + raw.slice(start, start + lq.length) + '\x02';
    last = start + lq.length;
  }
  marked += raw.slice(last);
  let html = highlightJson(marked);
  html = html.split('\x01').join('<mark class="search-match">');
  html = html.split('\x02').join('</mark>');
  return { html, count: positions.length };
}

// Read a file-input change event as JSON. Returns Promise<{data, fileName}>.
// Rejects with Error on parse/read failure; rejects with null if no file selected.
export function readFileAsJSON(e) {
  return new Promise((resolve, reject) => {
    const file = e.target.files[0];
    if (!file) { reject(null); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      try { resolve({ data: JSON.parse(ev.target.result), fileName: file.name }); }
      catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('Error reading file'));
    reader.readAsText(file);
    e.target.value = '';
  });
}
