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
