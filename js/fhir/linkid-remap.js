// Rewrites linkIds of a FHIR item subtree (and every reference to them) so it can be inserted without collisions.
const LINKID_REF_RE = /(linkId\s*=\s*)(['"])([^'"]+)\2/g;
// `linkId in ('a' | 'b')` — every quoted id inside the list is a reference.
const LINKID_LIST_RE = /(linkId\s+in\s*\()([^)]*)(\))/g;
const QUOTED_RE = /(['"])([^'"]+)\1/g;
const SUFFIX_LEN = 4;
const MAX_SUFFIX_TRIES = 50;

export function collectLinkIds(item, out = []) {
  out.push(item.linkId);
  for (const c of item.item ?? []) collectLinkIds(c, out);
  return out;
}

/** linkIds (node ids) of a builder node tree. */
export function collectNodeIds(nodes, out = []) {
  for (const n of nodes) {
    out.push(n.id);
    if (n.children?.length) collectNodeIds(n.children, out);
  }
  return out;
}

/** linkIds referenced by `linkId = '…'` tokens in a FHIRPath expression. */
export function linkIdRefsIn(expr) {
  const refs = [...expr.matchAll(LINKID_REF_RE)].map(m => m[3]);
  for (const list of expr.matchAll(LINKID_LIST_RE)) refs.push(...[...list[2].matchAll(QUOTED_RE)].map(m => m[2]));
  return refs;
}

function randomSuffix() {
  const bytes = crypto.getRandomValues(new Uint8Array(SUFFIX_LEN));
  return Array.from(bytes, b => (b % 36).toString(36)).join('');
}

// Keeps ids as they are unless one collides; then ONE suffix is added to all ids of the subtree.
function suffixMap(ids, existing) {
  if (!ids.some(id => existing.has(id))) return new Map(ids.map(id => [id, id]));
  for (let i = 0; i < MAX_SUFFIX_TRIES; i++) {
    const suffix = randomSuffix();
    const mapped = ids.map(id => `${id}-${suffix}`);
    if (!mapped.some(id => existing.has(id))) return new Map(ids.map((id, n) => [id, mapped[n]]));
  }
  throw new Error('linkid-remap: could not find a free suffix');
}

// Copy semantics: every id becomes `<id>-copy`, `<id>-copy-2`, ... (first free).
function copyMap(ids, existing) {
  const taken = new Set(existing);
  const map = new Map();
  for (const id of ids) {
    let candidate = `${id}-copy`;
    for (let n = 2; taken.has(candidate); n++) candidate = `${id}-copy-${n}`;
    taken.add(candidate);
    map.set(id, candidate);
  }
  return map;
}

const STRATEGIES = { suffix: suffixMap, copy: copyMap };

const swap = (idMap, id, quote) => (idMap.has(id) ? `${quote}${idMap.get(id)}${quote}` : `${quote}${id}${quote}`);

function rewriteExpression(expr, idMap) {
  return expr
    .replace(LINKID_REF_RE, (m, head, quote, id) => head + swap(idMap, id, quote))
    .replace(LINKID_LIST_RE, (m, head, list, tail) =>
      head + list.replace(QUOTED_RE, (q, quote, id) => swap(idMap, id, quote)) + tail);
}

// Expression carriers: valueExpression anywhere in the extension tree, plus the constraint `expression` sub-extension's valueString.
function rewriteExtensions(extensions, idMap) {
  for (const ext of extensions ?? []) {
    if (ext.valueExpression?.expression) {
      ext.valueExpression.expression = rewriteExpression(ext.valueExpression.expression, idMap);
    }
    if (ext.url === 'expression' && typeof ext.valueString === 'string') {
      ext.valueString = rewriteExpression(ext.valueString, idMap);
    }
    rewriteExtensions(ext.extension, idMap);
  }
}

function rewriteItem(item, idMap) {
  item.linkId = idMap.get(item.linkId) ?? item.linkId;
  for (const ew of item.enableWhen ?? []) {
    if (idMap.has(ew.question)) ew.question = idMap.get(ew.question);
  }
  rewriteExtensions(item.extension, idMap);
  for (const c of item.item ?? []) rewriteItem(c, idMap);
}

/**
 * @param {object} fhirItem   item subtree (not mutated)
 * @param {Iterable<string>} existingIds linkIds already used in the target questionnaire
 * @param {'suffix'|'copy'} strategy
 * @returns {{remapped: object, idMap: Map<string,string>}}
 */
export function remapSubtree(fhirItem, existingIds, strategy = 'suffix') {
  const idMap = STRATEGIES[strategy](collectLinkIds(fhirItem), new Set(existingIds));
  const remapped = structuredClone(fhirItem);
  rewriteItem(remapped, idMap);
  return { remapped, idMap };
}
