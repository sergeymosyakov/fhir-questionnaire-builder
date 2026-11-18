// ── FHIRPath calculatedExpression evaluation ──────────────────────────────────
// Evaluates all readOnly calc nodes in the tree and writes results to values[].

import { buildDepGraph, topoOrder } from './dep-graph.js';
import { buildAnswer, buildQR } from './qr-builder.js';
import { fhirModel } from './fhir-model.js';
import { joinCodes } from './checklist-codec.js';

// Pre-compute questionnaire-level SDC variables into an environment object.
// Variables are evaluated in order; later ones may reference earlier ones via %name.
export function buildVarEnv(variables, qr, fp) {
  const env = {};
  for (const v of variables) {
    if (!v.name || !v.expression) continue;
    try {
      const result = fp.evaluate(qr, v.expression, { resource: qr, ...env }, fhirModel());
      env[v.name] = Array.isArray(result) && result.length === 1 ? result[0] : result;
    } catch (_e) { /* skip variables whose expression fails */ }
  }
  return env;
}

// Flatten a tree of nodes into { id → node }.
function indexNodes(nodes, map = new Map()) {
  for (const node of nodes) {
    map.set(node.id, node);
    if (node.children?.length) indexNodes(node.children, map);
  }
  return map;
}

// Flatten a FHIR Questionnaire item tree into { linkId → fhirItem }, walking
// both nested item[] and answer[].item[].
function indexFhirItems(items, map = new Map()) {
  for (const it of items || []) {
    if (it.linkId) map.set(it.linkId, it);
    if (Array.isArray(it.item)) indexFhirItems(it.item, map);
    if (Array.isArray(it.answer)) {
      for (const a of it.answer) if (Array.isArray(a.item)) indexFhirItems(a.item, map);
    }
  }
  return map;
}

// Flatten a QuestionnaireResponse item tree into { linkId → qrItem } (references
// into the live QR so updates propagate to subsequent FHIRPath evaluations).
function indexQrItems(items, map = new Map()) {
  for (const it of items || []) {
    if (it.linkId) map.set(it.linkId, it);
    if (Array.isArray(it.item)) indexQrItems(it.item, map);
    if (Array.isArray(it.answer)) {
      for (const a of it.answer) if (Array.isArray(a.item)) indexQrItems(a.item, map);
    }
  }
  return map;
}

// Repeating groups above each node, outermost first: id → [groupId, …] (only nodes that sit inside one).
function repeatAncestors(nodes, above = [], map = new Map()) {
  for (const n of nodes) {
    if (above.length) map.set(n.id, above);
    if (n.children?.length) repeatAncestors(n.children, n.type === 'group' && n.repeats ? [...above, n.id] : above, map);
  }
  return map;
}

// Every combination of entries of the nested repeating groups: [{ path: [{ id, idx }], scope }], scope = that entry's answer map.
function entriesOf(values, groupIds) {
  let found = [{ path: [], scope: values }];
  for (const g of groupIds) {
    found = found.flatMap(({ path, scope }) => {
      const arr = Object.hasOwn(scope, g) ? scope[g] : undefined;
      if (!Array.isArray(arr)) return [];
      return arr.flatMap((inst, idx) => (inst && typeof inst === 'object' && !Array.isArray(inst) ? [{ path: [...path, { id: g, idx }], scope: inst }] : []));
    });
  }
  return found;
}

// The answer tree with every repeating group on `path` reduced to the one entry, so expressions see only that entry.
function scopeValues(values, path) {
  const root = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Array.isArray(v) ? v : [v]])); // a calc outside the group stored a bare value
  let cur = root;
  for (const { id, idx } of path) {
    const entry = { ...cur[id][idx] };
    cur[id] = [entry];
    cur = entry;
  }
  return root;
}

function findQrItem(items, id) {
  for (const it of items || []) {
    if (it.linkId === id) return it;
    const sub = findQrItem(it.item ?? it.answer?.[0]?.item, id);
    if (sub) return sub;
  }
  return null;
}

function findQrItems(items, id) {
  const out = [];
  for (const it of items || []) {
    if (it.linkId === id) out.push(it);
    else out.push(...findQrItems(it.item ?? it.answer?.[0]?.item, id));
  }
  return out;
}

// The QR item for `id` inside the entry at `path` of the full response.
function qrItemAt(qr, path, id) {
  let items = qr.item;
  for (const { id: g, idx } of path) {
    const entry = findQrItems(items, g)[idx];
    if (!entry) return null;
    items = entry.item;
  }
  return findQrItem(items, id);
}

// Writes a computed value into a QR item, keeping the nested child answers of a parent item.
function writeAnswer(qrItem, fhirItem, value) {
  const answer = buildAnswer(fhirItem, value);
  const prevItem = qrItem.answer?.[0]?.item;
  if (!answer) delete qrItem.answer;
  else {
    if (prevItem) answer.item = prevItem;
    qrItem.answer = [answer];
  }
}

const CHOICE_TYPES = new Set(['select', 'radio', 'open-choice', 'checklist']);

// One FHIRPath result element as the value its answer control stores (Coding → code,
// Quantity → { value, unit }, Reference → { reference }); String(object) would give "[object Object]".
function resultScalar(node, v) {
  if (v === null || v === undefined) return '';
  if (typeof v !== 'object') return String(v);
  // open-choice: a Coding result is a picked option; a plain string stays free text
  if (node.itemType === 'open-choice' && v.code !== undefined) {
    return { code: String(v.code), ...(v.display ? { display: String(v.display) } : {}), ...(v.system ? { system: String(v.system) } : {}) };
  }
  if (node.itemType === 'reference') {
    return { reference: String(v.reference ?? ''), ...(v.display ? { display: String(v.display) } : {}) };
  }
  if (node.itemType === 'quantity') {
    return { value: v.value, unit: v.code || v.unit || '', ...(v.system && v.code ? { system: v.system, code: v.code } : {}) };
  }
  // A Coding answers choice items by code; a Quantity answers numeric/text items by value
  if (CHOICE_TYPES.has(node.itemType) && v.code !== undefined) return String(v.code);
  if (v.value !== undefined) return String(v.value);
  return v.code !== undefined ? String(v.code) : '';
}

// Coerce a raw FHIRPath result into the value stored in values[] for a node.
function coerceResult(node, result) {
  if (node.itemType === 'checkbox') {
    return result[0] === true || result[0] === 'true';
  }
  if (!Array.isArray(result)) return '';
  if (node.itemType === 'reference' || node.itemType === 'quantity' || node.itemType === 'open-choice') {
    return result.length ? resultScalar(node, result[0]) : '';
  }
  const scalars = result.map(v => resultScalar(node, v));
  // a checklist keeps all selections in one encoded row
  return node.itemType === 'checklist' ? joinCodes(scalars) : scalars.join('');
}

// Evaluate all readOnly calculatedExpression nodes and write results to values[].
//
// Nodes are evaluated in topological dependency order so that calc chains
// (A → B → C) resolve correctly regardless of their order in the tree. When the
// raw Questionnaire `base` is supplied, each computed value is written back into
// the QuestionnaireResponse so dependent expressions read the fresh value within
// the same pass. Circular dependencies are evaluated best-effort in tree order.
//
// Pass a `cachedCtx` object (built by `buildCalcCache`) to avoid rebuilding the
// dependency graph and node index on every call — those are stable as long as
// the questionnaire structure doesn't change.
export function buildCalcCache(nodes, variables = []) {
  return {
    nodeMap: indexNodes(nodes),
    order:   topoOrder(buildDepGraph(nodes, variables)).order,
    repeatAnc: repeatAncestors(nodes),
  };
}

export function evalCalcNodes(nodes, qr, fp, values, envVars = {}, base = null, cachedCtx = null, resolve = undefined) {
  const env = { resource: qr, ...envVars };
  const nodeMap = cachedCtx?.nodeMap || indexNodes(nodes);
  const order   = cachedCtx?.order   || topoOrder(buildDepGraph(nodes, [])).order;
  const repeatAnc = cachedCtx?.repeatAnc || repeatAncestors(nodes);

  // Maps used to write computed values back into the live QR (only when base known).
  const fhirMap = base ? indexFhirItems(base.item) : null;
  const qrMap   = fhirMap ? indexQrItems(qr.item) : null;

  for (const id of order) {
    const node = nodeMap.get(id);
    // Evaluated regardless of readOnly — a non-readOnly calc field can be
    // overwritten by the user (validate.js already warns about this).
    if (!node || !node._calculatedExpr) continue;
    // Inside a repeating group the value is computed per entry, from that entry's answers.
    const entries = base && repeatAnc.has(id) ? entriesOf(values, repeatAnc.get(id)) : [];
    if (entries.length) {
      const fhirItem = fhirMap.get(id);
      for (const { path, scope } of entries) {
        try {
          const own = buildQR(base, scopeValues(values, path), resolve); // rebuilt each time so it holds every value written so far
          const value = coerceResult(node, fp.evaluate(own, node._calculatedExpr, { ...env, resource: own }, fhirModel()));
          scope[id] = [value];
          if (fhirItem) {
            const mainItem = qrItemAt(qr, path, id);
            if (mainItem) writeAnswer(mainItem, fhirItem, value);
          }
        } catch (_e) {
          // silently skip entries whose expression fails
        }
      }
      continue;
    }
    try {
      const result = fp.evaluate(qr, node._calculatedExpr, env, fhirModel());
      const value = coerceResult(node, result);
      values[node.id] = value;
      // Propagate into the live QR so downstream calc nodes see the new value.
      if (qrMap && fhirMap) {
        const qrItem = qrMap.get(node.id);
        const fhirItem = fhirMap.get(node.id);
        if (qrItem && fhirItem) {
          const answer = buildAnswer(fhirItem, value);
          // Preserve nested child answers (answer[0].item) for parent items that
          // have children — buildAnswer() only carries the value, so without this
          // the write-back would drop the child answers, corrupting the QR (and
          // any expression / downstream calc that traverses answer.item).
          const prevItem = qrItem.answer?.[0]?.item;
          if (!answer) delete qrItem.answer;
          else {
            if (prevItem) answer.item = prevItem;
            qrItem.answer = [answer];
          }
        }
      }
    } catch (_e) {
      // silently skip nodes whose expression fails
    }
  }
}

// Evaluate sdc-questionnaire-initialExpression on all nodes and write to values[].
// Called once on form load and on manual re-init (↺ button in Variables panel).
// `cqlValues` (nodeId -> value) carries pre-resolved text/cql-identifier results —
// see js/fhir/sdc-cql-eval.js; CQL execution is async and runs before this (sync) pass.
export function evalInitialExprNodes(nodes, qr, fp, values, envVars = {}, cqlValues = {}) {
  const env = { resource: qr, ...envVars };
  for (const node of nodes) {
    if (node._initialExprLanguage === 'text/cql-identifier') {
      if (node.id in cqlValues) values[node.id] = cqlValues[node.id];
    } else if (node._initialExpr) {
      try {
        const result = fp.evaluate(qr, node._initialExpr, env, fhirModel());
        values[node.id] = coerceResult(node, result);
      } catch (_e) {
        // silently skip nodes whose expression fails
      }
    }
    if (node.children?.length) evalInitialExprNodes(node.children, qr, fp, values, envVars, cqlValues);
  }
}

