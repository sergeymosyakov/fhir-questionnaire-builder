// ── Builder shared utilities ─────────────────────────────────────────────────
// Pure helpers used by panels.js and nodes.
// All stateful logic lives in BuilderPanel class (builder-panel.js).

// ── ID segment formatter ─────────────────────────────────────────────────────
function _toRoman(n) {
  const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  const syms = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
  let r = '';
  for (let i = 0; i < vals.length; i++) while (n >= vals[i]) { r += syms[i]; n -= vals[i]; }
  return r;
}
function _toLetter(n) {
  let r = '';
  while (n > 0) { r = String.fromCharCode(64 + ((n - 1) % 26 + 1)) + r; n = Math.floor((n - 1) / 26); }
  return r;
}

let _formatGetter = () => 'numbers';
export function setFormatGetter(fn) { _formatGetter = fn; }
export function formatSeg(n) {
  const fmt = _formatGetter();
  return fmt === 'roman' ? _toRoman(n)
    : fmt === 'letters' ? _toLetter(n)
      : String(n);
}

// Collect all item nodes as flat list with breadcrumb labels for dropdowns
export function getAllItems(nodes, result = [], prefix = '') {
  for (const n of nodes) {
    if (n.type === 'item') {
      result.push({ id: n.id, label: (prefix ? prefix + ' › ' : '') + n.title, itemType: n.itemType, options: n.options });
    } else if (n.type === 'group') {
      getAllItems(n.children, result, (prefix ? prefix + ' › ' : '') + n.title);
    }
  }
  return result;
}


