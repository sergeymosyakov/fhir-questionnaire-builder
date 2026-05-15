// ── FHIRPath boolean expression tree parser & evaluator ───────────────────────
// Splits a FHIRPath expression on top-level `and` / `or` / `not(...)` into a
// tree, then evaluates each node with fhirpath.evaluate().
//
// Node shapes:
//   { type: 'AND', children: Node[], result: boolean }
//   { type: 'OR',  children: Node[], result: boolean }
//   { type: 'NOT', child:    Node,   result: boolean }
//   { type: 'LEAF', expr: string,    result: boolean, error?: string }

// ── Parsing helpers ────────────────────────────────────────────────────────────

/**
 * Split `expr` on top-level occurrences of ` op ` (case-insensitive, word-
 * bounded by surrounding spaces), respecting paren depth and string literals.
 * Returns an array of trimmed sub-expressions, or [] if no split found.
 */
function splitOnOp(expr, op) {
  const parts = [];
  let depth = 0;
  let inStr  = null; // null | "'" | '"'
  let start  = 0;
  const kw   = ' ' + op + ' ';
  const kwl  = kw.length;
  const len  = expr.length;

  for (let i = 0; i < len; i++) {
    const ch = expr[i];
    if (inStr) {
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === "'" || ch === '"') { inStr = ch; continue; }
    if (ch === '(' || ch === '[' || ch === '{') { depth++; continue; }
    if (ch === ')' || ch === ']' || ch === '}') { depth--; continue; }
    if (depth === 0 && expr.slice(i, i + kwl).toLowerCase() === kw) {
      parts.push(expr.slice(start, i).trim());
      start = i + kwl;
      i    += kwl - 1;
    }
  }
  if (parts.length > 0) {
    parts.push(expr.slice(start).trim());
    return parts;
  }
  return [];
}

/**
 * If `expr` is entirely wrapped in one matching outer pair of parens, unwrap.
 * "(a and b)" → "a and b"   "(a) or (b)" → unchanged.
 */
function unwrapOuterParens(expr) {
  expr = expr.trim();
  if (!expr.startsWith('(')) return expr;
  let depth = 0;
  for (let i = 0; i < expr.length; i++) {
    if      (expr[i] === '(') depth++;
    else if (expr[i] === ')') {
      depth--;
      if (depth === 0) {
        return i === expr.length - 1 ? expr.slice(1, -1).trim() : expr;
      }
    }
  }
  return expr;
}

// ── Public: parse ─────────────────────────────────────────────────────────────

/**
 * Parse a FHIRPath boolean expression into an AND/OR/NOT/LEAF tree.
 * Operator precedence: or (lowest) → and → not (highest).
 */
export function parseExprTree(rawExpr) {
  const expr = unwrapOuterParens(rawExpr.trim());

  // not(...) — unary node
  const notMatch = /^not\s*\(([\s\S]+)\)$/i.exec(expr);
  if (notMatch) {
    return { type: 'NOT', child: parseExprTree(notMatch[1]) };
  }

  // Split on 'or' first (lower precedence in FHIRPath)
  const orParts = splitOnOp(expr, 'or');
  if (orParts.length >= 2) {
    return { type: 'OR', children: orParts.map(p => parseExprTree(p)) };
  }

  // Split on 'and'
  const andParts = splitOnOp(expr, 'and');
  if (andParts.length >= 2) {
    return { type: 'AND', children: andParts.map(p => parseExprTree(p)) };
  }

  // Leaf — evaluate as-is
  return { type: 'LEAF', expr };
}

// ── Public: evaluate ──────────────────────────────────────────────────────────

/**
 * Walk `node` and add `result: boolean | null` to every node.
 * `env` must match the format used by calc.js: `{ resource: qr, ...envVars }`.
 */
export function evaluateExprTree(node, fp, resource, env) {
  switch (node.type) {
    case 'LEAF': {
      try {
        const raw    = fp.evaluate(resource || {}, node.expr, env || {});
        const first  = Array.isArray(raw) ? raw[0] : raw;
        node.result  = first === true || first === 'true' ||
                       (typeof first === 'number' && first !== 0) ? true
                     : first === false || first === 'false' || first === 0 ? false
                     : raw.length > 0 ? true : false;
      } catch (e) {
        node.result = null;
        node.error  = e.message;
      }
      break;
    }
    case 'NOT': {
      evaluateExprTree(node.child, fp, resource, env);
      node.result = node.child.result === null ? null : !node.child.result;
      break;
    }
    case 'AND': {
      for (const c of node.children) evaluateExprTree(c, fp, resource, env);
      node.result = node.children.every(c => c.result === true);
      break;
    }
    case 'OR': {
      for (const c of node.children) evaluateExprTree(c, fp, resource, env);
      node.result = node.children.some(c => c.result === true);
      break;
    }
  }
  return node;
}
