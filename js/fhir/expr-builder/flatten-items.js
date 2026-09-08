// Shared by ExpressionBuilderModal and ExpressionGalleryModal — walks the
// builder tree into a flat, answerable-item list for expression pickers.
import { hasAnswer } from './value-paths.js';

export const NUMERIC_TYPES = new Set(['integer', 'decimal', 'quantity']);

// Flattens the tree to answerable items, tracking the ancestor linkId chain and
// which segments are nested under a parent item's answer, so references emit an
// exact path.
export function flattenItems(nodes, ctx = { chain: [], at: [], parentType: 'group' }, out = []) {
  for (const n of nodes || []) {
    const segments = [...ctx.chain, n.id];
    const answerAt = [...ctx.at, ctx.parentType === 'item'];
    if (n.type === 'item' && hasAnswer(n.itemType)) {
      out.push({ id: n.id, label: n.title || n.id, itemType: n.itemType, options: n.options || '', segments, answerAt: answerAt.some(Boolean) ? answerAt : [] });
    }
    if (n.children?.length) flattenItems(n.children, { chain: segments, at: answerAt, parentType: n.type }, out);
  }
  return out;
}
