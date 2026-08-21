// Maps a fhirpath.js parse CST into the block model (two-way editing). Pure over
// the CST: the browser calls fhirpath.parse(str), this maps the result. Anything
// not modeled collapses to a `raw` block so round-trips stay lossless.
import { itemRef, variable, literal, compare, logic, arith, exists, aggregate, raw, setLiteral, pipeline, mathFn, MATH_WRAP_FNS, BlockKind } from './model.js';
import { emit } from './emit.js';

// Public entry: parse a string via an injected fhirpath instance.
export function parseExpression(str, fp) {
  const text = (str || '').trim();
  if (!text) return null;
  try {
    const block = astToBlocks(fp.parse(text));
    return block || raw(text);
  } catch {
    return raw(text);
  }
}

// Pure CST → block. Returns null when a subtree is not modeled (caller falls to raw).
export function astToBlocks(node) {
  const n = unwrap(node);
  if (!n) return null;
  switch (n.type) {
    case 'OrExpression':
    case 'AndExpression':
      return mapLogic(n);
    case 'EqualityExpression':
    case 'InequalityExpression':
      return mapBinary(n, compare);
    case 'AdditiveExpression':
    case 'MultiplicativeExpression':
      return mapBinary(n, arith);
    case 'InvocationExpression':
    case 'TermExpression':
      return mapPathOrTerm(n);
    default:
      return null;
  }
}

// EntireExpression double-wraps the root; skip pure single-child wrappers.
function unwrap(node) {
  let n = node;
  while (n && n.type === 'EntireExpression' && (n.children || []).length === 1) n = n.children[0];
  return n;
}

const kids = (n) => n.children || [];

function mapLogic(n) {
  const op = n.text; // 'and' | 'or'
  const left = astToBlocks(kids(n)[0]);
  const right = astToBlocks(kids(n)[1]);
  if (!left || !right) return null;
  // Flatten same-op chains into a single N-ary logic block.
  const operands = [];
  for (const b of [left, right]) {
    if (b.kind === BlockKind.LOGIC && b.op === op) operands.push(...b.operands);
    else operands.push(b);
  }
  return logic(op, operands);
}

function mapBinary(n, make) {
  const left = astToBlocks(kids(n)[0]);
  const right = astToBlocks(kids(n)[1]);
  if (!left || !right) return null;
  return make(n.text, left, right);
}

// A path/term is either a plain term (variable/literal/parenthesized) or an
// invocation chain that we try to read as an item reference.
function mapPathOrTerm(n) {
  const { head, steps } = flatten(n);
  if (steps.length === 0) return mapTerm(head);
  return interpretPipeline(head, steps) || interpretPath(head, steps) || interpretMathWrap(head, steps);
}

// Flattens left-nested InvocationExpression into { head: term, steps: [...] }.
function flatten(node) {
  if (node.type === 'InvocationExpression') {
    const { head, steps } = flatten(kids(node)[0]);
    const step = stepFrom(kids(node)[1]);
    if (!step) return { head, steps: [...steps, { kind: 'bad' }] };
    return { head, steps: [...steps, step] };
  }
  return { head: node, steps: [] };
}

function stepFrom(inv) {
  if (!inv) return null;
  if (inv.type === 'MemberInvocation') return { kind: 'member', name: identText(inv) };
  if (inv.type === 'FunctionInvocation') {
    const fn = kids(inv)[0]; // Functn
    const name = identText(kids(fn)[0]);
    const paramList = kids(fn).find((c) => c.type === 'ParamList');
    return { kind: 'func', name, args: paramList ? kids(paramList) : [] };
  }
  return null;
}

// First Identifier descendant text.
function identText(node) {
  if (!node) return '';
  if (node.type === 'Identifier') return node.text;
  for (const c of kids(node)) {
    const t = identText(c);
    if (t) return t;
  }
  return '';
}

function mapTerm(term) {
  const t = unwrapTerm(term);
  if (!t) return null;
  switch (t.type) {
    case 'ExternalConstantTerm':
      return variable(identText(t));
    case 'LiteralTerm':
      return mapLiteral(t);
    case 'ParenthesizedTerm':
      return astToBlocks(kids(t)[0]);
    default:
      return null;
  }
}

function unwrapTerm(term) {
  let t = term;
  if (t && t.type === 'TermExpression') t = kids(t)[0];
  return t;
}

function mapLiteral(literalTerm) {
  const lit = kids(literalTerm)[0];
  if (!lit) return null;
  if (lit.type === 'StringLiteral') return literal('string', stripQuotes(lit.text));
  if (lit.type === 'NumberLiteral') return literal('number', Number(lit.text));
  if (lit.type === 'BooleanLiteral') return literal('boolean', lit.text === 'true');
  return null;
}

function stripQuotes(s) {
  const str = s || '';
  if (str.length >= 2 && str[0] === "'" && str[str.length - 1] === "'") {
    return str.slice(1, -1).replace(/\\'/g, "'");
  }
  return str;
}

// Reads `%resource.item.where(linkId='a')…answer.valueX` (optionally .exists()/
// .empty(), or a trailing aggregate .count()/.sum()/.avg()/.min()/.max()).
function interpretPath(head, rawSteps) {
  const steps = [...rawSteps];
  if (steps.some((s) => s.kind === 'bad')) return null;

  let tail = null;
  const last = steps[steps.length - 1];
  const mw = mathWrapOf(last);
  if (mw) { tail = { type: 'mathFn', ...mw }; steps.pop(); } else if (last && last.kind === 'func' && last.args.length === 0) {
    if (last.name === 'exists' || last.name === 'empty') { tail = { type: 'exists', negate: last.name === 'empty' }; steps.pop(); } else if (AGG_FNS.has(last.name)) { tail = { type: 'agg', fn: last.name }; steps.pop(); }
  }

  const anchored = isResourceTerm(head);
  const firstMember = firstMemberName(head);
  let start = steps;
  if (!anchored) {
    // Relative path must start at `item`.
    if (firstMember !== 'item') return null;
    start = [{ kind: 'member', name: 'item' }, ...steps];
  }

  const segments = [];
  const answerAt = [];
  let i = 0;
  while (i < start.length) {
    if (isMember(start[i], 'item') && whereLinkId(start[i + 1]) != null) {
      segments.push(whereLinkId(start[i + 1])); answerAt.push(false); i += 2;
    } else if (isMember(start[i], 'answer') && isMember(start[i + 1], 'item') && whereLinkId(start[i + 2]) != null) {
      // Item nested under the parent's answer (.answer.item.where).
      segments.push(whereLinkId(start[i + 2])); answerAt.push(true); i += 3;
    } else break;
  }
  const members = [];
  for (; i < start.length; i++) {
    if (start[i].kind !== 'member') return null;
    members.push(start[i].name);
  }
  const value = members[0] === 'answer' ? members.slice(1).join('.') : members.join('.');
  const ref = itemRef(segments, value, answerAt.some(Boolean) ? answerAt : []);
  if (segments.length === 0) return null;
  if (tail?.type === 'exists') return exists(ref, tail.negate);
  if (tail?.type === 'agg') return aggregate(tail.fn, ref);
  if (tail?.type === 'mathFn') return mathFn(tail.fn, tail.arg, ref);
  return ref;
}

const AGG_FNS = new Set(['count', 'sum', 'avg', 'min', 'max']);
const MATH_WRAP_FN_SET = new Set(MATH_WRAP_FNS);

// Reads a trailing round([n])/abs()/ceiling()/floor()/truncate() step. Returns
// { fn, arg } or null (not a recognized math-wrap step).
function mathWrapOf(step) {
  if (!step || step.kind !== 'func' || !MATH_WRAP_FN_SET.has(step.name)) return null;
  if (step.name !== 'round') return step.args.length === 0 ? { fn: step.name, arg: null } : null;
  if (step.args.length === 0) return { fn: 'round', arg: null };
  if (step.args.length !== 1) return null;
  const arg = numericLiteralArg(step.args[0]);
  return arg == null ? null : { fn: 'round', arg };
}

function numericLiteralArg(node) {
  const t = unwrapTerm(node);
  if (!t || t.type !== 'LiteralTerm') return null;
  const lit = mapLiteral(t);
  return lit && lit.dataType === 'number' ? lit.value : null;
}

// A trailing `.round(n)` / `.abs()` / … applied to a result that isn't itself a
// resource-path (e.g. `(a * b / c).round(1)`) — head is re-parsed as its own block.
function interpretMathWrap(head, steps) {
  if (steps.length !== 1) return null;
  const mw = mathWrapOf(steps[0]);
  if (!mw) return null;
  const target = astToBlocks(head);
  return target ? mathFn(mw.fn, mw.arg, target) : null;
}

// Reads a collection pipeline anchored at %resource.repeat(item).where(linkId='X'):
//   .answer<accessor> ( .intersect(set) | .exclude(set) | .distinct() )* [ reduce ]
// reduce = .join(sep) | .count()/.exists()/.first()/.last(). Returns a pipeline
// block or null (caller then tries interpretPath, else raw).
const PIPE_FILTER_NAMES = new Set(['intersect', 'exclude', 'distinct']);
const PIPE_REDUCE_NULLARY = new Set(['count', 'exists', 'first', 'last']);

function interpretPipeline(head, rawSteps) {
  const steps = [...rawSteps];
  if (steps.some((s) => s.kind === 'bad')) return null;
  if (!isResourceTerm(head)) return null;

  const s0 = steps[0];
  if (!(s0 && s0.kind === 'func' && s0.name === 'repeat' && s0.args.length === 1 && identText(s0.args[0]) === 'item')) return null;
  const linkId = whereLinkId(steps[1]);
  if (linkId == null) return null;

  let i = 2;
  const members = [];
  while (i < steps.length && steps[i].kind === 'member') { members.push(steps[i].name); i++; }
  if (members[0] !== 'answer') return null;
  const accessor = members.slice(1).join('.');

  const filters = [];
  while (i < steps.length && steps[i].kind === 'func' && (PIPE_FILTER_NAMES.has(steps[i].name) || steps[i].name === 'where')) {
    const st = steps[i];
    if (st.name === 'distinct') { if (st.args.length) return null; filters.push({ op: 'distinct' }); } else if (st.name === 'where') {
      if (st.args.length !== 1) return null;
      const cmp = parseCompareWhere(st.args[0]);
      if (!cmp) return null;
      filters.push(cmp);
    } else {
      const set = collectSetStrings(st.args[0]);
      if (!set) return null;
      filters.push({ op: st.name, set: setLiteral(set) });
    }
    i++;
  }

  let reduce = null;
  if (i < steps.length) {
    const st = steps[i];
    if (st.kind !== 'func') return null;
    if (st.name === 'join') { const sep = st.args.length ? stringLitOf(st.args[0]) : ''; if (sep == null) return null; reduce = { fn: 'join', sep }; } else if (PIPE_REDUCE_NULLARY.has(st.name) && st.args.length === 0) { reduce = { fn: st.name }; } else return null;
    i++;
  }
  if (i !== steps.length) return null;
  return pipeline({ linkId, accessor }, filters, reduce);
}

// All StringLiteral leaves of a set argument, in order: ('a'|'b'|'c') → [a,b,c].
function collectSetStrings(arg) {
  const out = [];
  collectStringLeaves(arg, out);
  return out.length ? out : null;
}

function collectStringLeaves(node, out) {
  if (!node) return;
  if (node.type === 'StringLiteral') { out.push(stripQuotes(node.text)); return; }
  for (const c of kids(node)) collectStringLeaves(c, out);
}

// A `where($this <op> literal)` value predicate → { op:'compare', cmp, value, dataType }.
const CMP_TYPES = new Set(['EqualityExpression', 'InequalityExpression']);
const CMP_OPS = new Set(['=', '!=', '>', '<', '>=', '<=']);

function parseCompareWhere(node) {
  if (!node || !CMP_TYPES.has(node.type) || !CMP_OPS.has(node.text)) return null;
  if (!isThisTerm(kids(node)[0])) return null;
  const litTerm = unwrapTerm(kids(node)[1]);
  if (!litTerm || litTerm.type !== 'LiteralTerm') return null;
  const lit = mapLiteral(litTerm);
  if (!lit || (lit.dataType !== 'number' && lit.dataType !== 'string')) return null;
  return { op: 'compare', cmp: node.text, value: lit.value, dataType: lit.dataType };
}

function isThisTerm(node) {
  const t = unwrapTerm(node);
  return !!t && t.type === 'InvocationTerm' && kids(t)[0]?.type === 'ThisInvocation';
}

function isResourceTerm(head) {
  const t = unwrapTerm(head);
  return !!t && t.type === 'ExternalConstantTerm' && identText(t) === 'resource';
}

function firstMemberName(head) {
  const t = unwrapTerm(head);
  if (t && t.type === 'InvocationTerm') return identText(t);
  return '';
}

const isMember = (step, name) => step && step.kind === 'member' && step.name === name;

// Returns the linkId string of a `where(linkId='X')` step, else null.
function whereLinkId(step) {
  if (!step || step.kind !== 'func' || step.name !== 'where' || step.args.length !== 1) return null;
  const eq = unwrap(step.args[0]);
  if (!eq || eq.type !== 'EqualityExpression' || eq.text !== '=') return null;
  const lhs = identOfTerm(kids(eq)[0]);
  const rhs = kids(eq)[1];
  if (lhs !== 'linkId') return null;
  const litTerm = unwrapTerm(rhs);
  if (!litTerm || litTerm.type !== 'LiteralTerm') return null;
  const lit = kids(litTerm)[0];
  if (!lit || lit.type !== 'StringLiteral') return null;
  return stripQuotes(lit.text);
}

function identOfTerm(node) {
  const t = unwrapTerm(node);
  if (t && t.type === 'InvocationTerm') return identText(t);
  return '';
}

// ── Expand a set-membership leaf into an AND/OR of per-item leaves ────────────
// `…item.where(linkId='a' or 'b' …)<suffix>` → one leaf per linkId, so each
// becomes an editable row with its own item picker. Reuses the real CST.
// Supported suffixes: allTrue/anyTrue/allFalse/anyFalse over booleans, and
// exists/empty. Returns { op, leaves } or null.
const SET_OP = {
  allTrue: { op: 'and', kind: 'bool', bool: true },
  allFalse: { op: 'and', kind: 'bool', bool: false },
  anyTrue: { op: 'or', kind: 'bool', bool: true },
  anyFalse: { op: 'or', kind: 'bool', bool: false },
  exists: { op: 'or', kind: 'exists', negate: false },
  empty: { op: 'and', kind: 'exists', negate: true },
};

export function expandAggregateOverSet(expr, fp) {
  let ast;
  try { ast = unwrap(fp.parse((expr || '').trim())); } catch { return null; }
  if (!ast || ast.type !== 'InvocationExpression') return null;
  const { head, steps } = flatten(ast);
  if (steps.some((s) => s.kind === 'bad')) return null;
  if (!isResourceTerm(head)) return null;

  const last = steps[steps.length - 1];
  if (!(last && last.kind === 'func' && last.args.length === 0 && SET_OP[last.name])) return null;
  const spec = SET_OP[last.name];
  const body = steps.slice(0, -1);

  const segs = []; // { ids: string[], answerAt: boolean }
  let i = 0;
  while (i < body.length) {
    if (isMember(body[i], 'item') && isWhere(body[i + 1])) {
      const ids = whereLinkIdSet(body[i + 1]); if (!ids) return null;
      segs.push({ ids, answerAt: false }); i += 2;
    } else if (isMember(body[i], 'answer') && isMember(body[i + 1], 'item') && isWhere(body[i + 2])) {
      const ids = whereLinkIdSet(body[i + 2]); if (!ids) return null;
      segs.push({ ids, answerAt: true }); i += 3;
    } else break;
  }
  const members = [];
  for (; i < body.length; i++) { if (body[i].kind !== 'member') return null; members.push(body[i].name); }
  const value = members[0] === 'answer' ? members.slice(1).join('.') : members.join('.');

  const setIdxs = segs.map((s, idx) => (s.ids.length > 1 ? idx : -1)).filter((x) => x >= 0);
  if (setIdxs.length !== 1) return null; // exactly one segment holds the set
  const setIdx = setIdxs[0];
  const answerAt = segs.map((s) => s.answerAt);
  const leaves = segs[setIdx].ids.map((id) => {
    const chain = segs.map((s, idx) => (idx === setIdx ? id : s.ids[0]));
    const at = answerAt.some(Boolean) ? answerAt : [];
    if (spec.kind === 'exists') return emit(exists(itemRef(chain, value, at), spec.negate));
    return emit(compare('=', itemRef(chain, value, at), literal('boolean', spec.bool)));
  });
  return { op: spec.op, leaves };
}

const isWhere = (step) => step && step.kind === 'func' && step.name === 'where';

// All linkId strings from a `where(linkId='a' or 'b' …)` step (set or single).
function whereLinkIdSet(step) {
  if (!isWhere(step) || step.args.length !== 1) return null;
  const ids = [];
  collectLinkIds(unwrap(step.args[0]), ids);
  return ids.length ? ids : null;
}

function collectLinkIds(node, ids) {
  if (!node) return;
  if (node.type === 'OrExpression') { kids(node).forEach((c) => collectLinkIds(c, ids)); return; }
  if (node.type === 'EqualityExpression' && node.text === '=') {
    if (identOfTerm(kids(node)[0]) === 'linkId') { const s = stringLitOf(kids(node)[1]); if (s != null) ids.push(s); }
    return;
  }
  const s = stringLitOf(node); // bare string operand of the or-chain
  if (s != null) ids.push(s);
}

function stringLitOf(node) {
  const t = unwrapTerm(node);
  if (t && t.type === 'LiteralTerm') {
    const lit = kids(t)[0];
    if (lit && lit.type === 'StringLiteral') return stripQuotes(lit.text);
  }
  return null;
}
