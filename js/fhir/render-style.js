// Pure rendering-style parsing shared by the vanilla applyRenderStyle and the React preview.

// Safe allowlist for FHIR rendering-style — only these CSS properties are applied.
export const RENDER_STYLE_ALLOWLIST = ['font-weight', 'font-style', 'color', 'font-size', 'text-decoration'];

// Parse a rendering-style CSS string into an allowlisted { prop: value } map (kebab-case keys).
export function parseRenderStyle(raw) {
  const out = {};
  if (!raw) return out;
  const allow = new Set(RENDER_STYLE_ALLOWLIST);
  raw.split(';').forEach((part) => {
    const sep = part.indexOf(':');
    if (sep < 1) return;
    const prop = part.slice(0, sep).trim().toLowerCase();
    const val = part.slice(sep + 1).trim();
    if (allow.has(prop) && val) out[prop] = val;
  });
  return out;
}
