// ── Builder tree entry point ──────────────────────────────────────────────────
// Thin facade: creates a BuilderPanel instance, runs DI configure calls, and
// re-exports panel methods for backward compatibility.
import { questDoc, answerStore } from '../state.js';
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
const panel = new BuilderPanel({ questDoc, answerStore });

// ── Inject services into node / modal / section layers ────────────────────────
// Nodes must not import application state or services directly.
// delete/copy/paste → nodes dispatch NODE_*_REQUESTED events, BuilderPanel/CopyPaste handle them.
// triggerCalcRecalc → dispatch CALC_RECALC_REQUESTED.
// formatSeg → import numberingService from numbering-service.js.
// domPurify/marked → window.DOMPurify / window.marked (loaded from lib/).
// leftPanelBody → document.querySelector('.left-panel-body') (stable DOM).

Modal.configure({
  questDoc,
  answerStore,
});

Section.configure({ questDoc });

// ── Re-exports for backward compatibility ─────────────────────────────────────
export function mount(opts)                  { panel.mount(opts); }
export function renderTree()                 { panel.renderTree(); }
export function renderTreeAsync(onProgress)  { return panel.renderTreeAsync(onProgress); }
export function renumberAll()                { return panel.renumberAll(); }
export function addRootGroup()               { panel.addRootGroup(); }

