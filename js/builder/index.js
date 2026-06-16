// ── Builder tree entry point ──────────────────────────────────────────────────
// Thin facade: creates a BuilderPanel instance, runs DI configure calls, and
// re-exports panel methods for backward compatibility.
import { questDoc, answerStore } from '../state.js';
import { BuilderPanel } from './builder-panel.js';
import '../fhir/version-compat/open-choice.js';
import '../fhir/version-compat/r5-downgrade.js';
import '../fhir/formats/r4.js';
import '../fhir/formats/r4b.js';
import '../fhir/formats/r5.js';
import '../fhir/formats/redcap.js';

// ── Single panel instance ─────────────────────────────────────────────────────
const panel = new BuilderPanel({ questDoc, answerStore });

// ── Notes ─────────────────────────────────────────────────────────────────────
// Modal._svc and Section._svc are populated via QUESTIONNAIRE_LOADED event
// dispatched by questionnaire-loader.js — no configure() needed here.

// ── Re-exports for backward compatibility ─────────────────────────────────────
export function mount(opts)                  { panel.mount(opts); }
export function renderTree()                 { panel.renderTree(); }
export function renderTreeAsync(onProgress)  { return panel.renderTreeAsync(onProgress); }
export function renumberAll()                { return panel.renumberAll(); }
export function addRootGroup()               { panel.addRootGroup(); }

