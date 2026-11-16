// "No value": the empty collection {}.
import { registerBlock } from './registry.js';

export const EMPTY = 'empty';

export const empty = () => ({ kind: EMPTY });

registerBlock({
  kind: EMPTY,
  emit: () => '{}',
  describe: () => 'no value',
  parseTerm: (term, { kids }) => (kids(term)[0]?.type === 'NullLiteral' ? empty() : null),
});
