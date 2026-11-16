// A calendar duration literal: 280 days, 1 week, 2 months. Added to or taken from a date.
import { registerBlock } from './registry.js';
import { literal } from '../model.js';

export const DURATION = 'duration';

export const DURATION_UNITS = ['year', 'month', 'week', 'day', 'hour', 'minute', 'second'];

// The unit without its plural "s": 'weeks' → 'week'; null for anything that is not a calendar unit.
export const unitBase = (unit) => {
  const base = String(unit).replace(/s$/, '');
  return DURATION_UNITS.includes(base) ? base : null;
};

// `unit` is kept as written ('week' / 'weeks') so a duration reads back exactly.
export const duration = (value, unit) => ({ kind: DURATION, value, unit });

registerBlock({
  kind: DURATION,
  atomic: true,
  emit: (b, { emit }) => `${emit(literal('number', b.value))} ${b.unit}`,
  describe: (b) => `${b.value} ${b.unit}`,
  formula: (b) => `${b.value} ${b.unit}`,
  parseTerm: (term, { kids }) => {
    const q = kids(term)[0];
    if (q?.type !== 'QuantityLiteral' || unitBase(q.unit) == null) return null;
    const value = Number(q.value);
    // Only an amount that reads back as the same text (not 1.50 or 01), so the result's own text never changes.
    return Number.isFinite(value) && String(value) === q.value ? duration(value, q.unit) : null;
  },
});
