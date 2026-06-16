// ── Builder tree entry point ──────────────────────────────────────────────────
// Thin facade: creates a BuilderPanel instance, runs DI configure calls, and
// re-exports panel methods for backward compatibility.
import { tree, rawFhir, values, questMeta, questContained, getValue, setValue, deleteValue } from '../state.js';
import { getLastCtx } from '../preview-form.js';
import { findAndRemove } from '../utils.js';
import { BaseNode } from '../nodes/base-node.js';
import { Modal } from '../ui/modals/modal-base.js';
import { Section } from '../ui/modals/section.js';
import { BuilderPanel } from './builder-panel.js';
import '../fhir/version-compat/open-choice.js';
import '../fhir/version-compat/r5-downgrade.js';
import '../fhir/formats/r4.js';
import '../fhir/formats/r4b.js';
import '../fhir/formats/r5.js';
import '../fhir/formats/redcap.js';

// ── Single panel instance ─────────────────────────────────────────────────────
const panel = new BuilderPanel({ tree, rawFhir, values, questMeta });

// ── Inject services into node / modal / section layers ────────────────────────
// Nodes, modals, and sections must not import state or services directly.
// triggerCalcRecalc / confirmDelete / formatSeg are no longer injected as _svc
// callbacks — nodes and modals dispatch CALC_RECALC_REQUESTED or import
// ConfirmDialog / formatSeg directly.
// copyNode / pasteAfter / hasPaste are injected later by app.js once CopyPaste
// is instantiated (avoids circular: builder/index.js ← app.js ← copy-paste.js).
const _shared = {
  tree,
  getFhirTarget: () => questMeta.fhirTarget,
};

BaseNode.configure({
  ..._shared,
  findAndRemove,
  domPurify:     window.DOMPurify,
  marked:        window.marked,
  leftPanelBody: document.querySelector('.left-panel-body'),
  // placeholders — patched by app.js after CopyPaste instantiation
  copyNode:    null,
  pasteAfter:  null,
  pasteBefore: null,
  hasPaste:    null,
});

Modal.configure({
  ..._shared,
  getLastCtx,
  questMeta,
  values,
  getValue,
  setValue,
  deleteValue,
  questContained,
});

Section.configure({ ..._shared });

// ── Re-exports for backward compatibility ─────────────────────────────────────
export function mount(opts)                  { panel.mount(opts); }
export function renderTree()                 { panel.renderTree(); }
export function renderTreeAsync(onProgress)  { return panel.renderTreeAsync(onProgress); }
export function renumberAll()                { return panel.renumberAll(); }
export function addRootGroup()               { panel.addRootGroup(); }
export function setRenumberGetter(fn)        { panel.setRenumberGetter(fn); }

