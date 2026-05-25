// ── Node registry ─────────────────────────────────────────────────────────────
// Leaf module (no imports) — filled by nodes/index.js at load time.
// BaseNode.dispatch() reads from this map to resolve the correct class.
// Key: itemType string ('text', 'group', 'select', …) or node.type ('group').

export const NODE_REGISTRY = new Map();
