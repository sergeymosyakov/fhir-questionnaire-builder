// ── Shared render context ──────────────────────────────────────────────────────
// Written by render-preview.js, read by node classes.
// Breaks the potential circular dependency between node classes and state.js.

export const _rc = {
  // Per-render-cycle (set at the start of each _asyncRender call):
  ctx:          null,      // { fp, qr, envVars } from _reCalc()
  resultMap:    null,      // Map(id → evalResult)
  cEnv:         {},        // ctx.envVars || {}
  visible:      [],        // visible eval results
  groupIconMap: null,      // Map of group id → { icon, descendants, node }
  previewMode:  'preview', // current preview mode string

  // Stable refs — set once by render-preview.js at module load time:
  viewPrefs:          null, // _viewPrefs object (mutated in-place on pref changes)
  lastCtx:            null, // _lastCtx object (mutated in-place by _reCalc)
  buildControl:       null, // function(node, iconEl, onAfterChange)
  values:             null, // reactive values object (for repeat row mutations)
  formTick:           null, // _formTick ref (injected from render-preview.js)
  updateGroupIcons:   null, // function() — GroupNode.updateAll(_rc); used as callback in item-node.js

  // State helpers — injected from state.js to avoid circular imports in node classes:
  isMandatory:    null, // function(node) → bool
  calcFormOk:     null, // function(node) → bool
  evalConstraints: null, // function(node, fp, qr, env) → bool
  getValue:       null, // function(id) → any
  CHECKABLE_TYPES: null, // Set<string>
};
