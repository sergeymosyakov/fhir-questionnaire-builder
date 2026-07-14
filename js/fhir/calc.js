// ── FHIRPath calculatedExpression evaluation ──────────────────────────────────
// Evaluates all readOnly calc nodes in the tree and writes results to values[].

import { buildDepGraph, topoOrder } from './dep-graph.js';
import { buildAnswer } from './qr-builder.js';

// Pre-compute questionnaire-level SDC variables into an environment object.
// Variables are evaluated in order; later ones may reference earlier ones via %name.
export function buildVarEnv(variables, qr, fp) {
  const env = {};
  for (const v of variables) {
    if (!v.name || !v.expression) continue;
    try {
      const result = fp.evaluate(qr, v.expression, { resource: qr, ...env });
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

// Coerce a raw FHIRPath result into the value stored in values[] for a node.
function coerceResult(node, result) {
  if (node.itemType === 'checkbox') {
    return result[0] === true || result[0] === 'true';
  }
  return Array.isArray(result) ? result.join('') : (result[0] !== undefined ? String(result[0]) : '');
}

// Evaluate all readOnly calculatedExpression nodes and write results to values[].
//
// Nodes are evaluated in topological dependency order so that calc chains
// (A → B → C) resolve correctly regardless of their order in the tree. When the
// raw Questionnaire `base` is supplied, each computed value is written back into
// the QuestionnaireResponse so dependent expressions read the fresh value within
// the same pass. Circular dependencies are evaluated best-effort in tree order.
export function evalCalcNodes(nodes, qr, fp, values, envVars = {}, base = null) {
  const env = { resource: qr, ...envVars };
  const nodeMap = indexNodes(nodes);
  const { order } = topoOrder(buildDepGraph(nodes, []));

  // Maps used to write computed values back into the live QR (only when base known).
  const fhirMap = base ? indexFhirItems(base.item) : null;
  const qrMap   = fhirMap ? indexQrItems(qr.item) : null;

  for (const id of order) {
    const node = nodeMap.get(id);
    if (!node || !(node._calculatedExpr && node._readOnly)) continue;
    try {
      const result = fp.evaluate(qr, node._calculatedExpr, env);
      const value = coerceResult(node, result);
      values[node.id] = value;
      // Propagate into the live QR so downstream calc nodes see the new value.
      if (qrMap && fhirMap) {
        const qrItem = qrMap.get(node.id);
        const fhirItem = fhirMap.get(node.id);
        if (qrItem && fhirItem) qrItem.answer = [buildAnswer(fhirItem, value)];
      }
    } catch (_e) {
      // silently skip nodes whose expression fails
    }
  }
}

// Evaluate sdc-questionnaire-initialExpression on all nodes and write to values[].
// Called once on form load and on manual re-init (↺ button in Variables panel).
export function evalInitialExprNodes(nodes, qr, fp, values, envVars = {}) {
  const env = { resource: qr, ...envVars };
  for (const node of nodes) {
    if (node._initialExpr) {
      try {
        const result = fp.evaluate(qr, node._initialExpr, env);
        if (node.itemType === 'checkbox') {
          values[node.id] = result[0] === true || result[0] === 'true';
        } else {
          values[node.id] = Array.isArray(result) ? result.join('') : (result[0] !== undefined ? String(result[0]) : '');
        }
      } catch (_e) {
        // silently skip nodes whose expression fails
      }
    }
    if (node.children?.length) evalInitialExprNodes(node.children, qr, fp, values, envVars);
  }
}
