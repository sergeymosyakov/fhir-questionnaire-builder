// ── Version compat checker: open-choice on upgrade to R5 ─────────────────────
// R5 removes the `open-choice` item type in favour of
// `choice + answerConstraint: 'optionsOrString'`.
// Warns when the tree contains open-choice items and the user switches any
// R4/R4B version to R5 (export will auto-convert, but it's a semantic change).

import { VersionCompatChecker, versionCompatRegistry } from '../version-compat-registry.js';

/** Recursively count items with itemType === 'open-choice'. */
function _countOpenChoice(nodes) {
  let n = 0;
  for (const node of nodes) {
    if (node.itemType === 'open-choice') n++;
    if (node.children?.length) n += _countOpenChoice(node.children);
  }
  return n;
}

class OpenChoiceToR5Checker extends VersionCompatChecker {
  applies(fromId, toId) {
    return toId === 'R5' && fromId !== 'R5';
  }

  check(_fromId, _toId, tree) {
    const count = _countOpenChoice(tree);
    if (count === 0) return [];
    return [
      `${count} open-choice item${count > 1 ? 's' : ''} will be exported as ` +
      `choice + answerConstraint: "optionsOrString" in R5 (R5 removes the open-choice type).`,
    ];
  }
}

versionCompatRegistry.register(new OpenChoiceToR5Checker());
