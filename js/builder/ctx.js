/**
 * @file Declares the BuilderCtx type shared across all js/builder/ modules.
 * No runtime exports — import this file only for JSDoc tooling if needed.
 */

/**
 * Context object passed from index.js down to every node renderer and panel builder.
 *
 * @typedef {Object} BuilderCtx
 * @property {() => void}              renderTree  - Re-renders the entire tree into #treeContainer
 * @property {(node: Object) => Element} renderNode - Renders a single node (dispatches group/item)
 * @property {Object[]}                tree        - The root tree array (from state.js)
 * @property {Map<string, boolean>}    collapsed   - UI-only collapse state keyed by node.id
 */
