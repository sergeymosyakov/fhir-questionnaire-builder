// Finds system/display for a code of a value-set-backed choice item (QR build is pure and gets this injected).
const own = (obj, key) => (obj && Object.hasOwn(obj, key) ? obj[key] : undefined);

function fromNode(node, code) {
  const raw = (node._rawAnswerOptions || []).find(o => o.valueCoding && o.valueCoding.code === code);
  if (raw) return { system: raw.valueCoding.system, display: raw.valueCoding.display };
  const cached = (node._vsCache || []).find(o => o.code === code);
  return cached ? { system: cached.system, display: cached.display } : null;
}

/**
 * @param {Array} tree builder tree
 * @param {object} [remembered] { linkId: { code: { system?, display? } } } from a loaded response
 * @returns {(linkId: string, code: string) => ({ system?: string, display?: string } | null)}
 */
export function makeCodingResolver(tree, remembered) {
  let index;
  const nodeOf = id => {
    if (!index) {
      index = new Map();
      const walk = nodes => { for (const n of nodes || []) { if (n.id) index.set(n.id, n); walk(n.children); } };
      walk(tree);
    }
    return index.get(id);
  };
  return (linkId, code) => {
    const node = nodeOf(linkId);
    const found = node ? fromNode(node, code) : null;
    const kept  = own(own(remembered, linkId), code);
    // the question's own value set wins; a loaded response fills in whatever it does not know
    const system  = found?.system  || kept?.system;
    const display = found?.display || kept?.display;
    return system || display ? { ...(system ? { system } : {}), ...(display ? { display } : {}) } : null;
  };
}

/** Codings carried by the answers of a QuestionnaireResponse: { linkId: { code: { system?, display? } } }. */
export function collectResponseCodings(items, out = Object.create(null)) {
  for (const item of items || []) {
    if (!item.linkId || item.linkId === '__proto__') continue;
    for (const ans of item.answer || []) {
      const c = ans.valueCoding;
      if (c?.code && (c.system || c.display)) {
        (out[item.linkId] ||= Object.create(null))[c.code] = { ...(c.system ? { system: c.system } : {}), ...(c.display ? { display: c.display } : {}) };
      }
      collectResponseCodings(ans.item, out);
    }
    collectResponseCodings(item.item, out);
  }
  return out;
}
