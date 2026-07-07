---
applyTo: "js/**,docs/**,help.html,sampledata/**"
description: "FHIR field/extension/SDC support conventions for the Questionnaire Builder — mandatory FHIR tooltips, keeping docs/FHIR-MAPPING.md, docs/ROADMAP.md, help.html, and sampledata/ in sync, and two-layer preview validation. Use when adding, removing, or changing any FHIR mapping, extension, or SDC feature."
---

# FHIR support conventions

Rules that keep the builder's FHIR support and its documentation/sample data in sync.

## FHIR tooltips are mandatory

Every UI label or input that controls a FHIR field or extension must have `data-tip-title`, `data-tip-body`, `data-tip-fhir`, and `data-tip-spec` set. `data-tip-fhir` must contain the exact FHIR path (e.g. `Questionnaire.item.required`, `item.extension[questionnaire-hidden].valueBoolean`). `data-tip-spec` must be `'R4'` or `'SDC'`. No FHIR-mapped control may ship without all four attributes.

## Keep documentation in sync with support

- **Implemented = removed from Not Supported.** Once a FHIR field or feature is fully implemented, DELETE its row from all Not Supported / remaining-gaps tables in `docs/FHIR-MAPPING.md` and add it to the relevant supported table. A ✅ row must **never** remain in a Not Supported section. After every change, grep the not-supported sections (e.g. `implicitRules`, `answerConstraint`) to confirm nothing implemented lingers there.
- **Implemented = removed from ROADMAP.** Once a roadmap item is fully implemented, DELETE it from `docs/ROADMAP.md` — do NOT mark it `[x]`. The roadmap lists only outstanding work.
- **Keep `help.html` in sync.** Whenever a FHIR field, extension, or SDC feature is added, removed, or renamed in the builder — update the corresponding row(s) in the `HELP_DATA` array in `help.html`. Adding a new field → new row; removing support → delete the row or move it to the "Not Supported" category; changing where/how a field is configured → update the `where` and `how` columns. `help.html` must always reflect the actual current state of the builder UI.

## Sample data

**Every new FHIR feature must appear in sample data.** When a new FHIR field, extension, or SDC feature is implemented, add representative usage to an existing `sampledata/` file (preferred) or create a new one. Update the matching entry in `sampledata/library.json` and the `sampledata/` table in `docs/CONTEXT.md`. A feature that exists only in `tests/fixtures/` is not considered visible to users.

## Preview validation checklist

When adding a new validation rule (regex, minLength, maxLength, min/max value, etc.) to preview nodes, you must update **both** layers:
1. the visual error indicator in the node's `buildControl()` (`js/nodes/*.js`) — including the `_interacted` flag so the error survives re-render after blur;
2. the pass/fail logic in `calcFormOk()` (`js/fhir/form-checks.js`) so the ✓/✗ icon reflects the validation.

A validation that only shows a red label but doesn't fail the icon (or vice versa) is a bug.
