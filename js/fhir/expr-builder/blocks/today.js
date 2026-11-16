// Today's date: today().
import { registerBlock } from './registry.js';

export const TODAY = 'today';

export const today = () => ({ kind: TODAY });

registerBlock({
  kind: TODAY,
  atomic: true,
  emit: () => 'today()',
  describe: () => "today's date",
  formula: () => 'today',
  parseTerm: (term, { kids, identText }) => {
    const call = kids(term)[0];
    if (call?.type !== 'FunctionInvocation') return null;
    const fn = kids(call)[0];
    return identText(kids(fn)[0]) === 'today' && !kids(fn).some((c) => c.type === 'ParamList') ? today() : null;
  },
});
