// ── Application event name registry ──────────────────────────────────────────
// Single source of truth for all CustomEvent names used across the codebase.
// Import AppEvents and use its properties instead of raw string literals.
//
// Payload documentation:
//   QUESTIONNAIRE_LOADED         detail: { fileName? }
//   BUILDER_NAVIGATE             detail: { id }       — preview row → builder node
//   BUILDER_NAVIGATE_TO          detail: { nodeId }   — scroll builder node into view
//   VIEW_PREF_CHANGE             detail: { key, value }
//   PREVIEW_MODE_CHANGE          detail: { mode }
//   QR_LOADED                    detail: { status, subject, author }
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

  // ── Builder ───────────────────────────────────────────────────────────────
  BUILDER_RERENDER:    'builder:rerender',
  BUILDER_NAVIGATE:    'builder:navigate',
  BUILDER_NAVIGATE_TO: 'builder:navigate-to',

  // ── Preview / form ────────────────────────────────────────────────────────
  REINIT_FORM:         'reinit-form',
  SHOW_JSON:           'show-json',
  VIEW_PREF_CHANGE:    'view-pref-change',
  PREVIEW_MODE_CHANGE: 'preview-mode-change',

  // ── Patient / QR ─────────────────────────────────────────────────────────
  PATIENT_CTX_APPLIED: 'patient-ctx-applied',
  QR_LOADED:           'qr-loaded',

  // ── Renumber progress ─────────────────────────────────────────────────────
  RENUMBER_PROGRESS:   'renumber-progress',
  RENUMBER_DONE:       'renumber-done',
});
