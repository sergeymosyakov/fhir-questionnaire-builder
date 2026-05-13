// ── Pure utility functions ────────────────────────────────────────────────────
// No imports, no side effects — safe to use from anywhere.

// Escape a string for use in an HTML attribute value.
export const escAttr = s => (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');

// Remove the node with the given id from a tree (mutates in place).
export function findAndRemove(id, nodes) {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) { nodes.splice(i, 1); return; }
    if (nodes[i].type === 'group') findAndRemove(id, nodes[i].children);
  }
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
