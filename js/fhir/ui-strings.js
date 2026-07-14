// ── ui-strings.js ────────────────────────────────────────────────────────────
// Canonical English source strings for patient-facing UI elements that are
// NOT stored in FHIR item.text but still need to be translated when the
// questionnaire is served in another language.
//
// Keys are stable identifiers. Values are the English defaults.
// Used by:
//   - js/fhir/translate-api.js  — source list for auto-translation
//   - js/preview/render-ctx.js  — uiStr() helper looks up defaults here
//
// To add a new translatable UI string:
//   1. Add the key/default here
//   2. Use uiStr(key, rc) at the render call site
// ─────────────────────────────────────────────────────────────────────────────

export const UI_STRINGS = {
  add_another:        '+ Add another',
  add_row:            '+ Add another entry',
  more_info:          'More info \u2197',
  or_separator:       'OR',
  and_separator:      'AND',
  select_placeholder: 'select',   // wrapped as \u2014 {value} \u2014 by custom-select
};
