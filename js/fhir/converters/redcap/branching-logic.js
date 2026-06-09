// ── REDCap Branching Logic ↔ FHIR enableWhen ─────────────────────────────────
//
// REDCap branching logic syntax (subset we handle):
//   [variable] = '1'           →  equal (string/code)
//   [variable] <> '1'          →  not-equal
//   [variable] != '1'          →  not-equal (alternative syntax)
//   [variable] > 2             →  greater-than (numeric)
//   [variable] >= 2            →  greater-or-equal
//   [variable] < 2             →  less-than
//   [variable] <= 2            →  less-or-equal
//   expr AND expr              →  all (enableBehavior='all')
//   expr OR  expr              →  any (enableBehavior='any')
//   (expr)                     →  grouping — only one nesting level
//
// Mixed AND/OR at the same level returns null (too complex → store as extension).
//
// FHIR enableWhen → REDCap branching is the reverse mapping.

// ── Helpers ───────────────────────────────────────────────────────────────────

const OP_MAP = {
  '=':  'equal',  '!=': 'not-equal', '<>': 'not-equal',
  '>':  '>',      '>=': '>=',
  '<':  '<',      '<=': '<=',
};

// Reverse: FHIR operator → REDCap operator
const FHIR_OP_TO_REDCAP = {
  'equal':     '=',
  'not-equal': '<>',
  'exists':    null,   // can't represent cleanly
  '>':  '>',  '>=': '>=', '<': '<', '<=': '<=',
};

/**
 * Parse a single comparison clause: [variable] op 'value' or [variable] op number.
 * Returns null if the clause doesn't match the expected pattern.
 *
 * @param {string} clause
 * @returns {{ question: string, operator: string, value: string|number }|null}
 */
function parseClause(clause) {
  clause = clause.trim();
  // Match [variable] followed by operator then value
  const m = clause.match(/^\[([^\]]+)\]\s*(<=|>=|<>|!=|[=<>])\s*(.+)$/);
  if (!m) return null;

  const [, variable, rawOp, rawVal] = m;
  const operator = OP_MAP[rawOp];
  if (!operator) return null;

  let value;
  // Unquote string values
  const quotedStr = rawVal.match(/^['"](.*)['"]$/);
  if (quotedStr) {
    value = quotedStr[1];
  } else {
    // Numeric
    const num = Number(rawVal.trim());
    value = isNaN(num) ? rawVal.trim() : num;
  }

  return { question: variable, operator, value };
}

/**
 * Split expression by a top-level logical operator (AND or OR),
 * respecting parentheses.
 *
 * @param {string} expr
 * @param {string} op  'AND' or 'OR'
 * @returns {string[]|null}  null if op not found at top level
 */
function splitByOp(expr, op) {
  const parts = [];
  let last = 0;
  const upper = expr.toUpperCase();
  const pat = new RegExp(`\\b${op}\\b`, 'g');
  let m;
  while ((m = pat.exec(upper)) !== null) {
    // Count parens before this position
    const before = expr.slice(0, m.index);
    const depth = (before.match(/\(/g) || []).length - (before.match(/\)/g) || []).length;
    if (depth === 0) {
      parts.push(expr.slice(last, m.index).trim());
      last = m.index + m[0].length;
    }
  }
  if (parts.length === 0) return null;
  parts.push(expr.slice(last).trim());
  return parts;
}

/**
 * Convert a REDCap branching logic expression to FHIR enableWhen array.
 *
 * @param {string} expr  REDCap branching logic string.
 * @returns {{ enableWhen: Array, enableBehavior: 'all'|'any' }|null}
 *          null if expression is too complex to represent in FHIR enableWhen.
 */
export function branchingToEnableWhen(expr) {
  if (!expr || !expr.trim()) return null;

  expr = expr.trim();

  // Detect logical operator at top level
  const andParts = splitByOp(expr, 'AND');
  const orParts  = splitByOp(expr, 'OR');

  let behavior;
  let clauses;

  if (andParts && !orParts) {
    behavior = 'all';
    clauses  = andParts;
  } else if (orParts && !andParts) {
    behavior = 'any';
    clauses  = orParts;
  } else if (!andParts && !orParts) {
    // Single clause
    behavior = 'all';
    clauses  = [expr];
  } else {
    // Mixed AND/OR — too complex
    return null;
  }

  const enableWhen = [];
  for (let clause of clauses) {
    // Strip wrapping parens
    clause = clause.trim().replace(/^\((.+)\)$/, '$1').trim();

    const parsed = parseClause(clause);
    if (!parsed) return null; // unrecognised syntax

    const ew = { question: parsed.question, operator: parsed.operator };

    if (typeof parsed.value === 'number') {
      ew.answerDecimal = parsed.value;
    } else {
      ew.answerCoding = { code: String(parsed.value) };
    }

    enableWhen.push(ew);
  }

  return { enableWhen, enableBehavior: behavior };
}

/**
 * Convert FHIR enableWhen array back to REDCap branching logic string.
 *
 * @param {Array}  enableWhen
 * @param {'all'|'any'} enableBehavior
 * @returns {string}
 */
export function enableWhenToBranching(enableWhen, enableBehavior) {
  if (!enableWhen || enableWhen.length === 0) return '';

  const op = enableBehavior === 'any' ? ' OR ' : ' AND ';

  const parts = enableWhen.map(ew => {
    const question = `[${ew.question}]`;
    const fhirOp = ew.operator || 'equal';
    const redcapOp = FHIR_OP_TO_REDCAP[fhirOp] ?? '=';

    let val;
    if (ew.answerDecimal !== undefined)       val = String(ew.answerDecimal);
    else if (ew.answerInteger !== undefined)   val = String(ew.answerInteger);
    else if (ew.answerBoolean !== undefined)   val = ew.answerBoolean ? '1' : '0';
    else if (ew.answerCoding?.code !== undefined) val = `'${ew.answerCoding.code}'`;
    else if (ew.answerString !== undefined)    val = `'${ew.answerString}'`;
    else                                       val = "''";

    return `${question} ${redcapOp} ${val}`;
  });

  return parts.length === 1 ? parts[0] : parts.map(p => `(${p})`).join(op);
}
