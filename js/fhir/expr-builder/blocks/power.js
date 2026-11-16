// A power: base.power(exponent), e.g. a cube root as .power(1 / 3).
import { registerBlock } from './registry.js';
import { BlockKind } from '../model.js';

export const POWER = 'power';

export const power = (base, exponent) => ({ kind: POWER, base, exponent });

const compound = (b) => b?.kind === BlockKind.ARITH;

registerBlock({
  kind: POWER,
  emit: (b, { emit, wrapTarget }) => `${wrapTarget(b.base)}.power(${emit(b.exponent)})`,
  describe: (b, { describe }) => {
    const part = (x) => { const t = describe(x); return t != null && compound(x) ? `(${t})` : t; };
    const base = part(b.base);
    const exponent = part(b.exponent);
    return base == null || exponent == null ? null : `${base} to the power of ${exponent}`;
  },
  formula: (b, labelOf, text) => {
    const part = (x) => (compound(x) ? `(${text(x)})` : text(x));
    return `${part(b.base)} ^ ${part(b.exponent)}`;
  },
  // receiver() is the base; the one argument is the exponent.
  parsePath: ({ steps, receiver }, { toBlock }) => {
    const step = steps[steps.length - 1];
    if (step?.kind !== 'func' || step.name !== 'power' || step.args.length !== 1 || steps.some((s) => s.kind === 'bad')) return null;
    const base = receiver();
    const exponent = toBlock(step.args[0]);
    return base && exponent ? power(base, exponent) : null;
  },
});
