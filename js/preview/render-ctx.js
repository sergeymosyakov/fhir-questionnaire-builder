// ── Shared render context ──────────────────────────────────────────────────────
// Written by preview-form.js (PreviewForm class), read by node classes.
// Breaks the potential circular dependency between node classes and the document model.

export const _rc = {
  // Per-render-cycle (set at the start of each _asyncRender call):
  ctx:          null,      // { fp, qr, envVars } from _reCalc()
  resultMap:    null,      // Map(id → evalResult)
  cEnv:         {},        // ctx.envVars || {}
  visible:      [],        // visible eval results
  groupIconMap: null,      // Map of group id → { icon, descendants, node }
  previewMode:  'preview', // current preview mode string

  // Stable refs — set once by PreviewForm constructor:
  viewPrefs:          null, // _viewPrefs object (mutated in-place on pref changes)
  lastCtx:            null, // _lastCtx object (mutated in-place by _reCalc)
  buildControl:       null, // function(node, iconEl, onAfterChange)
  values:             null, // values object (for repeat row mutations)
  updateGroupIcons:   null, // function() — GroupNode.updateAll(_rc); used as callback in item-node.js

  // State helpers — injected to avoid circular imports in node classes:
  isMandatory:    null, // function(node) → bool
  calcFormOk:     null, // function(node) → bool
  evalConstraints: null, // function(node, fp, qr, env) → bool
  getValue:       null, // function(id) → any
  getAll:         null, // function(id) → any[]  (all answers incl. repeat rows)
  CHECKABLE_TYPES: null, // Set<string>
};
