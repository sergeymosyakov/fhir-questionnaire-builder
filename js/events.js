// ── Application event name registry ──────────────────────────────────────────
// Single source of truth for all CustomEvent names used across the codebase.
// Import AppEvents and use its properties instead of raw string literals.
//
// Payload documentation:
//   QUESTIONNAIRE_LOADED         detail: { fileName? }
//   BUILDER_NAVIGATE             detail: { id }       — preview row → builder node
//   BUILDER_NAVIGATE_TO          detail: { nodeId }   — scroll builder node into view
//   PREVIEW_NAVIGATE_TO          detail: { id }       — scroll & flash preview row for node
//   VIEW_PREF_CHANGE             detail: { key, value }
//   PREVIEW_MODE_CHANGE          detail: { mode }
//   QR_LOADED                    detail: { status, subject, author, id, language, metaVersionId, metaSource, metaProfile, metaTag, metaSecurity }
//   SHOW_JSON                    detail: { title, data }
//   RENUMBER_PROGRESS            detail: { done, total }
//   QUESTIONNAIRE_RESET          (no detail) — triggers _doReset() in app.js

export const AppEvents = Object.freeze({
  // ── Questionnaire lifecycle ───────────────────────────────────────────────
  QUESTIONNAIRE_LOADED:          'questionnaire-loaded',
  QUESTIONNAIRE_CLEARED:         'questionnaire-cleared',
  QUESTIONNAIRE_NEW:             'questionnaire-new',
  QUESTIONNAIRE_CLEAR_REQUESTED: 'questionnaire-clear-requested',
  QUESTIONNAIRE_RESET:           'questionnaire-reset',
  QUESTIONNAIRE_META_CHANGED:    'questionnaire-meta-changed',

  // ── Builder ───────────────────────────────────────────────────────────────
  BUILDER_RERENDER:     'builder:rerender',
  BUILDER_NAVIGATE:     'builder:navigate',
  BUILDER_NAVIGATE_TO:  'builder:navigate-to',
  BUILDER_EXPAND_ALL:   'builder:expand-all',
  BUILDER_COLLAPSE_ALL: 'builder:collapse-all',

  // ── Preview / form ────────────────────────────────────────────────────────
  PREVIEW_NAVIGATE_TO: 'preview:navigate-to',
  REINIT_FORM:         'reinit-form',
  SHOW_JSON:           'show-json',
  VIEW_PREF_CHANGE:    'view-pref-change',
  PREVIEW_MODE_CHANGE: 'preview-mode-change',
  // Dispatched by any preview control when the user changes a response value.
  // PreviewForm listens and triggers a re-render via _asyncRender.
  RESPONSE_CHANGED:    'preview:response-changed',

  // ── Patient / QR ─────────────────────────────────────────────────────────
  PATIENT_CTX_APPLIED: 'patient-ctx-applied',
  QR_LOADED:           'qr-loaded',

  // ── Cloud ──────────────────────────────────────────────────────────────────
  CLOUD_SAVE_REQUESTED:  'cloud-save-requested',
  CLOUD_LOAD_REQUESTED:  'cloud-load-requested',

  // ── UI utilities ───────────────────────────────────────────────────────────
  CLOSE_DROPDOWNS:       'close-dropdowns',

  // ── Builder utilities ──────────────────────────────────────────────────────
  // Dispatched by nodes/modals when they change FHIR data that requires
  // FHIRPath calc expressions to be re-evaluated.  BuilderPanel listens and
  // runs evalCalcNodes + dispatches RESPONSE_CHANGED.
  CALC_RECALC_REQUESTED: 'calc-recalc-requested',
  REFRESH_EXPR_ICONS:    'refresh-expr-icons',
  REFRESH_CALC_BADGES:   'refresh-calc-badges',
  COLLAPSE_ALL_PREVIEW:  'collapse-all-preview',
  EXPAND_ALL_PREVIEW:    'expand-all-preview',

  // ── Renumber ──────────────────────────────────────────────────────────────
  // detail: { format: 'numbers'|'roman'|'letters' }
  // Dispatched by RenumberControl when the user changes the prefix format.
  // NumberingService listens and updates its internal format.
  RENUMBER_FORMAT_CHANGED: 'renumber-format-changed',

  // ── Renumber progress ─────────────────────────────────────────────────────
  RENUMBER_PROGRESS:   'renumber-progress',
  RENUMBER_DONE:       'renumber-done',

  // ── Validators ────────────────────────────────────────────────────────────
  // detail: { id: string, enabled: boolean }
  // 'id' matches Validator#id — dispatched by UI toggles; validators listen and set this.enabled
  VALIDATOR_TOGGLE:    'validator-toggle',

  // ── Node patching ─────────────────────────────────────────────────────────
  // detail: { ids: string[], patch: object, nodeType?: 'group'|'item' }
  // Dispatched by modals to copy current settings to other nodes.
  // patch values: null = delete key from node, any other value = assign to node.
  // nodeType: if set, BaseNode skips nodes whose type doesn't match (type safety).
  COPY_TO_NODES: 'copy-to-nodes',
  // ── FHIR version ─────────────────────────────────────────────────────────
  // detail: { versionId: 'R4'|'R4B'|'R5', fromVersionId?: 'R4'|'R4B'|'R5', source?: 'user' }
  // Dispatched by FhirVersionSelect when the user changes the target FHIR version
  // (source:'user', fromVersionId = previous version), and by
  // questionnaire-loader.js when a loaded file has meta.fhirVersion set (no source).
  // When source:'user' and the tree is non-empty, version-compat checkers run and
  // a warning toast is shown only if any checker produces a message.
  FHIR_VERSION_CHANGED: 'fhir-version-changed',
});
