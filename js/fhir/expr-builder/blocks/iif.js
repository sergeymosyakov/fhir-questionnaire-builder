// Conditional value: iif(condition, then[, otherwise]).
import { registerBlock } from './registry.js';

export const IIF = 'iif';

export const iif = (condition, then, otherwise = null) => ({ kind: IIF, condition, then, otherwise });

registerBlock({
  kind: IIF,
  emit: (b, { emit }) => `iif(${[b.condition, b.then, b.otherwise].filter(Boolean).map(emit).join(', ')})`,
  // A nested conditional is bracketed so "then if …, otherwise …, otherwise …" stays readable.
  describe: (b, { describe }) => {
    const part = (x) => { const t = describe(x); return t != null && x.kind === IIF ? `(${t})` : t; };
    const cond = part(b.condition);
    const then = part(b.then);
    const otherwise = b.otherwise ? part(b.otherwise) : '';
    if (cond == null || then == null || otherwise == null) return null;
    return `if ${cond}, then ${then}${b.otherwise ? `, otherwise ${otherwise}` : ''}`;
  },
  parseTerm: (term, { toBlock, kids, identText }) => {
    const fn = kids(term)[0]?.type === 'FunctionInvocation' ? kids(kids(term)[0])[0] : null; // Functn
    if (!fn || identText(kids(fn)[0]) !== 'iif') return null;
    const params = kids(fn).find((c) => c.type === 'ParamList');
    const args = params ? kids(params) : [];
    if (args.length < 2 || args.length > 3) return null;
    const parts = args.map(toBlock);
    return parts.some((p) => !p) ? null : iif(parts[0], parts[1], parts[2] ?? null);
  },
});
