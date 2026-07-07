---
name: add-fhir-extension
description: "Step-by-step recipe to add support for a FHIR field, extension, or SDC feature to the Questionnaire Builder end to end. USE WHEN: adding a new FHIR R4 field or SDC extension (e.g. candidateExpression, isSubject, columnCount, entryFormat, sliderStepValue); wiring import → export → preview render → validation → builder UI → sample data → docs → tests for a FHIR feature. DO NOT USE FOR: fixing existing FHIR behavior, general refactors, or non-FHIR UI work."
---

# Add a FHIR extension / field end to end

Follow this checklist in order. Each layer has a canonical home in the codebase.
Confirm the extension is real (HL7 R4 or HL7/sdc FSH) before modeling it — never
invent a URL or cardinality.

## 1. Verify the spec
- Find the canonical extension URL and value type in the HL7 R4 or HL7 SDC definitions.
- Determine cardinality (0..1 vs 0..*), the value[x] type (`valueBoolean`, `positiveInt`, `Expression`, etc.), and which item types it is allowed on.

## 2. Import
- Register the known extension URL in `js/fhir/import-helpers.js`.
- Read it into the node model in `js/fhir/import-item.js` (map FHIR → node property).

## 3. Export
- Emit the extension back to FHIR in `js/fhir/export.js`. Note: export receives plain
  objects in unit tests — gate on concrete properties (`node.itemType === '...'`),
  not on methods that only exist on live node instances.

## 4. Preview render
- Render/apply the feature in the relevant node class under `js/nodes/*.js`.
- If it introduces a validation rule, follow the two-layer preview-validation
  checklist (visual indicator in `buildControl()` + `calcFormOk()` in `js/state.js`).

## 5. Validation
- If the field constrains the questionnaire, add checks in the relevant validator
  under `js/fhir/validators/`.

## 6. Builder UI
- Add the editing control to the correct modal section (e.g. an
  `AnswerTypeSection` in `js/ui/answer-type/sections.js`, or a states section).
- Mandatory FHIR tooltip: set `data-tip-title`, `data-tip-body`, `data-tip-fhir`
  (exact FHIR path), `data-tip-spec` (`'R4'` or `'SDC'`) on the control.
- Use `createCustomSelect` for dropdowns; never a native `<select>`.

## 7. Sample data
- Add representative usage to an existing `sampledata/*.fhir.json` (preferred) or a
  new file. Update `sampledata/library.json` and the `sampledata/` table in
  `docs/CONTEXT.md`. A feature only in `tests/fixtures/` is not user-visible.

## 8. Docs
- `docs/FHIR-MAPPING.md`: move the field OUT of any Not Supported table INTO a
  supported table (never leave a ✅ in Not Supported).
- `docs/ROADMAP.md`: DELETE the item if it was listed (do not mark `[x]`).
- `help.html`: add/update the row in the `HELP_DATA` array.
- `docs/CONTEXT.md`: update file table / feature list if structure changed.

## 9. Tests
- Unit (Vitest, node env, no DOM): cover import + export round-trip and any pure logic.
- E2E (Playwright): add a spec under `tests/e2e/` using `data-testid` selectors and a
  matching fixture under `tests/fixtures/` (fixture must be valid — a `choice` item
  needs ≥1 `answerOption`).

## 10. Validate before finishing
- `npm run lint` (zero errors), `npx vitest run` (all pass).
- Run the new e2e spec on demand: `npx playwright test tests/e2e/<name>.spec.js`.
- Re-grep the Not Supported sections to confirm nothing implemented lingers there.
