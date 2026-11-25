// "Check my form": which questions Show When leaves enabled for a set of answers — the same evaluation the preview uses.
import { evaluateNode } from '../../eval.js';

export const hasCondition = (n) => !!(n.enableWhen?.length || n.enableWhenExpression);

// A read-only answer store over the answers tried plus the values the calculations gave.
function storeOf(values, results) {
  return {
    getAll: (id) => {
      if (Object.hasOwn(values, id)) return values[id].filter((v) => v !== undefined);
      const calc = results[id];
      return calc === undefined || calc === null || calc === '' ? [] : [calc];
    },
  };
}

/** @returns {{ off: Set<string>, on: Set<string> }} ids of the questions that are disabled / enabled. */
export function enabledState(tree, { values, results, fp, qr, envVars }) {
  const entries = [];
  const ctx = { answerStore: storeOf(values, results), fp, qr, envVars };
  for (const n of tree) evaluateNode(n, ctx, entries);
  const off = new Set(entries.filter((e) => !e.visible || e.disabled).map((e) => e.node.id));
  const on = new Set(entries.filter((e) => e.visible && !e.disabled).map((e) => e.node.id));
  return { off, on };
}

const OPERATOR = { exists: 'has an answer' };
// A Show When condition as short text, for the report.
export function describeWhen(node, name) {
  const rows = (node.enableWhen ?? []).map((ew) => {
    const value = ew.answerBoolean ?? ew.answerString ?? ew.answerInteger ?? ew.answerDecimal ?? ew.answerCoding?.code ?? ew.answerCoding?.display ?? '';
    return ew.operator === 'exists' ? `${name(ew.question)} ${ew.answerBoolean === false ? 'has no answer' : OPERATOR.exists}` : `${name(ew.question)} ${ew.operator} ${value}`;
  });
  return rows.join(node.enableBehavior === 'any' ? ' or ' : ' and ');
}
