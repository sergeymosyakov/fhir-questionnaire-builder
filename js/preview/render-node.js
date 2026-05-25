// ── Preview node DOM builders ──────────────────────────────────────────────────
// Thin dispatcher: delegates all DOM construction to node.renderPreview() defined in the
// node class hierarchy (base-node.js → group-node.js / item-node.js / display-node.js).
// _rc is populated by render-preview.js at module load time with stable refs and
// state helpers, so this module has no circular import on render-preview.js.

import { isMandatory, calcFormOk, evalConstraints, CHECKABLE_TYPES } from '../state.js';
import { GroupNode } from '../nodes/group-node.js';
import { NODE_REGISTRY, TextNode } from '../nodes/index.js';
import { _rc } from './render-ctx.js';

// Update group pass/fail icons from the current groupIconMap snapshot.
// Called after every control value change (onAfterChange callback).
export function updateGroupIcons() {
  const { ctx, groupIconMap } = _rc;
  for (const [, { icon, descendants, node }] of groupIconMap.entries()) {
    const relevant = descendants.filter(r =>
      (isMandatory(r.node) && CHECKABLE_TYPES.has(r.node.itemType)) ||
      (r.node._calculatedExpr && r.node._readOnly && r.node.itemType === 'checkbox') ||
      r.node.constraint?.length > 0 ||
      (r.node._minValue !== undefined || r.node._maxValue !== undefined)
    );
    if (relevant.length === 0) {
      icon.className   = 'icon-ok';
      icon.textContent = '\u2713';
      continue;
    }
    const itemOk = k => k.ok && calcFormOk(k.node) && (!k.node.constraint?.length || evalConstraints(k.node, ctx.fp, ctx.qr, ctx.envVars || {}));
    const ok = node.logicWithParent === 'OR'
      ? relevant.some(itemOk)
      : relevant.every(itemOk);
    icon.className   = ok ? 'icon-ok' : 'icon-fail';
    icon.textContent = ok ? '\u2713' : '\u2717';
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

// Set _rc.renderNode after this module loads so node classes can call it without
// importing render-node.js directly (avoids circular deps).
_rc.renderNode = renderPreviewNode;
