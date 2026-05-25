// ── Preview node DOM builders ─────────────────────────────────────────────────
// Thin dispatcher: delegates all DOM construction to node.renderPreview() defined
// in the node class hierarchy (base-node.js → group-node.js / item-node.js /
// display-node.js). _rc is populated by render-preview.js at module load time.

import { GroupNode } from '../nodes/group-node.js';
import { NODE_REGISTRY, TextNode } from '../nodes/index.js';
import { _rc } from './render-ctx.js';

// Refresh pass/fail icons on all rendered groups after a value change.
// Delegates icon evaluation logic to GroupNode.refreshIcon() — each group
// knows its own descendants list and logicWithParent.
export function updateGroupIcons() {
  for (const [, { node }] of _rc.groupIconMap.entries()) {
    GroupNode.prototype.refreshIcon.call(node, _rc);
  }
}

// Render a single preview node (and its children) into container.
// Dispatches to node.renderPreview() via the NODE_REGISTRY or GroupNode prototype.
export function renderPreviewNode(res, container) {
  if (!res) return;
  const node = res.node;
  if (node.type === 'group') {
    GroupNode.prototype.renderPreview.call(node, res, container, _rc);
  } else {
    const Cls = NODE_REGISTRY.get(node.itemType) ?? TextNode;
    Cls.prototype.renderPreview.call(node, res, container, _rc);
  }
}

// Set stable refs on _rc so node classes can call back without importing
// render-node.js directly (avoids circular deps).
_rc.renderNode       = renderPreviewNode;
_rc.updateGroupIcons = updateGroupIcons;
