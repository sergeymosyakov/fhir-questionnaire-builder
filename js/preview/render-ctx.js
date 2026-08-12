import { UI_STRINGS } from '../fhir/ui-strings.js';
import { defaultBus } from '../core/events/bus.js';
// ── Shared render context ───────────────────────────────────────────────────────
// Written by the renderer (PreviewRenderer / PreviewForm), read by node classes.
// Breaks the potential circular dependency between node classes and the document model.
//
// `createRenderCtx()` produces a fresh, isolated context so each renderer instance
// (e.g. an embedded widget) can have its own. `_rc` is the app's default singleton
// (also read by builder tooling — fhirpath console, expression builder).

export function createRenderCtx() {
  return {
    // Session event bus (set by the renderer). Nodes wire preview-scoped listeners
    // (scroll-to, calc-badge refresh, collapse/expand) here so embedded widgets on
    // their own bus stay isolated from the page.
    bus:          defaultBus,
    // Per-render-cycle (set at the start of each _asyncRender call):
    ctx:          null,      // { fp, qr, envVars } from _reCalc()
    resultMap:    null,      // Map(id → evalResult)
    cEnv:         {},        // ctx.envVars || {}
    visible:      [],        // visible eval results
    groupIconMap: null,      // Map of group id → { icon, descendants, node }
    previewMode:  'preview', // current preview mode string

    // Stable refs — set once by the renderer constructor:
    viewPrefs:          null, // _viewPrefs object (mutated in-place on pref changes)
    lastCtx:            null, // _lastCtx object (mutated in-place by _reCalc)
    buildControl:       null, // function(node, iconEl, onAfterChange)
    updateGroupIcons:   null, // function() — GroupNode.updateAll(_rc); used as callback in item-node.js

    // State helpers — injected to avoid circular imports in node classes:
    isMandatory:    null, // function(node) → bool
    calcFormOk:     null, // function(node) → bool
    evalConstraints: null, // function(node, fp, qr, env) → bool
    getValue:       null, // function(id) → any
    getAll:         null, // function(id) → any[]  (all answers incl. repeat rows)
    set:            null, // function(id, v) — write a single answer (repeat rows)
    remove:         null, // function(id) — delete a single answer (repeat rows)
    CHECKABLE_TYPES: null, // Set<string>

    // Repeating-group instance context (set during render):
    instancePath:   [],   // [{ id, idx }, …] — current repeating-group instance scope
    instanceCount:  null, // function(groupId, path) → number
    addInstance:    null, // function(groupId, path) → new count
    removeInstance: null, // function(groupId, idx, path)
    evalChildren:   null, // function(children, path) → results[] — per-instance eval

    // Active translation language ('' = show original source language)
    activeLanguage: '',
    // translations store — same reference as questDoc.translations
    translations:   null,

    // Surface-configurable chrome (default off; app shell opts in):
    showNavBtn:  false, // '↗' go-to-builder arrow on preview rows
    showExplain: false, // clickable Explain on calc badges / condition hints
  };
}

// App-default render context singleton (shared with builder tooling).
export const _rc = createRenderCtx();

/**
 * Look up a UI string translation from the render context.
 * Falls back to the English default from UI_STRINGS automatically.
 * @param {string} key  — key from UI_STRINGS (e.g. 'or_separator')
 * @param {object} rc   — render context (may be null/undefined outside preview)
 */
export function uiStr(key, rc) {
  const fallback = UI_STRINGS[key] ?? key;
  if (!rc?.activeLanguage) return fallback;
  return rc.translations?.[rc.activeLanguage]?.ui?.[key] ?? fallback;
}
