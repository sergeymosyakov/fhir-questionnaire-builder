// ── Change an item node's answer type ─────────────────────────────────────────
// Shared core used by both the Answer Type modal (js/ui/modals/answer-type/) and
// the inline Simple-mode type selector. Keeps the type-swap logic in one place
// so the two entry points can never diverge.
//
// Imports the leaf `registry.js` (not `index.js`) to avoid a circular import:
// `index.js` pulls in every node subclass, several of which import this file's
// consumers. The registry is populated by the node modules' self-registration.
import { NODE_REGISTRY } from './registry.js';
import { AppEvents } from '../events.js';

// Replace a node in the tree array by id (recursive, in-place splice).
function replaceInTree(treeArr, nodeId, newNode) {
  for (let i = 0; i < treeArr.length; i++) {
    if (treeArr[i].id === nodeId) { treeArr.splice(i, 1, newNode); return true; }
    if (treeArr[i].children && replaceInTree(treeArr[i].children, nodeId, newNode)) return true;
  }
  return false;
}

/**
 * Change an item node's answer type. When the type actually changes, stored
 * answers for the node (and its repeat rows) are cleared. A new node of the
 * target class is created (preserving id and all copyable props), spliced into
 * the tree in place of the old one, and its `repeats` flag normalised for the
 * new type. Returns the new node instance.
 *
 * Does NOT dispatch BUILDER_RERENDER / CALC_RECALC_REQUESTED — the caller
 * decides when to re-render (the modal also runs section commits first).
 *
 * @param {object} node        current node instance
 * @param {string} newType     target itemType
 * @param {Array}  [tree]      questDoc.tree (splice target); optional for tests
 * @param {object} [answerStore] answerStore (to read `$$n` repeat count)
 * @returns {object} the new node instance
 */
export function changeNodeType(node, newType, tree, answerStore) {
  if (node.itemType !== newType) {
    const id = node.id;
    if (typeof document !== 'undefined') {
      document.dispatchEvent(new CustomEvent(AppEvents.ANSWER_DELETE, { detail: { id } }));
      const n = answerStore?.data[id + '$$n'] || 0;
      for (let i = 1; i <= n; i++) {
        document.dispatchEvent(new CustomEvent(AppEvents.ANSWER_DELETE, { detail: { id: id + '$$' + i } }));
      }
      document.dispatchEvent(new CustomEvent(AppEvents.ANSWER_DELETE, { detail: { id: id + '$$n' } }));
    }
  }

  const Cls = NODE_REGISTRY.get(newType) ?? NODE_REGISTRY.get('text');
  const newNode = new Cls({ title: node.title || 'New Item', id: node.id, itemType: newType });
  Object.assign(newNode, node, { itemType: newType });
  if (tree) replaceInTree(tree, node.id, newNode);

  if (newNode.impliesRepeats()) {
    newNode.repeats = true;
  } else if (!newNode.supportsRepeat() && newNode.repeats) {
    newNode.repeats = false;
    delete newNode._minOccurs;
    delete newNode._maxOccurs;
  }

  return newNode;
}

// Choice-family answer types whose answers are defined in the Answer Type dialog.
const CHOICE_ANSWER_TYPES = new Set(['select', 'radio', 'open-choice', 'checklist']);

/**
 * True for answer types whose answers must be configured in the Answer Type
 * dialog (choice family: options / value set / expression). Used to keep the
 * inline config button highlighted so it's clear the setup lives in the modal
 * — regardless of whether options have been added yet.
 * @param {object} node
 * @returns {boolean}
 */
export function nodeTypeNeedsConfig(node) {
  return !!node && CHOICE_ANSWER_TYPES.has(node.itemType);
}

/**
 * True when a non-choice item has at least one Answer Type setting configured
 * (regex, min/max, unit, entryFormat, slider step, attachment constraints, etc.).
 * Used to show the "active" (blue) state on the config button so the user knows
 * there is something configured in the Answer Type dialog.
 * @param {object} node
 * @returns {boolean}
 */
export function nodeHasTypeConfig(node) {
  if (!node) return false;
  return !!(
    node._regex ||
    node._minValue !== undefined ||
    node._maxValue !== undefined ||
    node._sliderStep !== undefined ||
    node.quantityUnit ||
    node._unitValueSet ||
    node._unitOptions?.length ||
    node._entryFormat ||
    node._maxDecimalPlaces !== undefined ||
    node._mimeTypes?.length ||
    node._maxFileSizeMB !== undefined ||
    node._itemControl ||
    node._choiceOrientation ||
    node._columnCount ||
    node._openLabel ||
    node._answerConstraint ||
    node._itemMedia?.url
  );
}

