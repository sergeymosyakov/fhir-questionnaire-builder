# QuestionaryPrototype — Build Context

> Internal architecture and codebase notes. See [README.md](../README.md) for user-facing docs.

## ⚠️ WORKFLOW RULES — MANDATORY

1. **git commit/push only on explicit user instruction** ("push it", "пушай"). Never automatically.
2. **Before every push** — update `docs/CONTEXT.md`, `docs/FHIR-MAPPING.md` (if FHIR mapping changed), and `README.md` (file table, UX features, Known Limitations). Root `CONTEXT.md` does not exist — do not create it.
3. **Modularity** — new UI widget → `js/ui/<name>.js`; new control → `js/controls/<name>.js`; new CSS concern → `css/<name>.css` + `<link>` in index.html. Do not add logically separate code into existing modules.
4. **OOP / DRY** — when 2+ modules share the same behavioral pattern, extract a shared base/factory instead of copy-pasting. Example: all modals use `initModal(elements, callbacks)` + `setModalTitle(titleEl, label, subject)` from `js/ui/modal-base.js` — never inline the lifecycle boilerplate in a new modal file.
5. **DI** — DOM resolved once in `app.js`, passed via `init(elements)`. No `getElementById` inside submodules.
5. **No inline styles** — `style="..."` in HTML and `el.style.foo =` in JS are forbidden for static values. Allowed only for **runtime-dynamic** values: show/hide (`display`), computed dimensions, user-driven colors. All static appearance → CSS classes.
6. **English only** — all code comments, doc strings, commit messages, CONTEXT.md, README.md, any in-repo text, **and all UI labels, button text, and tooltip text in HTML and JS** must be in English. No Russian anywhere in the codebase.
7. **E2E test selectors** — selectors in `tests/e2e/*.spec.js` must use `data-testid` (via `element.dataset.testid`) where applicable. No raw class or tag selectors. When adding a testable element, register its ID in the registry comment at the top of the relevant spec file.
8. **Tooltips** — **never use the native `title="..."` attribute**. Always use the custom rich tooltip system via `data-tip-title` / `data-tip-body` (and optionally `data-tip-fhir` / `data-tip-spec`). Triggered automatically by `js/ui/tooltip.js` on mouseover.

---

## What It Is

A prototype **Logic Builder** for medical questionnaires (FHIR R4 Questionnaire).  
Allows visually building questionnaire logic, testing it against patient data, and importing/exporting FHIR R4 JSON.

---

## Product Direction

**Target audience:** Developers and FHIR integration engineers who build, inspect, or maintain logic-heavy questionnaires in FHIR R4 format.

This is a **Variant B** tool — it surfaces FHIR concepts directly (linkId, enableWhen, extensions, FHIRPath) rather than hiding them behind simplified UX. It is not designed for direct use by clinicians without training.

### Key Scenarios

These three scenarios act as a feature filter: new functionality is considered only if it directly supports at least one of them.

**Scenario 1 — Edit & round-trip**  
Import an existing FHIR R4 `Questionnaire`, adjust visibility/applicability logic using the visual builder, then export the modified questionnaire back to FHIR JSON. Primary workflow for integration projects.

**Scenario 2 — Build from scratch**  
Assemble a new questionnaire (e.g., bariatric surgery pre-authorization) from scratch using the builder, test it against patient profiles, and export validated FHIR JSON.

**Scenario 3 — Logic testing**  
Load any FHIR questionnaire and simulate different patient profiles in the patient-data panel. Instantly see which items are visible, which are N/A, and whether the questionnaire resolves to PASS or FAIL.

---

## Files

| File | Purpose |
|---|---|
| `index.html` | Entry point — markup, script imports |
| `favicon.svg` | Browser tab icon |
| `start.ps1` | Local dev server: `npx serve .` |
| `css/styles.css` | All styles and CSS design tokens (`--c-hover`, `--c-text-1`, `--c-accent`, etc.) |
| `css/modals.css` | Shared modal system (`.modal-backdrop`, `.modal-box`, `.modal-header`, `.modal-close`, `.modal-body`, `.modal-footer`, `.modal-btn`) + per-modal z-index/size overrides via `#id` selectors |
| `js/app.js` | Entry point — wires inputs, buttons, loads example |
| `js/state.js` | Reactive state, data factories, business logic, `evalConstraints`; exports `questMeta` reactive object (id, url, version, name, title, status, publisher, description, date, subjectType, purpose, copyright, approvalDate, lastReviewDate, effectivePeriodStart, effectivePeriodEnd, _rawContact, _rawUseContext, _rawJurisdiction, _rawCode); `CHECKABLE_TYPES` and `NONEMPTY_TYPES` include `time` and `dateTime` (mandatory items of these types participate in PASS/FAIL validation) |
| `js/utils.js` | Pure utility functions (`escAttr`, `findAndRemove`, `isDescendant`, `findAncestorGroupIds`, `parseOption`, `parseOptions`) |
| `js/eval.js` | Tree evaluation — `enableWhen[]` visibility, `enableWhenExpression` FHIRPath, `evalConstraints` |
| `js/render-builder.js` | Left panel — 3-line re-export shim → `js/builder/` |
| `js/builder/ctx.js` | `BuilderCtx` JSDoc typedef (no runtime exports) |
| `js/builder/index.js` | Builder orchestrator — public API (`renderTree`, `collapseAll`, `renumberAll`, `addRootGroup`, `renderTreeAsync`) |
| `js/builder/_shared.js` | Shared utilities; injected deps via `init(deps)`; `getAllItems`, `triggerCalcRecalc`, `confirmDelete` |
| `js/builder/dnd.js` | Self-contained drag & drop; all state via `init(onDrop, tree, formTick)` |
| `js/builder/panels.js` | Action panel builders: `addPanel`, `buildVisPanel` (enableWhen), `buildTypePanel` (type+options — dead code; only used as a reference), `buildStylePanel` (appearance for groups). Dead functions `buildMandPanel` / `buildInitialPanel` / `buildConstraintPanel` removed — those actions moved to dedicated modals |
| `js/builder/node-item.js` | `renderItem(node, ctx)` — opens `answer-type-modal`, `showwhen-modal`, `expression-modal`, `constraint-modal`, `initial-modal`, `appearance-modal`, `required-modal`, `repeatable-modal` for all action links; no inline panels remain |
| `js/builder/node-group.js` | `renderGroup(node, ctx)` — opens `showwhen-modal`, `expression-modal`, `required-modal` for respective action links; `style` still uses inline `buildStylePanel` |
| `js/render-preview.js` | Right panel — reactive preview; `buildRepeatControls` renders multi-row repeat UI; enforces `node._maxOccurs` — add button disabled at limit; `hasCriteria` includes `hasConstraints`+`hasRange` so badge is visible for constraint/range-only questionnaires; group icon `relevantItems` filter and `itemOk` predicate include constraint and range items |
| `js/controls/index.js` | Control registry — dispatches by `itemType` |
| `js/controls/{type}.js` | Per-type control implementations. `select` and `open-choice` use custom portal dropdowns (`.sc-trigger` / `.oc-wrap`) replacing native `<select>` / `<datalist>`. `date` and `dateTime` use `js/ui/date-picker.js` custom calendar. `time` uses native `<input type="time">`. |
| `js/fhir/import.js` | FHIR R4 → internal model; reads `item.repeats`, `item.maxLength` (→ `_maxLength`), `item.answerValueSet` (→ `_answerValueSet`), `Questionnaire.contained[]` (→ `questContained`), `questionnaire-minOccurs`/`questionnaire-maxOccurs` extensions, `questionnaire-minValue`/`questionnaire-maxValue` extensions (→ `_minValue`/`_maxValue`), `ordinalValue` extension on `answerOption.extension` (primary) or `answerOption.valueCoding.extension` (fallback) → `_optionOrdinals`, `questionnaire-sliderStepValue` extension (→ `_sliderStep`), `item.disabledDisplay` field + R4 backport extension (→ `_disabledDisplay`); populates `questMeta` (id, url, version, name, title, status, publisher, description, date, subjectType, purpose, copyright, approvalDate, lastReviewDate, effectivePeriodStart, effectivePeriodEnd) on import; stores `contact[]`, `useContext[]`, `jurisdiction[]`, `code[]` as pass-through fields (`_rawContact`, `_rawUseContext`, `_rawJurisdiction`, `_rawCode`); `answerOption[].initialSelected` → `node._initialSelected` (round-trip); `item.initial[]` multi-value for repeating items → `node._initialValues[]` + `node._initialValue` (first value); exports `resolveContainedValueSet(contained, ref)` |
| `js/fhir/export.js` | Internal model → FHIR R4; writes `maxLength`, `item.answerValueSet` (from `_answerValueSet`), `Questionnaire.contained[]` (from `questContained`), `questionnaire-minOccurs`/`questionnaire-maxOccurs` when `node.repeats`, `questionnaire-minValue`/`questionnaire-maxValue` from `_minValue`/`_maxValue`, `ordinalValue` extension on `answerOption.extension` (from `_optionOrdinals`), `questionnaire-sliderStepValue` extension from `_sliderStep` (`valueInteger` or `valueDecimal`), `item.disabledDisplay` from `_disabledDisplay`; uses all `questMeta` fields (id, url, version, name, title, status, publisher, description, date, subjectType, purpose, copyright, approvalDate, lastReviewDate) for root-level Questionnaire properties; `subjectType` comes from `questMeta.subjectType` (comma-separated string → array, default `['Patient']`); `date` preserved from import or falls back to today; writes `effectivePeriod` from `effectivePeriodStart`/`effectivePeriodEnd` when non-empty; writes back `_rawContact`, `_rawUseContext`, `_rawJurisdiction`, `_rawCode` pass-through arrays unchanged; marks `answerOption[].initialSelected` from `node._initialSelected`; exports `item.initial[]` as multi-value array for repeating items with `_initialValues`; skips writing `answerOption` when `_answerValueSet` is set |
| `js/fhir/qr-export.js` | `exportQR(fileName)` — builds QR from current tree + answers, downloads JSON |
| `js/fhir/qr-builder.js` | `buildQR(fhirJson, values)` / `buildQRItem(fhirItem, values)` — builds a FHIR R4 QuestionnaireResponse; `choice`/`open-choice` → `valueCoding` (with `system`, `display`, `ordinalValue`); `quantity` → `valueQuantity {value, unit}`; `url` → `valueUri`; `reference` → `valueReference`; used by qr-export and FHIRPath calculatedExpression evaluation |
| `js/fhir/qr-import.js` | `importQRAnswers(qrJson, values, tree)` — flattens QR answers; handles `valueTime`, `valueReference` (→ `{reference}`), `valueQuantity` (→ `{value, unit}`), `valueUri`; multi-answer items write `id$$1`…`id$$N` + `id$$n` (repeat row restoration); reports unmatched linkIds; returns `{ok, loaded, unmatched, questionnaire}` |
| `js/ui/variables-panel.js` | SDC Variables card + edit modal — `init(elements, questVariables, onReinit)`, `refresh()`; draft-based Apply/Cancel modal; `%name` chip rich tooltips |
| `js/ui/metadata-modal.js` | Questionnaire Properties modal — `init(elements)`, `open()`; draft pattern; edits all `questMeta` fields via three sections: **Core** (always visible: id, url, version, name, title, status dropdown, publisher, description), **Advanced** (collapsible, collapsed by default: date, subjectType, effectivePeriodStart/End, approvalDate, lastReviewDate, purpose, copyright), and **Codes** (collapsible: edits `Questionnaire.code[]` via shared `renderCodesEditor`; badge shows code count); toggle button labeled `▶ Advanced` / `▼ Advanced`; changes committed on Apply; reflected in compact `questMetaCard` (non-collapsible panel above Variables card) |
| `js/ui/codes-modal.js` | Item Codes modal — `init(elements)`, `open(node, link, setActive)`; draft pattern; edits `node._codes[]` (FHIR `item.code[]`); each row has system URL, code, and display inputs + × remove; `+ Add code` button; Apply filters empty codes and commits; Cancel discards; action button highlighted when `_codes` non-empty; exports shared `renderCodesEditor(draft, container, prefix)` for reuse in other modals |
| `js/ui/json-viewer.js` | Shared read-only FHIR JSON viewer modal — `init(elements)`, `show(title, data)`, `close()`; Esc / backdrop / × close |
| `js/ui/contained-panel.js` | Collapsible read-only card for `Questionnaire.contained[]` — `init(elements, containedArray, showJsonFn)`, `refresh()`; each chip opens JSON viewer |
| `js/ui/answer-valueset-panel.js` | Collapsible read-only card for items using `answerValueSet` — `init(elements, treeRef, showJsonFn)`, `refresh()`; collects unique URLs; each chip shows URL + `usedByItems` |
| `js/ui/modal-base.js` | Shared modal lifecycle utilities — `initModal(elements, {onApply?, onCancel})` wires closeBtn/cancelBtn/applyBtn/backdrop/Escape once; `setModalTitle(titleEl, label, subject)` renders bold label + muted subject; `openModal` / `closeModal` helpers. Used by all 10 draft-pattern modals — never inline the boilerplate in a new modal. |
| `js/ui/showwhen-modal.js` | Show When (enableWhen) centered modal — draft pattern; Apply commits + triggers preview re-render; Cancel discards; no-op `setActive` during editing so action button only changes on Apply; **disabledDisplay** `<select>` appended at bottom of modal body (options: `protected` / `hidden`; editable via `disabled-display-select` testid) |
| `js/ui/constraint-modal.js` | Constraint edit modal — draft pattern; `node.constraint[]` deep-cloned on open; Apply commits + calls `triggerCalcRecalc()` + updates button state; Cancel discards; expression field is a resizable `.expr-textarea`; each card has an **Explain** button (uses `window.fhirpath` directly) |
| `js/ui/expression-modal.js` | Config-driven modal for `_calculatedExpr` and `_initialExpr` fields — `init(elements)`, `open(cfg)`; draft pattern; auto-resize `.expr-textarea`; live expr icon via debounced `refreshExprIcons`; Escape / backdrop close |
| `js/ui/initial-modal.js` | Default Value edit modal — `init(elements)`, `open(node, initLink, setActive)`; draft pattern; renders context-aware control per `itemType`; Apply commits `node._initialValue` + `values[node.id]` + calls `triggerCalcRecalc()` |
| `js/ui/appearance-modal.js` | Appearance (rendering-style) edit modal — `init(elements)`, `open(node, styleLink, setActive)`; draft pattern; Bold / Italic checkboxes, color picker + clear, raw CSS `<textarea rows=1 resize:vertical>`; Apply sets `node._renderStyle` |
| `js/ui/required-modal.js` | Required (mandatory) edit modal — `init(elements)`, `open(node, mandLink, setActive)`; draft pattern; `<select>` with null / true / false options; Apply sets `node.mandatory`; link active only when `mandatory === true` |
| `js/ui/answer-type-modal.js` | Answer Type edit modal — `init(elements)`, `open(node, typeLink, setActive)`; draft pattern; type `<select>` + conditional sections: for choice types (select/radio/open-choice) shows "Answer source" radio toggle between **Options list** (comma-sep `code=Label` or `code=Label=score` with ordinalValue) and **ValueSet (answerValueSet)** (dropdown from `questContained` ValueSets or free-text external URL); for `reference` — resource type dropdown; for `quantity` — unit dropdown; for `integer`/`decimal` — **Numeric constraints** section with Min / Max / Slider step inputs (`min-value-input`, `max-value-input`, `slider-step-input` testids); Apply resolves local `#vs-id` refs into `node.options` for preview; extracts ordinals from `code=Label=score` entries into `node._optionOrdinals` |
| `js/ui/repeatable-modal.js` | Repeatable edit modal — `init(elements)`, `open(node, repeatLink, setActive)`; draft pattern; toggle for `node.repeats` + cardinality card (`_minOccurs` / `_maxOccurs` integer inputs); Apply trims excess rows when maxOccurs reduced; calls `triggerCalcRecalc()` |
| `js/ui/patient-ctx.js` | Patient presets dropdown — 5 built-in profiles + Custom…; seeds `%age`, `%gender`, `%bmi`, `%pregnant`, `%smoker`, `%proc`, `%comorb` in `questVariables`; auto-applies and calls `reinitForm()` on selection |
| `js/ui/progress.js` | Global progress bar — `init(elements)`, `show/update/hide` |
| `js/ui/search.js` | Preview search — `init(elements)`, `refresh()`; highlight + up/down/Enter navigation |
| `js/ui/tooltip.js` | Rich tooltip system — delegated `mouseover` on `[data-tip-title]`/`[data-tip-body]`; positions card below/above target; supports `data-tip-fhir` + `data-tip-spec` footer |
| `js/fhir/explain.js` | FHIRPath boolean expression tree parser — `parseExprTree(expr)` + `evaluateExprTree(node, fp, resource, env)` with AND/OR/NOT/LEAF nodes |
| `js/ui/explain-modal.js` | Expression Explain modal — `show(expr, fp, resource, env)`; renders AND/OR/NOT/LEAF tree with ✓/✗ icons; FHIRPath strip at bottom |
| `js/ui/autosave.js` | Background autosave — 15 s interval; `getDraftMeta/getDraftData/clearDraft`; persists to `localStorage` |
| `js/ui/status-badge.js` | PASS/FAIL pill badge in preview header — `update({anyVisible, hasCriteria, finalOk, failingItems})`; dark dropdown with numbered issues + ↗ navigate links |
| `js/fhir/validate.js` | `validateTree(tree)` → `{severity,nodeId,message}[]`; linkId uniqueness, JS/FHIRPath syntax, empty titles, missing options; suppresses "no answer options" warning when `_answerValueSet` is set |
| `js/ui/validate-modal.js` | Validation modal UI — `init(elements)` + `show(title, issues, mode, onExport?)`; no hardcoded DOM IDs |
| `sampledata/example-bariatric.fhir.json` | FHIR R4 example (bariatric pre-authorization). Contains `contained[]` with 2 ValueSets (`vs-comorbidities`, `vs-vitamin-deficiencies`); two items use `answerValueSet`. Constraints: `diet-min-months` (error, integer ≥ 3), `phq9-severity` (warning, score < 15), `bmi-eligibility` (error, readOnly calc ≥ 35) |
| `sampledata/annual-health-check.fhir.json` | **Annual Health Check** — covers all FHIR features: `version`/`publisher`, `prefix`, `item.code[]` (LOINC), `minValue`/`maxValue`, `rendering-style` (bold section headers + blue italic label), `sliderStepValue`, `repeats`+`minOccurs`/`maxOccurs`, `ordinalValue` (PHQ-9 mood), `enableWhen`, `initial[]`, `maxLength`, `calculatedExpression` (BMI), `questionnaire-constraint` (warning when referral set but no notes) |
| `sampledata/valueset-demo.fhir.json` | **Lifestyle & Social History Assessment** — 3 contained ValueSets (SNOMED, LOINC, example.org); 4 items with `code[]` and prefix: 3 using local `#vs-id` refs, 1 using external URL; `rendering-style` on group header |
| `sampledata/sdc-variables-demo.fhir.json` | **BMI & Body Composition Assessment** — SDC questionnaire-level variables (`%weightKg`, `%heightM`, `%bmiCalc`) + `calculatedExpression`; LOINC `code[]` + `minValue`/`maxValue` on height/weight |
| `sampledata/slider-disabled-demo.fhir.json` | **Pain & Symptom Assessment** — numeric sliders, `disabledDisplay` (hidden/protected), `ordinalValue` on radio options, `rendering-style` on section headers, LOINC `code[]`, conditional sections via `enableWhen` |
| `sampledata/reference-example.fhir.json` | **Care Referral Request** — `reference` item type (Patient, Practitioner, Encounter) with `questionnaire-referenceResource`; urgency choice with SNOMED code; reason/history text items; `rendering-style` on group headers; `version`/`publisher` |
| `sampledata/1776102565767-...json` | Real-world questionnaire for testing |
| `sampledata/patient-scenario-eligibility.fhir.json` | Scenario: Bariatric Surgery Eligibility — `initialExpression` + `enableWhenExpression` pathways |
| `sampledata/patient-scenario-risk.fhir.json` | Scenario: Pre-op Risk Assessment — readOnly `initialExpression` fields |
| `sampledata/patient-scenario-calc-chain.fhir.json` | Scenario: Risk Score Calc Chain — `initialExpression` → `calculatedExpression` → `enableWhenExpression` pipeline; LOW/MODERATE/HIGH per preset |
| `sampledata/bariatric-extended.fhir.json` | Synthetic bariatric pre-auth — 87 items, 32 enableWhen, all types |
| `sampledata/ussg-fht.fhir.json` | US Surgeon General Family Health History (49 items, depth 5) |
| `sampledata/prowl-ss.fhir.json` | PROWL-SS post-op pain assessment (44 items) |
| `sampledata/phq-9.fhir.json` | PHQ-9 depression screening (11 items) |
| `sampledata/phq-9-response.qr.json` | Sample QuestionnaireResponse for PHQ-9 (mild depression, score 7) — 10 answered items with `valueCoding` (LOINC codes) |
| `sampledata/example-bariatric-response.qr.json` | Sample QuestionnaireResponse for example-bariatric (eligible male patient, BMI 41.5) — groups + nested items |
| `sampledata/1776102565767-…json` | Real-world questionnaire snapshot for regression testing |
| `ROADMAP.md` | Prioritized feature roadmap (Now / Next / Later) |
| `docs/FHIR-MAPPING.md` | Full FHIR ↔ internal model mapping + not-supported list |
| `package.json` | Node dev tooling — Vitest (`npm test`) + Playwright (`npm run test:e2e`); `serve` devDep used by Playwright webServer |
| `vitest.config.js` | Vitest config — node environment, `tests/**/*.test.js` |
| `playwright.config.js` | Playwright config — Chromium only, `testDir: tests/e2e`, auto-starts local `serve` (via `node node_modules/.bin/serve`); reporters: `html` (open:never) + `list` |
| `tests/e2e/builder.spec.js` | E2E tests (24) — load/clear form, collapse/expand group, FHIR export, group title edit, delete item/group (cascade), type changes (checkbox/display), bidirectional navigation flash (builder↔preview), node count match on import, answer state persistence, enableWhen (Show When modal), patient preset section visibility, Re-init / initialExpression population; all selectors via `data-testid`; fixtures from `tests/fixtures/` |
| `tests/e2e/contained-panel.spec.js` | E2E tests (17) — Contained Resources card + Answer ValueSet card; chip rendering, JSON viewer modal (open/close via ×/footer/Esc/backdrop), toggle collapse/expand, cards hidden on clear; fixture `tests/fixtures/contained-valueset.fhir.json` |
| `tests/e2e/fhir-features.spec.js` | E2E tests (19) — readOnly enforcement, maxLength counter, minValue/maxValue error display and round-trip, ordinalValue badges in radio/select, ordinalValue round-trip export; fixture `tests/fixtures/fhir-features.fhir.json` |
| `tests/e2e/slider-disabled.spec.js` | E2E tests (15) — slider rendering (range input, min/max/step attrs, label update, round-trip), disabledDisplay (hidden absent from DOM, protected dimmed, toggle on condition change, round-trip), builder UI (Answer Type modal numeric section, Show When modal disabledDisplay select, applying changes); fixture `tests/fixtures/slider-disabled.fhir.json` |
| `tests/e2e/metadata-modal.spec.js` | E2E tests (38) — questMetaCard visibility, status badge, modal open/close, fields pre-populated, Advanced section toggle, Advanced field values, round-trip export, Apply/Cancel, reset on clear, effectivePeriod fields, effectivePeriod round-trip, Codes section toggle + badge, code rows populated from imported code[], add/remove code rows, code round-trip export, Cancel discards code changes; fixture `tests/fixtures/meta-test.fhir.json` |
| `tests/e2e/codes-ordinal.spec.js` | E2E tests (11) — Codes action button active state (with/without codes), modal open/close (Apply/Cancel/×), add/remove/edit code rows, Apply commits + deactivates when all removed, Cancel discards, export round-trip preserving `item.code[]`; fixture `tests/fixtures/codes-ordinal.fhir.json` |
| `tests/fixtures/` | Frozen FHIR samples for e2e tests — do not edit. `example-bariatric.fhir.json`, `patient-scenario-eligibility.fhir.json`, `all-types-repeatable.fhir.json`, `contained-valueset.fhir.json`, `fhir-features.fhir.json`, `slider-disabled.fhir.json`, `meta-test.fhir.json`, `codes-ordinal.fhir.json` |
| `tests/utils.test.js` | Unit tests for `js/utils.js` (22 tests) |
| `tests/eval.test.js` | Unit tests for `js/eval.js` — `evaluateNode`, `markAllDisabled`, `enableWhen` AND/OR logic (23 tests) |
| `tests/calc.test.js` | Unit tests for `js/fhir/calc.js` — `buildVarEnv`, `evalCalcNodes` (11 tests) |
| `tests/validate.test.js` | Unit tests for `js/fhir/validate.js` — `validateTree` (28 tests) |
| `tests/export.test.js` | Unit tests for `js/fhir/export.js` — enableWhen, constraints, SDC variables, `integer`/`decimal`/`number` type mapping, `answerValueSet`, `contained[]`, `questMeta` round-trip (incl. name, date, subjectType, purpose, copyright, approvalDate, lastReviewDate, pass-through contact/useContext/jurisdiction), `_codes` round-trip, `effectivePeriod` export, `_rawCode` pass-through, `answerOption.initialSelected`, multi-initial for repeating items (102 tests) |
| `tests/import.test.js` | Unit tests for `js/fhir/import.js` — `fhirTypeToItemType`, `fhirOptsToStr`, `humanEnableWhen`, `applyVisibility`, `contained[]`, `answerValueSet`, `questMeta` population (incl. name, date, subjectType, purpose, copyright, approvalDate, lastReviewDate, pass-through contact/useContext/jurisdiction), `_codes` import, `effectivePeriod` import, `_rawCode` pass-through, `answerOption.initialSelected`, multi-initial for repeating items (103 tests) |
| `tests/qr-builder.test.js` | Unit tests for `js/fhir/qr-builder.js` — `buildQR`, `buildQRItem`, all answer types incl. `quantity`→`valueQuantity`, `url`→`valueUri`, `reference`→`valueReference`, ordinalValue extension (40 tests) |
| `tests/qr-import.test.js` | Unit tests for `js/fhir/qr-import.js` — input validation, all value types incl. `valueTime`/`valueReference`/`valueQuantity`/`valueUri`, unmatched linkIds, nested groups, repeat rows, empty/missing answers, values mutation (41 tests) |
| `tests/state.test.js` | Unit tests for `evalConstraints` in `js/state.js` — severity filtering, empty/false/throw results, varEnv passing (16 tests) |
| `tests/integration.test.js` | Integration tests for `buildQR` + `evalConstraints` pipeline — decimal/integer pass/fail, wrong key regression, warning-only, nested groups (7 tests) |
| `.github/workflows/test.yml` | GitHub Actions CI — `test` job: Vitest; `e2e` job: Playwright (uploads `playwright-report/` artifact); `deploy` job: bundles app + report into `_site/`, deploys to GitHub Pages (`/playwright-report/` = latest test report); both `test`/`e2e` triggered on every push/PR to main |

---

## Tech Stack

- **`@vue/reactivity`** (ESM CDN) — only `ref`, `reactive`, `effect`. No Vue components.
- **ES Modules** — `import/export` between files; requires HTTP server (`npx serve .` or GitHub Pages)
- **Vanilla JS DOM** — left panel (builder) constructed imperatively
- **`effect()`** — rebuilds the right panel (preview) on reactive state changes
- **FHIRPath** — `window.fhirpath` (global, `lib/fhirpath.min.js`); used in `enableWhenExpression`, `calculatedExpression`, `evalConstraints`, and `buildVarEnv`
- **Playwright** — E2E test suite; **237 tests** across 17 spec files (Chromium); CI via GitHub Actions (`npx playwright test`)
- **Dependency injection** — `dnd.js` and `_shared.js` receive all state via `init()`, no module-level singletons
- **`ctx` object** — `{ renderTree, renderNode, tree, formTick, collapsed }` passed down to renderers and panels
- **Vitest** — unit test suite for pure-function modules; **393 tests** across 10 files; CDN imports mocked via `vi.mock`; CI via GitHub Actions (`npm test`)
- **GitHub Pages** — https://sergeymosyakov.github.io/fhir-questionnaire-builder/

---

## Architecture

### Reactive State

```js
// Patient context — stored as FHIRPath literal expressions in questVariables (js/ui/patient-ctx.js)
// Seeded as: { name:'age', expression:'30' }, { name:'gender', expression:"'male'" }, etc.
// Accessible in FHIRPath as %age, %gender, %bmi, %pregnant, %smoker, %proc, %comorb

tree              // reactive([]) — questionnaire node tree
values            // plain object — form answers (not reactive; avoids re-render on every keystroke)
_formTick         // ref(0) — incremented on checkbox/select change to re-trigger effect()
questVariables    // reactive([]) — SDC variable entries; patient ctx seeded here
questContained    // reactive([]) — Questionnaire.contained[] raw FHIR resources (round-trip)
questMeta         // reactive({}) — questionnaire-level metadata: id, url, version, title, status, publisher, description
```

### Node Data Model

```js
// Group
{ id, type:'group', title, mandatory,
  enableWhen: [], enableBehavior: 'all'|'any', enableWhenExpression: '',
  constraint: [],
  logicWithParent:'AND'|'OR', children:[] }

// Item
{ id, type:'item', title, mandatory,
  itemType:'text'|'integer'|'decimal'|'checkbox'|'select'|'display'|...,  // 'number' accepted as legacy alias
  enableWhen: [], enableBehavior: 'all'|'any', enableWhenExpression: '',
  constraint: [], options }

// FHIR-imported nodes also carry:
_enableWhenText  // human-readable enableWhen label (e.g. "«Q» = Yes AND «Q2» = No")
_renderStyle     // raw CSS string from FHIR _text.extension[rendering-style]
_calculatedExpr  // FHIRPath string (SDC calculatedExpression)
_initialExpr     // FHIRPath string (SDC initialExpression) — evaluated once on import + Re-init
_readOnly        // boolean — FHIR item.readOnly
_initialValue    // any — FHIR item.initial[0] value (pre-fills values[] on import)
_prefix          // string — FHIR item.prefix (amber badge; editable in builder)
_codes           // object[] — FHIR item.code[] (preserved round-trip; not displayed)
_maxLength       // integer — FHIR item.maxLength (imported/exported; character counter + maxlength attr enforced in preview)
_minOccurs       // integer — questionnaire-minOccurs ext (imported/exported when repeats:true)
_maxOccurs       // integer — questionnaire-maxOccurs ext; enforced in preview — add button disabled at limit
_answerValueSet  // string — FHIR item.answerValueSet URL; round-trip preserved; local #vs-id refs resolved into node.options during import so preview renders real options
_minValue        // number — questionnaire-minValue ext; error badge shown in preview + blocks PASS when violated
_maxValue        // number — questionnaire-maxValue ext; error badge shown in preview + blocks PASS when violated
_optionOrdinals  // object — map of option code → numeric ordinalValue; shown as (N) badge on radio/select options; round-trip safe
_sliderStep      // number — questionnaire-sliderStepValue ext; when set, integer/decimal renders as <input type="range"> slider; editable in Answer Type modal
_disabledDisplay // 'hidden'|'protected' — when not visible: 'hidden' removes item from DOM entirely, 'protected' shows grayed row (default); editable in Show When modal
```

---

## Evaluation Logic

### enableWhen
- `node.enableWhen[]` checked against `values[ew.question]` using `checkOneEnableWhen(ew)`
- `node.enableBehavior === 'all'` (default) → all conditions must pass (AND)
- `node.enableBehavior === 'any'` → any one condition passes (OR)
- If `enableWhenExpression` is set, evaluated via `fhirpath.evaluate()` as override/fallback
- Node hidden if conditions not met; `showDimmed` set if any enableWhen is defined

### constraint[]
- Each `node.constraint[]` entry: `{ key, severity, human, expression }` (mirrors FHIR `questionnaire-constraint` extension)
- Evaluated via FHIRPath against the QuestionnaireResponse in `evalConstraints(node, qr, envVars)` in `state.js`
- Empty FHIRPath result (`[]`) or `false` → constraint **fails**; `true` → passes
- `severity: 'error'` fail is counted as a failing item in Final Result; `severity: 'warning'` shows badge only

### Final Result
- **PASS** — all visible, mandatory items satisfied and no `error`-severity constraints fail
- **FAIL** — at least one mandatory item not satisfied, or at least one `error`-severity constraint fails

---

## Preview Rendering (renderPreviewNode)

1. `!visible && showDimmed` → gray row with 🔒 + `_enableWhenText`; if the node is a group, its children are also rendered as disabled (N/A) rows so every builder node has a corresponding preview row
2. `disabled` → gray row with `—` icon, pointer-events:none
3. `type:'group'` with no children → italic gray text (informational display, no controls, no logic badge)
4. Normal → row with ✔/✘ icon, control, linkId prefix, AND/OR badge (groups)
- `_renderStyle` applied as inline `style` on the label span in all row types

### Informational badges (per row)
- **Calc badge** — blue pill with current computed value; refreshed in-place by `refreshCalcBadges()` without full DOM rebuild; tooltip shows FHIRPath expression + SDC spec footer
- **Constraint badge** — amber ⚠️ (warning) or red ✘ (error) when `node.constraint[]` non-empty; tooltip shows key/human/expression; error + fail blocks Final Result
- **Read-only badge** — grey 🔒 `read-only` pill when `_readOnly === true` and no `_calculatedExpr`; `.preview-meta-badge` in `css/preview.css`
- **Default badge** — purple ↺ `default` pill when `_initialValue` is defined; `.preview-meta-badge--init` in `css/preview.css`

---

## FHIR Item Type Support

| FHIR R4 type | `itemType` | Control | Validation | Notes |
|---|---|---|---|---|
| `boolean` | `checkbox` | ✅ | — | |
| `integer`, `decimal` | `number` | ✅ | ✅ `minValue`/`maxValue` validation | `questionnaire-minValue` / `questionnaire-maxValue` extensions enforced; error badge shown; blocks PASS; if `_sliderStep` is set, renders as `<input type="range">` slider instead |
| `quantity` | `quantity` | ✅ number + unit dropdown (UCUM) | ✅ required = value+unit filled | `questionnaire-unit` extension read/written |
| `string`, `text` | `text` | ✅ | — | |
| `date` | `date` | ✅ custom calendar picker | — | |
| `dateTime` | `dateTime` | ✅ custom calendar + time inputs | — | Stored as `YYYY-MM-DDTHH:MM:SS`; QR → `valueDateTime` |
| `time` | `time` | ✅ native `<input type="time">` | — | Stored as `HH:MM:SS`; QR → `valueTime` |
| `url` | `url` | ✅ | ✅ `new URL()` | Invalid format → ✘ even if optional |
| `choice` | `select` / `radio` | ✅ | — | `questionnaire-itemControl: radio-button` → `radio` |
| `open-choice` | `open-choice` | ✅ text + datalist | — | Free-text allowed; datalist populated from `answerOption[]` |
| `display` | `display` | ✅ label | — | No control, no pass/fail |
| `group` | `group` | ✅ | — | |
| `group` (no children) | `group` | ✅ `[Info]` | — | |
| `attachment` | `attachment` | ✅ file input | ✅ required = file chosen | |
| `reference` | `reference` | ✅ dropdown (resource type) + id input | ✅ required = type+id filled | `questionnaire-referenceResource` extension locks dropdown; no live FHIR server search |

---

## FHIR Import (`importFHIR`)

- `enableWhen[]` + `enableBehavior` → `node.enableWhen[]`, `node.enableBehavior`, `node._enableWhenText`
- `sdc-questionnaire-enableWhenExpression` → `node.enableWhenExpression`
- `questionnaire-constraint` extensions → `node.constraint[]`
- `type:group` → group node; `type:boolean` → `itemType:'checkbox'`; `type:choice` → `itemType:'select'` or `'radio'` (if `questionnaire-itemControl: radio-button`)
- `_text.extension[rendering-style]` → `_renderStyle` (applied as inline CSS in preview)
- `item.prefix` → `node._prefix` (amber badge in preview; editable in builder; exported back)
- `item.code[]` → `node._codes` (preserved as-is; exported back unchanged)
- `item.repeats` → `node.repeats` (multi-row input; not for checkbox/display)
- `item.maxLength` → `node._maxLength` (character counter + `maxlength` HTML attribute enforced in preview)
- `questionnaire-minOccurs` ext → `node._minOccurs` (imported/exported when repeats:true)
- `questionnaire-maxOccurs` ext → `node._maxOccurs` (enforced in preview)
- `questionnaire-minValue` ext (`valueDecimal`/`valueInteger`) → `node._minValue` (enforced in preview — error badge + blocks PASS)
- `questionnaire-maxValue` ext (`valueDecimal`/`valueInteger`) → `node._maxValue` (enforced in preview — error badge + blocks PASS)
- `ordinalValue` extension on `answerOption[].extension` (primary, per FHIR R4 spec) or `answerOption[].valueCoding.extension` (fallback for older files) → `node._optionOrdinals` (map of code → score; shown as `(N)` badge in radio/select)
- `questionnaire-sliderStepValue` ext (`valueDecimal`/`valueInteger`) → `node._sliderStep` (renders integer/decimal as range slider in preview; editable in Answer Type modal)
- `item.disabledDisplay` (R4B native field) → `node._disabledDisplay`; R4 backport extension `extension-Questionnaire.item.disabledDisplay` also read
- `linkIdMap` built before parsing → used for human-readable condition text in `_enableWhenText`

## FHIR Export (`exportFHIR`)

- `node.enableWhen[]` → standard FHIR `item.enableWhen[]` (shallow-copied directly)
- `node.enableBehavior === 'any'` → `item.enableBehavior: 'any'`
- `node.enableWhenExpression` → SDC `sdc-questionnaire-enableWhenExpression` extension
- `node.constraint[]` → `questionnaire-constraint` extensions
- `node._maxLength` → `item.maxLength` (when set)
- `node._minOccurs` → `questionnaire-minOccurs` extension (when `node.repeats`)
- `node._maxOccurs` → `questionnaire-maxOccurs` extension (when `node.repeats`)
- `node._minValue` → `questionnaire-minValue` extension (`valueInteger` when integer, `valueDecimal` otherwise)
- `node._maxValue` → `questionnaire-maxValue` extension (`valueInteger` when integer, `valueDecimal` otherwise)
- `node._optionOrdinals` → `ordinalValue` extension on each `answerOption[].extension` (at answerOption level, per FHIR R4 spec) that has an entry
- `node._sliderStep` → `questionnaire-sliderStepValue` extension (`valueInteger` when `Number.isInteger`, otherwise `valueDecimal`)
- `node._disabledDisplay` (when not `'protected'`) → `item.disabledDisplay` (omitted when `'protected'` as it is the default)
- `itemType:'radio'` → exports `type:'choice'` + standard `questionnaire-itemControl: radio-button` extension (round-trip safe)
- Downloads as `<name>.json` (user prompted for filename)

---

## Key UX Features

- **Bidirectional navigation** — `↗` icon on every active preview row (visible on hover; `data-testid="preview-nav-btn"`) → scroll+flash builder node (teal); click builder node header → scroll+flash preview row (blue); `↗` button on every builder node header provides explicit one-click navigation to the corresponding preview row; dimmed and disabled rows remain fully clickable (no interactive controls there)
- **Drag & drop reorder** — ⠿ handle on every node; drag to reorder, drop between nodes (blue line), drop into group (dashed zone), drop at root level; ancestor→descendant drop blocked
- **Collapse sections (preview)** — `▼/▶` toggle on each group row in the preview; SVG corner-arrow icon buttons in the preview toolbar collapse/expand all (appear when tree is non-empty, right-aligned via flex spacer)
- **Preview toolbar order** — `⬆ Load ▾` | `⬇ Export` | 🔍 Search | [flex spacer] | `id` toggle | `prefix` toggle | collapse | expand; search and collapse/expand shown only when tree has content
- **Required boolean tristate** — `boolean`/`checkbox` items with `required: true` render an indeterminate (gray-fill) checkbox when unanswered (`values[id] === undefined`); first click → `true`; subsequent clicks toggle `true ↔ false`; `calcFormOk` passes for both `true` and `false` — only `undefined` fails (FHIR: `required` means an answer must be given, not that the answer must be `true`)
- **Editable linkId** — blue monospace input in the builder node header; directly edits `node.id`
- **item.prefix** — FHIR R4 `Questionnaire.item.prefix` imported into `node._prefix` and exported back (round-trip safe); amber pill badge in preview; editable in builder meta-row; **Renumber** assigns sequential prefixes (e.g. `1`, `1.1`) — writes `_prefix` only, never changes `node.id`
- **linkId / prefix toggles** — `id` (blue) and `prefix` (amber) buttons in preview toolbar toggle the corresponding pill badges; state stored in `showLinkId` / `showPrefix` refs; clicking a linkId badge copies the linkId to clipboard (✓ copied feedback); badge shows rich tooltip with visibility-rule usage, expected value type, item type
- **SDC Variables** — `sdc-questionnaire-variable` extensions on the root Questionnaire are imported into `questVariables[]`; a collapsible card above the tree shows `%name` chips (with rich tooltips showing expression + FHIR spec footer); Edit modal uses draft pattern — Apply commits, Cancel discards; variables passed as `%varName` env vars when evaluating `calculatedExpression`; round-trip safe on export
- **Default value (item.initial[])** — `item.initial[0]` imported → `node._initialValue`; pre-fills the preview on load (`applyInitialValues` runs inside the `_bulkUpdate` block so `effect()` sees filled values on first run); editable via **Default** action panel in builder; control adapts to itemType (select for checkbox/choice, date, number, text); `× clear` link updates preview instantly; exported back as `item.initial[]`
- **Constraint modal** — **Constraint** action button opens a centered modal (`js/ui/constraint-modal.js`) with draft pattern; editable cards per constraint (key, severity, human message, FHIRPath expression, remove) + **+ Add constraint**; Apply commits, Cancel discards; exported as `questionnaire-constraint` extensions
- **Constraint badge in preview** — per-node badge: amber ⚠️ `constraint` (warning or passing error), red ✘ `constraint` (failing error); tooltip; affects Final Result when `severity: 'error'` and expression fails or returns empty
- **Read-only enforcement** — `_readOnly: true` items show a styled `.preview-readonly-value` placeholder (value or `—`) instead of an input; input cannot be edited; 🔒 `read-only` badge shown; does not block PASS/FAIL
- **maxLength enforcement** — `node._maxLength` sets the `maxlength` HTML attribute on text/url inputs + renders a live character counter `(N/M)` below the input
- **minValue/maxValue enforcement** — `questionnaire-minValue` / `questionnaire-maxValue` extensions imported into `_minValue`/`_maxValue`; `min`/`max` HTML attributes set on number inputs; error badge shown inline when value is out of range; blocks PASS/FAIL
- **ordinalValue display** — `ordinalValue` extension on `answerOption.extension` (or `valueCoding.extension` fallback) imported into `_optionOrdinals`; shown as `(N)` badge on each radio option label and in the select trigger + dropdown items; exported back to `answerOption.extension` (FHIR R4 spec); editable in Answer Type modal — append `=score` to any option: `code=Label=0,code2=Label2=1`
- **Slider input** — `questionnaire-sliderStepValue` extension imported into `_sliderStep`; when set, integer/decimal item renders as `<input type="range">` with a live value label; `min`/`max` attrs from `_minValue`/`_maxValue` (default 0/100); step from `_sliderStep`; exported back as `questionnaire-sliderStepValue` (`valueInteger` or `valueDecimal`); editable in Answer Type modal — Min / Max / Slider step fields shown for integer/decimal types
- **disabledDisplay** — `item.disabledDisplay` (R4B native field, also R4 backport extension) imported into `_disabledDisplay`; `'hidden'` removes the item row entirely from the DOM when condition is not met (vs `'protected'` default which grays it out); exported back; editable in Show When modal — dropdown `When not visible: Show grayed (protected) / Remove from view (hidden)`
- **Read-only badge** — grey 🔒 `read-only` pill when `_readOnly === true` and no `_calculatedExpr`
- **Default badge** — purple ↺ `default` pill when `_initialValue` is defined
- **Real-time calc badge** — `refreshCalcBadges()` patches calc-badge in-place via `data-calc-id` — no DOM rebuild on answer change
- **Calc-badge tooltip** — shows FHIRPath expression + SDC spec footer
- **Show When modal** — "Show When" action button opens a centered modal (`js/ui/showwhen-modal.js`); draft pattern — `enableWhen[]`, `enableBehavior`, `enableWhenExpression` deep-cloned on open; Apply commits to node + calls `triggerCalcRecalc()`; Cancel discards; action button indicator only changes on Apply (no-op `setActive` passed during editing)
- **Searchable question picker** — enableWhen condition rows have a sticky search input filtering by `id` and title; dropdown rendered as a portal (`document.body`) with `position: fixed` + `getBoundingClientRect()` — escapes `overflow` clipping in any ancestor; auto-flips upward if needed; z-index 10200
- **QR Export** — **⬇ Response** button in toolbar; prompts for filename; downloads current answers as FHIR R4 `QuestionnaireResponse` JSON with `authored` timestamp
- **QR Import (Load Answers)** — **Load Answers…** at bottom of Load dropdown; reads a QR JSON file; loads matched answers into `values[]`; shows warning modal for URL mismatch or unknown linkIds
- **Repeatable items** — `Repeatable` action link opens `js/ui/repeatable-modal.js`; modal: toggle for `node.repeats` + optional **Min** / **Max** cardinality inputs (`questionnaire-minOccurs` / `questionnaire-maxOccurs`); preview renders `.repeat-wrap` with `×` remove + `+ Add another`; `_maxOccurs` enforced — add button disabled at limit; QR export collects all rows into `answer[]`; QR import restores rows; `item.maxLength` imported/exported as `node._maxLength`
- **Shared modal system** — all dialogs (Variables, Show When, Constraints, Patient Context, Validate, Expression Explain) use `.modal-backdrop / .modal-box / .modal-header / .modal-close / .modal-body / .modal-footer / .modal-btn` from `css/modals.css`; per-modal z-index and width via `#id` selectors; tokens `--c-hover` and `--c-text-1` added to `css/styles.css`; title pattern: `.modal-title-label` (bold) + `.modal-title-subject` (muted)
- **Rich tooltips on action buttons** — all builder action buttons (Answer Type, Required, Show When, Applicability, Expression, Default, Appearance), toolbar buttons (Load, Export, Add Root Group, Renumber, prefix format select, id/prefix/collapse/expand), and the Variables card title carry `data-tip-*` attributes with FHIR field path and spec reference (R4 / SDC) in the footer; implemented via delegated `mouseover` in `js/ui/tooltip.js`
- **Tooltip toggle** — `tips` button in the preview toolbar; green = enabled (default), orange = disabled; persisted in `localStorage` (`tooltips-enabled`); **tooltips off** label shown next to Logic Builder heading when disabled
- **Radio answer options in builder** — Answer Type panel shows the Options (comma-separated) editor for `radio` items (bug fix: was shown only for `select` and `open-choice`)
- **Validate button** — standalone **Validate** button in the Questionnaire Preview header; runs `validateTree()`; shows green ✅ "All good" when no issues; only visible when questionnaire is loaded
- **Esc closes modals** — Validate modal and Variables modal both close on Escape key
- **Ctrl+F** — intercepts browser find and focuses preview search input (when visible)
- **Auto calculatedExpression** — `_calculatedExpr`/`_readOnly` nodes evaluated via FHIRPath automatically on every `effect()` run (patient input, answer, or tree change); `buildVarEnv` resolves `questVariables` as `%varName`; no manual Test button
- **Expression Explain modal** — clicking a checkbox `calc-badge` or `👁️`/`🔒` condition-hint badge opens a shared modal; expression parsed into AND/OR/NOT/LEAF tree with ✓/✗ icons; FHIRPath strip at body bottom; single Close button; tooltip says "Click to explain."
- **Live eval icons in builder panels** — `✓`/`✗` icon (`.expr-live-icon`) right of label in `calculatedExpression`, `initialExpression`, `enableWhenExpression` panels; refreshed on panel open + after every recalc; typing lag eliminated: `oninput` → data + debounced icon (400ms); full recalc only on `onblur`
- **Empty-state placeholder** — right panel shows hint text when tree is empty; Validate, Export hidden until questionnaire is loaded
- **Variables card visibility** — controlled solely by `effect()` in `app.js` based on `tree.length`; `refresh()` only updates chips/count
- **PASS/FAIL status badge** — replaces the full-width status bar; a small pill badge (`✓ PASS` / `✗ FAIL · N issues`) in the preview header right of the filename; click opens a dark dropdown listing numbered failing items with ↗ links to navigate directly to the problem field; dropdown has scroll, closes on outside click; implemented in `js/ui/status-badge.js` + `css/status-badge.css`
- **Collapse-safe navigation** — `navigateToPreview(id)` in `render-preview.js` finds collapsed ancestors via `findAncestorGroupIds`, expands them, then scrolls; used by ↗ builder buttons and status-badge dropdown
- **Autosave toggle** — `autosave` button in Logic Builder header (green = on, grey = off); when enabled label shows last save time `autosave · HH:MM`; state persisted in `localStorage` (`autosave-enabled`); rich tooltip explains the feature
- **Variables modal Apply/Cancel** — modal uses a draft pattern: edits are buffered until Apply; Cancel discards the draft (no changes); Apply validates (blocks if name missing), commits to `questVariables`, calls `reinitForm()`; Escape or backdrop = Cancel
- **Variable chip tooltips** — `%varName` chips carry rich tooltips with expression + `Questionnaire.extension[sdc-questionnaire-variable]` FHIR path + SDC spec footer
- **Copyright + GitHub in top panel** — copyright text and GitHub link moved to the top (patient data) panel, right-aligned; order: GitHub icon → copyright text
- **Expandable title** — node title shown as a read-only span; click → expands to a full-width textarea (auto-height), collapses on blur
- **Style editor** — `Style` panel on every node: Bold / Italic checkboxes, color picker, raw CSS field. Syncs with `_renderStyle`; applied live in preview
- **Auto-scroll on add** — `+ Group`, `+ Item`, `Add Root Group` scroll to and flash the new node; parent group auto-expands
- **Visual condition builder** — "Show When" action panel uses FHIR `enableWhen[]` directly: AND/ANY toggle, per-condition rows (question picker + operator + type-aware value input), "+ Add condition", FHIRPath `enableWhenExpression` for advanced expressions
- **Patient Context popup** — "Patient Context" button in toolbar opens modal; sets `%age`, `%gender`, `%bmi`, `%pregnant`, `%smoker`, `%proc`, `%comorb` as FHIRPath literal expressions in `questVariables`; button disabled when no questionnaire is loaded; Apply increments `_formTick` → immediate preview re-eval; fires `patient-ctx-applied` event → `variablesPanel.refresh()` updates chips
- **AND/OR badges** — on group headers: `ALL items ✓` / `ANY item ✓`
- **Logic separators** — `— AND —` / `— OR —` between sibling items inside a group
- **Dimmed rows** — conditional items shown grayed (🔒) when condition not met; groups also show their children as disabled (N/A) rows; animate to active when met
- **Informational rows** — `type:'group'` nodes with no children rendered as plain italic text; labeled `[Info]` in builder
- **required text/number** — `required:true` on text/number items means non-empty; shows ✔/✘ icon and affects PASS/FAIL
- **select / radio controls** — no longer auto-fill the first option on render; mandatory fields start empty (`— select —` placeholder for select, no pre-check for radio) so PASS/FAIL is accurate on initial load
- **text / number / date / url / attachment / quantity / reference controls** — `oninput` calls `_reCalc()` (calc badge updates live) without triggering a full preview rebuild; `onchange`/blur increments `_formTick.value++` (re-evaluates enableWhen + constraints on discrete commit)

---

## Running

> **Requires HTTP server** — ES modules do not work over `file://`.

### Locally
```powershell
.\start.ps1
# or: npx serve .
# open http://localhost:3000
```

### GitHub Pages
https://sergeymosyakov.github.io/fhir-questionnaire-builder/

---

## Known Limitations / TODO

- Multi-condition visibility with complex FHIRPath (cross-group references, extensions) not supported in the visual enableWhen builder — must be typed as `enableWhenExpression` directly

