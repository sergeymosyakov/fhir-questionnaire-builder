// ── Version compat checker: R5-only fields on downgrade from R5 ───────────────
// Warns when the tree has items with `answerConstraint` set and the user
// switches from R5 to R4 or R4B.
// Neither R4 nor R4B has the field, so it is written as a builder-private extension —
// the user should know it is no longer a native field on export.

import { VersionCompatChecker, versionCompatRegistry } from '../version-compat-registry.js';

/** Recursively collect linkIds of items that have _answerConstraint set. */
function _collectAffected(nodes, out) {
  for (const node of nodes) {
    if (node._answerConstraint) out.push(node.linkId || '(no linkId)');
    if (node.children?.length) _collectAffected(node.children, out);
  }
  return out;
}

class R5DowngradeChecker extends VersionCompatChecker {
  applies(fromId, toId) {
    return fromId === 'R5' && toId !== 'R5';
  }

  check(_fromId, toId, tree) {
    const affected = _collectAffected(tree, []);
    if (affected.length === 0) return [];
    return [
      `${affected.length} item${affected.length > 1 ? 's' : ''} use answerConstraint ` +
      `(${affected.slice(0, 3).join(', ')}${affected.length > 3 ? ', …' : ''}). ` +
      `${toId} has no such field, so it will be written as a builder-private extension on export.`,
    ];
  }
}

versionCompatRegistry.register(new R5DowngradeChecker());
