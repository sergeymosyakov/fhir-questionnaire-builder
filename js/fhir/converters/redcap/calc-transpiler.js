// ── REDCap calc formula → FHIRPath transpiler ─────────────────────────────────
//
// transpileCalc(formula) → FHIRPath string | null
//   Returns null for null/empty input.
//   Unsupported functions (datediff, age, stdev) are preserved as-is
//   and flagged by canTranspile() returning false.
//
// canTranspile(formula) → boolean
//   Returns false when the formula contains constructs we cannot convert.
//
// Supported REDCap → FHIRPath mappings:
//   [variable]     → %resource.repeat(item).where(linkId='variable').answer.first().valueDecimal
//   x ^ n          → x.power(n)
//   round(x, n)    → (x).round(n)
//   roundup(x, n)  → (x).ceiling()          (n ignored — FHIRPath ceiling() is integer)
//   rounddown(x,n) → (x).floor()            (n ignored)
//   sqrt(x)        → (x).sqrt()
//   abs(x)         → (x).abs()
//   floor(x)       → (x).floor()
//   ceiling(x)     → (x).ceiling()
//   ceil(x)        → (x).ceiling()
//   log(x)         → (x).ln()               (natural log)
//   log10(x)       → (x).log(10)
//   exp(x)         → (x).exp()
//   if(c, a, b)    → iif(c, a, b)
//   min(a, b)      → iif((a) < (b), a, b)
//   max(a, b)      → iif((a) > (b), a, b)
//   mean(a,b,...)  → (a + b + ...) / n
//   sum(a, b, ...) → (a + b + ...)
//   today()        → today()
//   <>             → !=
//
// Not supported (canTranspile returns false):
//   datediff, age, stdev, getdate, now, contains (string)

const RC_VAR_RE = /\[([a-z][a-z0-9_]*)\]/gi;
const UNSUPPORTED_RE = /\b(datediff|age-years|age|stdev|getdate)\s*\(/i;

/** FHIRPath navigation to a numeric answer on a QR item by linkId. */
function varRef(name) {
  return `%resource.repeat(item).where(linkId='${name}').answer.first().valueDecimal`;
}

/** Return position of the closing ')' matching the '(' at openPos. */
function closeParen(s, openPos) {
  let depth = 0;
  for (let i = openPos; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

/** Split comma-separated function arguments at depth 0. */
function splitArgs(s) {
  const args = [];
  let depth = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') depth--;
    else if (s[i] === ',' && depth === 0) {
      args.push(s.slice(start, i).trim());
      start = i + 1;
    }
  }
  const last = s.slice(start).trim();
  if (last || args.length > 0) args.push(last);
  return args.filter(a => a !== '');
}

/**
 * Extract the rightmost "token" from s:
 *  - If s ends with ')' → walk back to find matching '('
 *  - Otherwise → scan back while [\w.]
 * Returns { left: token, prefix: everything before token }.
 */
function extractLeftToken(s) {
  s = s.trimEnd();
  if (!s) return { left: '', prefix: '' };
  const last = s[s.length - 1];
  if (last === ')') {
    let depth = 0;
    for (let i = s.length - 1; i >= 0; i--) {
      if (s[i] === ')') depth++;
      else if (s[i] === '(') { depth--; if (depth === 0) return { left: s.slice(i), prefix: s.slice(0, i) }; }
    }
    return { left: s, prefix: '' };
  }
  let i = s.length - 1;
  while (i >= 0 && /[\w.]/.test(s[i])) i--;
  return { left: s.slice(i + 1), prefix: s.slice(0, i + 1) };
}

/**
 * Extract the leftmost "token" from s (after optional whitespace):
 *  - If starts with '(' → find matching ')'
 *  - Otherwise → read while [\w.] (possibly with leading '-')
 * Returns { right: token, rest: remainder }.
 */
function extractRightToken(s) {
  const trimmed = s.trimStart();
  if (!trimmed) return { right: '', rest: '' };
  if (trimmed[0] === '(') {
    const close = closeParen(trimmed, 0);
    if (close !== -1) return { right: trimmed.slice(0, close + 1), rest: trimmed.slice(close + 1) };
  }
  let i = 0;
  if (trimmed[i] === '-') i++;
  while (i < trimmed.length && /[\w.]/.test(trimmed[i])) i++;
  return { right: trimmed.slice(0, i), rest: trimmed.slice(i) };
}

/** Convert REDCap function name + pre-transpiled args to FHIRPath. */
function transformFn(fn, args) {
  const a = (n) => args[n] ?? '';
  switch (fn) {
    case 'round':     return `(${a(0)}).round(${a(1) !== '' ? a(1) : 0})`;
    case 'roundup':   return `(${a(0)}).ceiling()`;
    case 'rounddown': return `(${a(0)}).floor()`;
    case 'sqrt':      return `(${a(0)}).sqrt()`;
    case 'abs':       return `(${a(0)}).abs()`;
    case 'floor':     return `(${a(0)}).floor()`;
    case 'ceiling':
    case 'ceil':      return `(${a(0)}).ceiling()`;
    case 'log':       return `(${a(0)}).ln()`;
    case 'log10':     return `(${a(0)}).log(10)`;
    case 'exp':       return `(${a(0)}).exp()`;
    case 'if':        return `iif(${a(0)}, ${a(1)}, ${a(2)})`;
    case 'min':       return `iif((${a(0)}) < (${a(1)}), ${a(0)}, ${a(1)})`;
    case 'max':       return `iif((${a(0)}) > (${a(1)}), ${a(0)}, ${a(1)})`;
    case 'mean': {
      const n = args.length;
      return n === 0 ? '0' : `(${args.join(' + ')}) / ${n}`;
    }
    case 'sum':       return args.length === 0 ? '0' : `(${args.join(' + ')})`;
    case 'today':     return 'today()';
    default:          return `${fn}(${args.join(', ')})`;
  }
}

/** Replace all REDCap-style function calls in expr with FHIRPath equivalents. */
function replaceFunctions(expr) {
  const fnRe = /\b(round|roundup|rounddown|sqrt|abs|floor|ceiling|ceil|log10|log|exp|if|min|max|mean|sum|today)\s*\(/gi;
  let result = '';
  let lastIndex = 0;
  let match;
  fnRe.lastIndex = 0;

  while ((match = fnRe.exec(expr)) !== null) {
    const fnName = match[1].toLowerCase();
    const openParen = match.index + match[0].length - 1;
    const closePos = closeParen(expr, openParen);
    if (closePos === -1) break;

    const inner = expr.slice(openParen + 1, closePos);
    const rawArgs = splitArgs(inner);
    const transpiledArgs = rawArgs.map(a => transpileExpr(a)); // recurse

    result += expr.slice(lastIndex, match.index);
    result += transformFn(fnName, transpiledArgs);
    lastIndex = closePos + 1;
    fnRe.lastIndex = lastIndex;
  }
  result += expr.slice(lastIndex);
  return result;
}

/** Replace all depth-0 '^' operators with .power() calls. */
function replacePower(expr) {
  let changed = true;
  while (changed) {
    changed = false;
    let depth = 0;
    for (let i = 0; i < expr.length; i++) {
      if (expr[i] === '(') { depth++; continue; }
      if (expr[i] === ')') { depth--; continue; }
      if (expr[i] === '^' && depth === 0) {
        const leftPart  = expr.slice(0, i);
        const rightPart = expr.slice(i + 1);
        const { left, prefix } = extractLeftToken(leftPart);
        const { right, rest }  = extractRightToken(rightPart);
        expr = prefix + `${left}.power(${right})` + rest;
        changed = true;
        break;
      }
    }
  }
  return expr;
}

/** Core recursive transpiler for a single expression (no [var] replacement here). */
function transpileExpr(expr) {
  expr = expr.trim();
  expr = replaceFunctions(expr);
  expr = replacePower(expr);
  expr = expr.replace(/<>/g, '!=');
  return expr;
}

/**
 * Transpile a REDCap calc formula to a FHIRPath expression.
 * Returns null for null/empty input.
 */
export function transpileCalc(formula) {
  if (!formula || !formula.trim()) return null;
  let expr = formula.trim();
  // Step 1: Replace [variable] references
  expr = expr.replace(RC_VAR_RE, (_, name) => varRef(name));
  // Step 2: Transpile functions, power operator, operators
  expr = transpileExpr(expr);
  return expr;
}

/**
 * Returns false when the formula contains constructs we cannot convert to FHIRPath
 * (datediff, age, stdev, etc.). A false result means we should store the formula
 * in the round-trip extension only.
 */
export function canTranspile(formula) {
  if (!formula || !formula.trim()) return false;
  return !UNSUPPORTED_RE.test(formula);
}
