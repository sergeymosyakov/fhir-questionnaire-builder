// ── FHIR Questionnaire quality-audit report ───────────────────────────────────
// Pure function — no DOM, no side effects. Advisory only: unlike validate.js,
// nothing here blocks export or affects PASS/FAIL. Run on-demand only (see
// AuditValidator — gated to the explicit "Validate" click, never export/import).
// Duplicate linkId / empty text / circular dependencies are NOT re-checked here
// — those are already error/warning in validate.js.

import { buildDepGraph } from './dep-graph.js';

function _flatten(nodes, out = []) {
  for (const n of nodes) {
    out.push(n);
    if (n.children?.length) _flatten(n.children, out);
  }
  return out;
}

const _LOWER_BOUND_OPS = new Set(['>', '>=']);
const _UPPER_BOUND_OPS = new Set(['<', '<=']);

function _ewNumericValue(ew) {
  if (ew.answerInteger !== undefined) return ew.answerInteger;
  if (ew.answerDecimal !== undefined) return ew.answerDecimal;
  if (ew.answerQuantity !== undefined) return ew.answerQuantity.value;
  return undefined;
}

// Comparable identity for '='/'!=' across value types (mirrors eval.js's
// String()-coercion comparison semantics).
function _ewLiteralKey(ew) {
  if (ew.answerBoolean !== undefined) return String(ew.answerBoolean);
  if (ew.answerString  !== undefined) return ew.answerString;
  if (ew.answerInteger !== undefined) return String(ew.answerInteger);
  if (ew.answerDecimal !== undefined) return String(ew.answerDecimal);
  if (ew.answerCoding)                return ew.answerCoding.code || ew.answerCoding.display || '';
  return undefined;
}

function _describe(ew) {
  const lit = _ewLiteralKey(ew);
  const val = lit !== undefined ? JSON.stringify(lit) : _ewNumericValue(ew);
  return `${ew.operator} ${val}`;
}

function _rangeImpossible(lowerOp, lowerVal, upperOp, upperVal) {
  if (lowerVal > upperVal) return true;
  if (lowerVal === upperVal) return !(lowerOp === '>=' && upperOp === '<=');
  return false;
}

// Pairwise-impossible check for two enableWhen conditions on the same question.
function _isContradictory(a, b) {
  const aNum = _ewNumericValue(a), bNum = _ewNumericValue(b);
  if (aNum !== undefined && bNum !== undefined) {
    const aLower = _LOWER_BOUND_OPS.has(a.operator), aUpper = _UPPER_BOUND_OPS.has(a.operator);
    const bLower = _LOWER_BOUND_OPS.has(b.operator), bUpper = _UPPER_BOUND_OPS.has(b.operator);
    if (aLower && bUpper) return _rangeImpossible(a.operator, aNum, b.operator, bNum);
    if (bLower && aUpper) return _rangeImpossible(b.operator, bNum, a.operator, aNum);
    return false;
  }
  const aLit = _ewLiteralKey(a), bLit = _ewLiteralKey(b);
  if (aLit === undefined || bLit === undefined) return false;
  if (a.operator === '=' && b.operator === '=')  return aLit !== bLit;
  if (a.operator === '=' && b.operator === '!=') return aLit === bLit;
  if (a.operator === '!=' && b.operator === '=') return aLit === bLit;
  return false;
}

// Unreachable-item heuristic v1: pairwise-impossible conditions on the same
// non-repeating source question, within one ALL (enableBehavior) group. Does
// NOT analyze enableWhenExpression (arbitrary FHIRPath) or transitive
// unreachability through an always-false ancestor — general satisfiability
// is out of scope.
function _findContradictions(node, nodesById) {
  const out = [];
  if (!Array.isArray(node.enableWhen) || node.enableWhen.length < 2) return out;
  if (node.enableBehavior && node.enableBehavior !== 'all') return out;

  const byQuestion = new Map();
  for (const ew of node.enableWhen) {
    if (!ew?.question) continue;
    if (!byQuestion.has(ew.question)) byQuestion.set(ew.question, []);
    byQuestion.get(ew.question).push(ew);
  }

  for (const [qId, conds] of byQuestion) {
    if (nodesById.get(qId)?.repeats) continue; // ANY-match semantics — can't prove impossible
    for (let i = 0; i < conds.length; i++) {
      for (let j = i + 1; j < conds.length; j++) {
        if (_isContradictory(conds[i], conds[j])) {
          out.push(`condition on "${qId}" can never be satisfied \u2014 ${_describe(conds[i])} and ${_describe(conds[j])} cannot both be true`);
        }
      }
    }
  }
  return out;
}

/**
 * Advisory quality-audit report.
 * @param {Array} tree
 * @param {Array} variables — questDoc.variables (SDC %variable declarations)
 * @returns {{severity:'warning', nodeId:string, message:string}[]}
 */
export function auditTree(tree, variables = []) {
  const issues = [];
  const flat = _flatten(tree || []);
  const nodesById = new Map(flat.map(n => [n.id, n]));

  const { missing } = buildDepGraph(tree, variables);
  for (const [nodeId, refs] of missing) {
    for (const ref of refs) {
      issues.push({ severity: 'warning', nodeId, message: `References unknown linkId "${ref}" \u2014 this condition/expression can never match (no item or group has this linkId).` });
    }
  }

  for (const node of flat) {
    const id = node.id;

    if (node._answerValueSet && !node._answerValueSet.startsWith('#')) {
      issues.push({ severity: 'warning', nodeId: id, message: 'answerValueSet references an external terminology server with no local (#contained) fallback \u2014 this question shows no options if the server is unreachable.' });
    }

    for (const msg of _findContradictions(node, nodesById)) {
      issues.push({ severity: 'warning', nodeId: id, message: `Unreachable \u2014 ${msg}.` });
    }
  }

  return issues;
}
