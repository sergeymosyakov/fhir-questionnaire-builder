// Pure block model (AST-lite) for the visual FHIRPath expression builder.
// Blocks are plain tagged objects so they serialize and compare cleanly in tests.

export const BlockKind = {
  ITEM_REF: 'itemRef',
  VARIABLE: 'variable',
  LITERAL: 'literal',
  COMPARE: 'compare',
  LOGIC: 'logic',
  ARITH: 'arith',
  EXISTS: 'exists',
  AGGREGATE: 'aggregate',
  DESCENDANTS: 'descendants',
  SET_LITERAL: 'setLiteral',
  PIPELINE: 'pipeline',
  RAW: 'raw',
};

export const COMPARE_OPS = ['=', '!=', '>', '<', '>=', '<='];
export const ARITH_OPS = ['+', '-', '*', '/'];
export const LOGIC_OPS = ['and', 'or'];
export const AGG_FNS = ['count', 'sum', 'avg', 'min', 'max'];
// Collection pipeline: filters keep/drop members, reducers collapse to a scalar.
export const PIPE_FILTERS = ['intersect', 'exclude', 'distinct'];
export const PIPE_REDUCERS = ['join', 'count', 'exists', 'first', 'last'];

// itemRef.segments = ancestor→self linkId chain; value = accessor after `.answer.`;
// answerAt[i]=true means segment i is nested under the parent's answer (.answer.item).
export const itemRef = (segments, value = '', answerAt = []) => ({ kind: BlockKind.ITEM_REF, segments: [...segments], value, answerAt: [...answerAt] });
export const variable = (name) => ({ kind: BlockKind.VARIABLE, name });
export const literal = (dataType, value) => ({ kind: BlockKind.LITERAL, dataType, value });
export const compare = (op, left, right) => ({ kind: BlockKind.COMPARE, op, left, right });
export const logic = (op, operands) => ({ kind: BlockKind.LOGIC, op, operands: [...operands] });
export const arith = (op, left, right) => ({ kind: BlockKind.ARITH, op, left, right });
export const exists = (target, negate = false) => ({ kind: BlockKind.EXISTS, target, negate });
export const raw = (text) => ({ kind: BlockKind.RAW, text: text || '' });

// Aggregate a collection: source.(where(filter)).fn(). source = itemRef (a
// repeating item's answers) or descendants(). filter is a per-element condition.
export const aggregate = (fn, source, filter = null) => ({ kind: BlockKind.AGGREGATE, fn, source, filter });
export const descendants = () => ({ kind: BlockKind.DESCENDANTS });

// A parenthesized union of code/string literals: ('a'|'b'|'c').
export const setLiteral = (members, dataType = 'code') => ({ kind: BlockKind.SET_LITERAL, members: [...members], dataType });

// Collection pipeline over one item's answers:
//   source (choice item's answers + accessor) → filters[] → optional reduce.
// source = { linkId, accessor }; accessor is the path after `.answer.` (e.g.
// 'valueCoding.code'). filter = { op:'intersect'|'exclude', set } | { op:'distinct' }
//   | { op:'compare', cmp, value, dataType } (a `where($this <op> literal)` on the
//   element value — for numbers/strings/dates).
// reduce = { fn:'join', sep } | { fn:'count'|'exists'|'first'|'last' } | null.
export const pipeline = (source, filters = [], reduce = null) => ({
  kind: BlockKind.PIPELINE,
  source: { linkId: source.linkId, accessor: source.accessor || '' },
  filters: filters.map((f) => ({ ...f })),
  reduce: reduce ? { ...reduce } : null,
});
