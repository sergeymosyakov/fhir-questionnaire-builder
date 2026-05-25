// ── Shared render context ──────────────────────────────────────────────────────
// Written by render-preview.js, read by render-node.js.
// Breaks the potential circular dependency between the two modules.

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
  collapsedGroups:    null, // collapsedGroups Set
  scrollToBuilder:    null, // function(nodeId)
  buildControl:       null, // function(node, iconEl, onAfterChange)
  buildRepeatControls: null, // function(node, iconEl, onAfterChange)
};
