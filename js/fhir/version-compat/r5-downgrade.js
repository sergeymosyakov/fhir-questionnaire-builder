// ── Version compat checker: R5-only fields on downgrade from R5 ───────────────
// Warns when the tree has items with `answerConstraint` set and the user
// switches from R5 to R4 or R4B.
// In R4 these are written as backport extensions; in R4B as native fields —
// so the user should know the semantics change on export.

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
    const dest = toId === 'R4B' ? 'R4B native field' : 'R4 backport extension';
    return [
      `${affected.length} item${affected.length > 1 ? 's' : ''} use answerConstraint ` +
      `(${affected.slice(0, 3).join(', ')}${affected.length > 3 ? ', …' : ''}). ` +
      `Will be written as ${dest} on export.`,
    ];
  }
}

versionCompatRegistry.register(new R5DowngradeChecker());
