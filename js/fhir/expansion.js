// ValueSet.expansion → flat list of selectable options
// Nested `contains` are flattened; abstract entries and entries without a code are skipped (not selectable).

function walk(contains, out, raw) {
  for (const c of contains || []) {
    if (c.code !== undefined && c.code !== '' && c.abstract !== true) {
      out.push({ code: String(c.code), display: raw ? c.display : c.display || c.code, system: c.system || '' });
    }
    if (c.contains?.length) walk(c.contains, out, raw);
  }
  return out;
}

/** @returns {{ options: Array<{code, display, system}>, total: number|undefined, truncated: boolean }} */
// `raw` keeps a missing display missing (instead of falling back to the code)
export function flattenExpansion(expansion, { raw = false } = {}) {
  const options = walk(expansion?.contains, [], raw);
  const total = typeof expansion?.total === 'number' ? expansion.total : undefined;
  return { options, total, truncated: total !== undefined && total > options.length };
}
