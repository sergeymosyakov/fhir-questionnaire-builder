// What the score operands share: which questions can carry a score (the coded ones) and how a set of linkIds maps
// back to them.
import { valueField } from '../../../fhir/expr-builder/value-paths.js';

/** Questions whose answers are codings (select, radio, checklist, open-choice) — the only ones that carry a score. */
export const codedItems = (items) => (items || []).filter((it) => valueField(it.itemType) === 'valueCoding');

/** The picker entries for these linkIds, in order, or null when any is unknown or ambiguous (the expression then stays text). */
export function entriesForLinkIds(items, linkIds) {
  const coded = codedItems(items);
  const entries = [];
  for (const id of linkIds) {
    const found = coded.filter((it) => it.id === id);
    if (found.length !== 1) return null;
    entries.push({ item: found[0] });
  }
  return entries;
}

/** The linkIds of the picked questions, or null while any is still empty. */
export function pickedLinkIds(entries) {
  const ids = entries.map((e) => e.item?.id);
  return ids.length && ids.every(Boolean) ? ids : null;
}
