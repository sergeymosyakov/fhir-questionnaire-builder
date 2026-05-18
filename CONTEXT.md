# QuestionaryPrototype — Build Context

## ⚠️ WORKFLOW RULES — MANDATORY

1. **git commit/push only on explicit user instruction** ("push it", "пушай"). Never automatically.
2. **Before every push** — update CONTEXT.md, docs/CONTEXT.md, docs/FHIR-MAPPING.md (if FHIR mapping changed), and README.md (file table, UX features, Known Limitations).
3. **Modularity** — new UI widget → `js/ui/<name>.js`; new control → `js/controls/<name>.js`; new CSS concern → `css/<name>.css` + `<link>` in index.html. Do not add logically separate code into existing modules.
4. **DI** — DOM resolved once in `app.js`, passed via `init(elements)`. No `getElementById` inside submodules.
5. **No inline styles** — `style="..."` in HTML and `el.style.foo =` in JS are forbidden for static values. Allowed only for **runtime-dynamic** values: show/hide (`display`), computed dimensions, user-driven colors. All static appearance → CSS classes.
6. **English only** — all code comments, doc strings, commit messages, CONTEXT.md, README.md, any in-repo text, **and all UI labels, button text, and tooltip text in HTML and JS** must be in English. No Russian anywhere in the codebase.
7. **E2E test selectors** — selectors in `tests/e2e/*.spec.js` must use `data-testid` (via `element.dataset.testid`) where applicable. No raw class or tag selectors. When adding a testable element, register its ID in the registry comment at the top of the relevant spec file.

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
| `css/modals.css` | Shared modal system (`.modal-backdrop`, `.modal-box`, `.modal-header`, `.modal-close`, `.modal-body`, `.modal-footer`, `.modal-btn`, `.modal-title-label/subject`) + per-modal z-index/size overrides via ID selectors |
| `js/state.js` | Reactive state, data factories, business logic, `evalConstraints` |
| `js/utils.js` | Pure utility functions (`escAttr`, `findAndRemove`, `isDescendant`, `findAncestorGroupIds`, `parseOption`, `parseOptions`) |
| `js/eval.js` | Tree evaluation — `enableWhen[]` visibility, `enableWhenExpression` FHIRPath, `evalConstraints` |
| `js/render-builder.js` | Left panel — 3-line re-export shim → `js/builder/` |
| `js/builder/ctx.js` | `BuilderCtx` JSDoc typedef (no runtime exports) |
| `js/builder/index.js` | Builder orchestrator — public API (`renderTree`, `collapseAll`, etc.) |
| `js/builder/_shared.js` | Shared utilities; injected deps via `init(deps)` |
| `js/builder/dnd.js` | Self-contained drag & drop; all state via `init(onDrop, tree, formTick)` |
| `js/builder/panels.js` | Action panel builders: enableWhen vis panel (`buildVisPanel`), type+options (`buildTypePanel`). `buildMandPanel` / `buildStylePanel` / `buildInitialPanel` still exist but are no longer called — those actions moved to `required-modal.js`, `appearance-modal.js`, `initial-modal.js` |
| `js/builder/node-item.js` | `renderItem(node, ctx)` — opens `showwhen-modal`, `expression-modal`, `constraint-modal`, `initial-modal`, `appearance-modal`, `required-modal` for respective action links; only `type` remains as inline panel |
| `js/builder/node-group.js` | `renderGroup(node, ctx)` — opens `showwhen-modal`, `expression-modal`, `required-modal` for respective action links; `style` still uses inline `buildStylePanel` |
| `js/render-preview.js` | Right panel — async preview render; `reinitForm()` async with progress; `_asyncRender(version)` splits FHIRPath eval (Phase 1) from DOM rebuild (Phase 2) with `_yield()` breaks; stale renders self-abort via `_renderVersion`; exports `navigateToPreview(id)`, `refreshExprIcons()` |
| `js/controls/index.js` | Control registry — dispatches by `itemType` |
| `js/controls/{type}.js` | Per-type control implementations. `select` and `open-choice` use custom portal dropdowns (`.sc-trigger` / `.oc-wrap`) instead of native `<select>` / `<datalist>` for consistent cross-platform rendering |
| `js/patient.js` | **Removed** — patient context now managed as FHIRPath literal expressions in `questVariables` via `js/ui/patient-ctx.js` |
| `js/fhir/export.js` | Internal model → FHIR R4 |
| `js/fhir/qr-export.js` | `exportQR(fileName)` — builds QR from current tree + answers, adds `authored` timestamp, downloads JSON |
| `js/fhir/qr-import.js` | `importQRAnswers(qrJson, values, tree)` — validates `resourceType`, flattens QR `item[]` recursively into `{linkId: value}`, loads matched answers into `values`, returns `{ok, loaded, unmatched, questionnaire}` |
| `js/fhir/validate.js` | `validateTree(tree)` → `{severity,nodeId,message}[]`; linkId uniqueness, JS/FHIRPath syntax, empty titles, missing options |
| `js/ui/validate-modal.js` | Validation modal UI — `init(elements)` + `show(title, issues, mode, onExport?)`; no hardcoded DOM IDs |
| `js/ui/variables-panel.js` | SDC Variables card + edit modal — `init(elements, questVariables, onReinit)`, `refresh()`; collapsible chip list with `%name` chip tooltips (expression + FHIR footer); modal uses draft pattern — edits are buffered until Apply; Cancel discards draft; Apply validates (blocks on missing name) then commits to `questVariables` and calls `reinitForm()` |
| `js/ui/showwhen-modal.js` | Show When (enableWhen) centered modal — `init(elements)`, `open(node, visLink, setActive, ctx, buildVisFn)`, `close()`; draft pattern: deep-clones `enableWhen[]`, `enableBehavior`, `enableWhenExpression` on open; Apply commits to node + calls `triggerCalcRecalc()`; Cancel discards; no-op `setActive` passed to `buildVisPanel` so the action button state only changes on Apply |
| `js/ui/constraint-modal.js` | Constraint edit modal — `init(elements)`, `open(node, constraintLink, setActive)`; draft pattern: deep-clones `node.constraint[]` on open; Apply commits + calls `triggerCalcRecalc()` + updates button state; Cancel discards; expression field is a resizable `.expr-textarea`; each constraint card has an **Explain** button that opens `explain-modal` via `window.fhirpath` |
| `js/ui/expression-modal.js` | Config-driven modal for `_calculatedExpr` and `_initialExpr` FHIRPath fields — `init(elements)`, `open(cfg)` where cfg = `{node, link, setActive, field, label, fhirLabel, hint, placeholder, onApply}`; auto-resize `.expr-textarea`; live expr icon via debounced `refreshExprIcons`; draft pattern; closes on Escape / backdrop click |
| `js/ui/initial-modal.js` | Default Value edit modal — `init(elements)`, `open(node, initLink, setActive)`; draft pattern; renders context-aware control per `itemType` (checkbox→select, select/radio/open-choice→select, date→date input, number/integer/decimal/quantity→number input, text→textarea, others→text input); Apply commits `node._initialValue` + `values[node.id]` + calls `triggerCalcRecalc()` |
| `js/ui/appearance-modal.js` | Appearance (rendering-style) edit modal — `init(elements)`, `open(node, styleLink, setActive)`; draft pattern; Bold / Italic checkboxes, color picker + clear, raw CSS `<textarea rows=1 resize:vertical>`; `syncFromWidgets()` and `syncFromRaw()` keep checkboxes / color / textarea in sync; Apply sets `node._renderStyle` |
| `js/ui/required-modal.js` | Required (mandatory) edit modal — `init(elements)`, `open(node, mandLink, setActive)`; draft pattern; `<select>` with 3 options: null (Not set) / true (Yes) / false (No); Apply sets `node.mandatory`; `setActive` called only when `mandatory === true` |
| `js/ui/patient-ctx.js` | Patient presets dropdown — 5 built-in profiles (Adult Male, Adult Female, Obese Male, Child, Pregnant Female) + Custom…; `Patient ▾` button in toolbar; selecting a preset auto-applies patient vars and fires `reinitForm()`; seeds `%age`, `%gender`, `%bmi`, `%pregnant`, `%smoker`, `%proc`, `%comorb` as FHIRPath literal expressions in `questVariables` |
| `js/ui/progress.js` | Global progress bar — `init(elements)`, `show/update/hide` |
| `js/ui/search.js` | Preview search — `init(elements)`, `refresh()`; highlight + up/down/Enter navigation |
| `js/ui/tooltip.js` | Rich tooltip system — delegated `mouseover` on `[data-tip-title]` / `[data-tip-body]`; positions card below (or above) target; supports `data-tip-fhir` + `data-tip-spec` FHIR footer |
| `js/fhir/explain.js` | FHIRPath boolean expression tree parser + evaluator — `parseExprTree(expr)` splits on top-level `and`/`or`/`not(...)` into AND/OR/NOT/LEAF nodes; `evaluateExprTree(node, fp, resource, env)` adds `result: boolean` to each node |
| `js/ui/explain-modal.js` | Expression Explain modal — `show(expr, fp, resource, env)` renders AND/OR/NOT/LEAF tree with ✓/✗ icons in shared modal; single Close button; FHIRPath strip at body bottom; `hide()` closes it |
| `js/ui/autosave.js` | Background autosave — `init(buildFn, onSaved)` starts 15 s interval; `onSaved(date)` callback; `getDraftMeta/getDraftData/clearDraft` API; persists to `localStorage` |
| `js/ui/status-badge.js` | PASS/FAIL pill badge in preview header — `init(elements, navigateFn)`, `update({anyVisible, hasCriteria, finalOk, failingItems})`; dark dropdown with numbered issues + ↗ navigate links |
| `sampledata/example-bariatric.fhir.json` | Built-in example loaded on startup. Constraints: `diet-min-months` (error, integer ≥ 3), `phq9-severity` (warning, score < 15), `bmi-eligibility` (error, readOnly calc ≥ 35) |
| `sampledata/bariatric-extended.fhir.json` | Synthetic bariatric pre-auth — 87 items, 32 enableWhen, all types |
| `sampledata/ussg-fht.fhir.json` | US Surgeon General Family Health History (49 items, depth 5) |
| `sampledata/prowl-ss.fhir.json` | PROWL-SS post-op pain assessment (44 items) |
| `sampledata/phq-9.fhir.json` | PHQ-9 depression screening (11 items) |
| `sampledata/1776102565767-...json` | Real-world questionnaire snapshot for regression testing |
| `sampledata/patient-scenario-eligibility.fhir.json` | Scenario: Bariatric Surgery Eligibility — `initialExpression` fills patient fields, `enableWhenExpression` gates Adult/Pediatric/Pregnancy/Smoker pathways |
| `sampledata/patient-scenario-risk.fhir.json` | Scenario: Pre-op Risk Assessment — readOnly fields with `initialExpression`, risk groups gated by `enableWhenExpression` |
| `sampledata/patient-scenario-calc-chain.fhir.json` | Scenario: Risk Score Calc Chain — full `initialExpression` → `calculatedExpression` → `enableWhenExpression` pipeline; LOW/MODERATE/HIGH per preset |
| `ROADMAP.md` | Prioritized feature roadmap (Now / Next / Later) |
| `docs/FHIR-MAPPING.md` | Full FHIR ↔ internal model mapping + not-supported list |
| `package.json` | Node dev tooling — Vitest (`npm test`) + Playwright (`npm run test:e2e`); `serve` devDep used by Playwright webServer |
| `vitest.config.js` | Vitest config — node environment, `tests/**/*.test.js` |
| `playwright.config.js` | Playwright config — Chromium only, `testDir: tests/e2e`, auto-starts local `serve` (via `node node_modules/.bin/serve`); reporters: `html` (open:never) + `list` |
| `tests/e2e/builder.spec.js` | E2E tests (24) — load/clear form, collapse/expand group, FHIR export, group title edit, delete item/group (cascade), type changes (checkbox/display), bidirectional navigation flash (builder↔preview), node count match on import, answer state persistence, **enableWhen (standard Show When modal)**, **patient preset section visibility** (enableWhenExpression), **Re-init / initialExpression population**; all selectors via `data-testid` / `data-node-id` / `data-preview-id`; fixtures loaded from `tests/fixtures/` via `setInputFiles` |
| `tests/fixtures/` | **Frozen** copies of FHIR sample files used by e2e tests. Do not edit — tests depend on exact content. Currently: `example-bariatric.fhir.json`, `patient-scenario-eligibility.fhir.json` |
| `tests/utils.test.js` | Unit tests for `js/utils.js` (22 tests) |
| `tests/eval.test.js` | Unit tests for `js/eval.js` — `evaluateNode`, `markAllDisabled`, `enableWhen` AND/OR logic (23 tests) |
| `tests/calc.test.js` | Unit tests for `js/fhir/calc.js` — `buildVarEnv`, `evalCalcNodes` (11 tests) |
| `tests/validate.test.js` | Unit tests for `js/fhir/validate.js` — `validateTree` (21 tests) |
| `tests/export.test.js` | Unit tests for `js/fhir/export.js` — `buildFHIRObject`, enableWhen, constraints, SDC variables, `integer`/`decimal`/`number` type mapping (39 tests) |
| `tests/import.test.js` | Unit tests for `js/fhir/import.js` — `fhirTypeToItemType`, `fhirOptsToStr`, `humanEnableWhen`, `applyVisibility` (45 tests) |
| `tests/qr-builder.test.js` | Unit tests for `js/fhir/qr-builder.js` — `buildQR`, `buildQRItem`, `integer`→`valueInteger` / `decimal`→`valueDecimal` mapping (31 tests) |
| `tests/state.test.js` | Unit tests for `evalConstraints` in `js/state.js` — severity filtering, empty/false/throw/empty-expression results, varEnv passing (16 tests) |
| `tests/integration.test.js` | Integration tests for `buildQR` + `evalConstraints` pipeline — decimal/integer pass/fail, wrong key regression, warning-only, nested groups (7 tests) |
| `.github/workflows/test.yml` | GitHub Actions CI — `test` job: Vitest; `e2e` job: Playwright (uploads `playwright-report/` artifact); `deploy` job: bundles app + report into `_site/`, deploys to GitHub Pages (`/playwright-report/` = latest test report); both `test`/`e2e` triggered on every push/PR to main |

---

## Tech Stack

- **`@vue/reactivity`** (ESM CDN) — only `ref`, `reactive`, `effect`. No Vue components.
- **ES Modules** — `import/export` between files; requires HTTP server (`npx serve .` or GitHub Pages)
- **Vanilla JS DOM** — left panel (builder) constructed imperatively
- **`effect()`** — subscribes to reactive deps (`_formTick`, `rawFhir`, `showLinkId`, `showPrefix`, `showBadges`), fires `_asyncRender(++_renderVersion)` fire-and-forget; all heavy work in the async function
- **FHIRPath** — `window.fhirpath` (global, `lib/fhirpath.min.js`); used in `enableWhenExpression`, `calculatedExpression`, `evalConstraints`, and `buildVarEnv`
- **Dependency injection** — `dnd.js` and `_shared.js` receive all state via `init()`, no module-level singletons
- **`ctx` object** — `{ renderTree, renderNode, tree, formTick, collapsed }` passed down to renderers and panels
- **Vitest** — unit test suite for pure-function modules; **221 tests** across 9 files; CDN imports mocked via `vi.mock`; CI via GitHub Actions (`npm test`)
- **Playwright** — E2E test suite; **24 tests** (Chromium); CI via GitHub Actions (`npx playwright test`)
- **GitHub Pages** — https://sergeymosyakov.github.io/fhir-questionnaire-builder/

---

## Architecture

### Reactive State

```js
// Patient context — now stored as FHIRPath literal expressions in questVariables (js/ui/patient-ctx.js)
// Seeded as: { name:'age', expression:'30' }, { name:'gender', expression:"'male'" }, etc.
// Accessible in FHIRPath as %age, %gender, %bmi, %pregnant, %smoker, %proc, %comorb

// App state (js/state.js)
tree              // reactive([]) — questionnaire node tree
values            // plain object — form answers (not reactive; avoids re-render on every keystroke)
_formTick         // ref(0) — incremented on checkbox/select change to re-trigger effect()
questVariables    // reactive([]) — SDC sdc-questionnaire-variable entries; patient ctx seeded here
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
  itemType:'text'|'number'|'checkbox'|'select'|'display'|...,
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
```


## Evaluation Logic

### enableWhen
- `node.enableWhen[]` checked against `values[ew.question]` using `checkOneEnableWhen(ew)`
- `node.enableBehavior === 'all'` (default) → all conditions must pass (AND)
- `node.enableBehavior === 'any'` → any one condition passes (OR)
- If `enableWhenExpression` is set, it is evaluated via `fhirpath.evaluate()` as a fallback/override
- Node is hidden if conditions are not met; `showDimmed` set if any enableWhen is defined

### constraint[]
- Each `node.constraint[]` entry has `{ key, severity, human, expression }` (mirrors FHIR `questionnaire-constraint` extension)
- Evaluated via FHIRPath against the QuestionnaireResponse in `evalConstraints(node, qr, envVars)` in `state.js`
- Empty FHIRPath result (`[]`) or `false` → constraint **fails**; `true` → passes
- `severity: 'error'` fail blocks Final Result (counted as failing item); `severity: 'warning'` shows badge only
- Preview shows a badge per node: amber ⚠️ (warning, passing), amber ⚠️ (warning, failing), or red ✘ (error, failing)

### Final Result
- **PASS** — all visible, mandatory items are satisfied and no `error`-severity constraints fail
- **FAIL** — at least one mandatory item not satisfied, or at least one `error`-severity constraint fails

---

## Preview Rendering (renderPreviewNode)

1. `!visible && showDimmed` → gray row with 🔒 + `_enableWhenText`; if the node is a group, its children are also rendered as disabled (N/A) rows so every builder node has a corresponding preview row
2. `disabled` → gray row with `—` icon, pointer-events:none
3. `type:'group'` with no children → italic gray text (informational display, no controls, no logic badge)
4. Normal → row with ✔/✘ icon, control, linkId prefix, AND/OR badge (groups)
- `_renderStyle` applied as inline `style` on the label span in all row types

### Informational badges (per row)
- **Calc badge** — blue pill showing current computed value; updated in-place by `refreshCalcBadges()` without full DOM rebuild; has FHIRPath tooltip with SDC spec footer
- **Constraint badge** — amber ⚠️ (warning) or red ✘ (error) when `node.constraint[]` is non-empty; with tooltip showing key, human message, FHIRPath expression
- **Read-only badge** — grey 🔒 `read-only` when `_readOnly === true` and no `_calculatedExpr`
- **Default badge** — purple ↺ `default` when `_initialValue` is defined (non-empty)

---

## FHIR Item Type Support

| FHIR R4 type | `itemType` | Control | Validation | Notes |
|---|---|---|---|---|
| `boolean` | `checkbox` | ✅ | ✅ required = must be checked | |
| `integer`, `decimal` | `number` | ✅ | — | |
| `quantity` | `quantity` | ✅ number + unit dropdown (UCUM) | ✅ required = value+unit filled | Builder: Default unit dropdown; import/export `questionnaire-unit` extension |
| `string`, `text` | `text` | ✅ | — | |
| `date`, `dateTime`, `time` | `date` | ✅ date-picker | — | All three → `date` |
| `url` | `url` | ✅ | ✅ `new URL()` | Invalid format → ✘ even if optional |
| `choice` | `select` / `radio` | ✅ | — | `questionnaire-itemControl: radio-button` → `radio` |
| `open-choice` | `open-choice` | ✅ text + datalist | — | Dropdown suggestions + free-text via `<datalist>` |
| `display` | `display` | ✅ label | — | No control, no pass/fail |
| `group` | `group` | ✅ | — | |
| `group` (no children) | `group` | ✅ `[Info]` | — | |
| `attachment` | `attachment` | ✅ styled button | ✅ required = file chosen | Custom **Choose file** button |
| `reference` | `reference` | ✅ dropdown (resource type) + `/` + id input | ✅ required = type+id filled | `referenceResource` extension locks dropdown to one type; otherwise all 96 FHIR R4 types available |

---

## FHIR Import (`importFHIR`)

- `enableWhen[]` + `enableBehavior` → `node.enableWhen[]`, `node.enableBehavior`, `node._enableWhenText`
- `sdc-questionnaire-enableWhenExpression` → `node.enableWhenExpression`
- `questionnaire-constraint` extensions → `node.constraint[]`
- `type:group` → group node; `type:boolean` → `itemType:'checkbox'`; `type:choice` → `itemType:'select'` or `'radio'` (if `questionnaire-itemControl: radio-button`)
- `_text.extension[rendering-style]` → `_renderStyle` (applied as inline CSS in preview)
- `item.prefix` → `node._prefix` (amber badge in preview; editable in builder; exported back)
- `item.code[]` → `node._codes` (preserved as-is; exported back unchanged)
- `linkIdMap` built before parsing → used for human-readable condition text in `_enableWhenText`

## FHIR Export (`exportFHIR`)

- `node.enableWhen[]` → standard FHIR `item.enableWhen[]` (shallow-copied directly)
- `node.enableBehavior === 'any'` → `item.enableBehavior: 'any'`
- `node.enableWhenExpression` → SDC `sdc-questionnaire-enableWhenExpression` extension
- `node.constraint[]` → `questionnaire-constraint` extensions
- `itemType:'radio'` → exports `type:'choice'` + standard `questionnaire-itemControl: radio-button` extension (round-trip safe)
- Downloads as `<name>.json` (user prompted for filename before download)

---

## Key UX Features

- **Clear questionnaire** — `×` button next to the loaded file name clears tree, values, rawFhir; if tree is non-empty shows a modal asking to export first (Export first / Clear anyway / Cancel)
- **Loaded file name** — shown in right-panel header after import; also appears as `New Questionnaire` when building from scratch; `×` button always visible when tree is non-empty
- **Export filename prompt** — `window.prompt` before every export; pre-filled with current file name; adds `.json` if not already present
- **Bidirectional navigation** — click preview row → scroll+flash builder node (teal); click builder node header → scroll+flash preview row (blue); `↗` button on every builder node header (after `[Item]`/`[Group]` label) provides explicit one-click navigation to the corresponding preview row
- **Drag & drop reorder** — ⠿ handle on every node; drag to reorder, drop between nodes, drop into group, drop at root level; ancestor→descendant drop blocked. Drop zones appear only during drag (`body.dragging` CSS class, `height:0` → `28px`); labeled: "Drop here to add as first child" (top of group), "Drop here" (between siblings), "Drop here to add as last child" (bottom of group), "Drop here to move to end" (root zone). Each node wrapped in `div.node-wrap` (display:contents) so drop zones sit outside the styled box.
- **Collapse sections (preview)** — `▼/▶` toggle on each group row in the preview; SVG corner-arrow icon buttons (⊖/⊕ style) in the preview toolbar collapse/expand all (appear when tree is non-empty, right-aligned via flex spacer)
- **Preview toolbar order** — `⬆ Load ▾` | `⬇ Export` | 🔍 Search | [flex spacer] | `id` toggle | `prefix` toggle | collapse | expand; search and collapse/expand shown only when tree has content
- **Disabled groups clickable** — N/A (grayed `—`) groups in preview are still clickable to navigate to builder node
- **Editable linkId** — blue monospace input in the builder node header; directly edits `node.id`
- **Expandable title** — node title shown as a read-only span; click → expands to a full-width textarea (auto-height), collapses on blur
- **Appearance modal** — `Appearance` action button on every node opens a centered modal (`js/ui/appearance-modal.js`); draft pattern; Bold / Italic checkboxes, color picker, raw CSS `<textarea rows=1 resize:vertical>`; Apply commits `node._renderStyle`; applied live in preview as inline `style` on the label span
- **Show When modal** — "Show When" action button on every node opens a centered modal (not an inline panel); `js/ui/showwhen-modal.js`; **draft pattern** — `enableWhen[]`, `enableBehavior`, `enableWhenExpression` are deep-cloned on open; **Apply** commits to node + triggers preview re-render; **Cancel** / Escape / backdrop click discards all edits; the action button state (dark purple) updates only on Apply — no premature indicator changes during editing
- **Show When modal title** — two-part header: bold `.modal-title-label` ("Show When") + muted `.modal-title-subject` ("— Item Title"); consistent with shared modal title pattern
- **Searchable question picker** — custom dropdown in enableWhen condition rows has a sticky search input at the top; filters by `id` and title simultaneously; dropdown rendered as a portal (`document.body.appendChild`) with `position:fixed` + coordinates from `getBoundingClientRect()` — escapes `overflow:hidden/auto` in any ancestor; auto-flips upward if it would extend below the viewport; z-index 10200 (above all modals)
- **QR Export** — **⬇ Response** button in toolbar (visible when questionnaire is loaded); prompts for filename; downloads current answers as FHIR R4 `QuestionnaireResponse` JSON via `js/fhir/qr-export.js`; adds `authored` timestamp
- **QR Import (Load Answers)** — **Load Answers…** item at bottom of Load ▾ dropdown (visible when questionnaire is loaded); reads a `QuestionnaireResponse` JSON file; validates `resourceType`; maps QR `linkId` → `values[]` for matched items; if QR questionnaire URL mismatches current or there are unknown linkIds, shows a warning via the validate modal; implemented in `js/fhir/qr-import.js`
- **Shared modal system** — all dialogs (Variables, Show When, Constraints, Patient Context, Validate, Expression Explain) use the same `.modal-*` CSS classes; structural styles live once in `css/modals.css`; per-modal overrides (z-index, width, body padding) via `#id` selectors; design tokens `--c-hover` and `--c-text-1` added to `css/styles.css`; modal title pattern: `.modal-title-label` (bold) + `.modal-title-subject` (muted, right of label)
- **Auto-scroll on add** — `+ Group`, `+ Item`, `Add Root Group` scroll to and flash the new node; parent group auto-expands
- **AND/OR badges** — on group headers: `ALL items ✓` / `ANY item ✓`
- **Logic separators** — `— AND —` / `— OR —` between sibling items inside a group
- **Dimmed rows** — conditional items shown grayed (🔒) when condition not met; groups also show their children as disabled (N/A) rows; animate to active when met
- **Informational rows** — `type:'group'` nodes with no children rendered as plain italic text; labeled `[Info]` in builder
- **required text/number** — `required:true` on text/number items means non-empty; shows ✔/✘ icon and affects PASS/FAIL
- **required checkbox** — `required:true` on boolean items requires the box to be checked; shows ✔/✘; affects PASS/FAIL
- **required radio/select** — `required:true` on choice/radio items requires an option to be selected; shows ✔/✘ on item and group icon; affects PASS/FAIL
- **Required star** — `mandatory===true` items (default) show a red `*` in the label in preview
- **Optional badge** — `mandatory===false` items show a small italic `optional` badge in preview
- **Styled file input** — `attachment` renders as a custom **Choose file** button (blue, themed) + file name; native input hidden
- **Active action buttons** — action buttons (Show When, Expression, Required, Default, Appearance, Constraint, Read-only) turn **dark purple** when they have content set; initialised on load, updated in real-time on Apply; Required is active only when `mandatory === true`
- **Load ▾ dropdown** — single button opens a menu with all built-in samples + "From file…" option; replaces separate Load/Example buttons; no startup auto-load (empty-state placeholder shown instead)
- **item.prefix** — FHIR R4 `Questionnaire.item.prefix` imported from JSON into `node._prefix` and exported back; rendered as an amber pill badge before the item title in the preview; editable via the amber input in the builder node meta-row; **Renumber** button assigns sequential prefixes (e.g. `1`, `1.1`) using the selected format (numeric / roman / letters) — writes `_prefix` only, never changes `node.id`
- **linkId / prefix toggle badges** — `id` (blue) and `prefix` (amber) toggle buttons in preview toolbar; show/hide the corresponding pill badges on every preview row; active state tracked via `showLinkId` / `showPrefix` refs in `state.js`; clicking a linkId badge copies the linkId to clipboard and briefly shows `✓ copied`; badge shows rich tooltip with visibility-rule usage, expected value type, item type
- **SDC Variables** — `sdc-questionnaire-variable` extensions on root Questionnaire; imported → `questVariables[]` in state; collapsible card above tree shows `%name` chips; Edit button opens modal; variables evaluated as `%varName` in FHIRPath `calculatedExpression` automatically on every preview render; round-trip safe on export
- **Default value (item.initial[])** — `item.initial[0]` imported → `node._initialValue`; pre-fills `values[]` on load (`applyInitialValues` runs inside the `_bulkUpdate` block so `effect()` sees populated values on first run); editable via **Default** action modal (`js/ui/initial-modal.js`) — context-aware control per itemType; `× clear` link inside modal syncs preview instantly; exported back as standard `item.initial[]`
- **Constraint modal** — **Constraint** action button opens a centered modal (`js/ui/constraint-modal.js`) instead of an inline panel; same draft pattern as Show When — `node.constraint[]` deep-cloned on open; Apply commits + updates button indicator; Cancel discards; modal title: "Constraints — item title"
- **Constraint badge in preview** — per-node badge: amber ⚠️ `constraint` (warning or passing error), red ✘ `constraint` (failing error); tooltip shows key, severity, human message, FHIRPath expression; affects Final Result when `severity: 'error'` and expression fails
- **Read-only badge in preview** — grey 🔒 `read-only` pill when `node._readOnly === true` and no `_calculatedExpr`; CSS class `.preview-meta-badge` in `css/preview.css`
- **Default badge in preview** — purple ↺ `default` pill when `node._initialValue` is defined; CSS class `.preview-meta-badge--init` in `css/preview.css`
- **Calc-badge tooltip** — calculated value badge now carries `data-tip-*` tooltip showing the FHIRPath expression and SDC spec footer
- **Real-time calc badge** — `refreshCalcBadges()` updates calc-badge text+class in-place via `data-calc-id` attribute after each answer change — avoids full DOM rebuild while keeping the displayed value current
- **Show When modal** — "Show When" action button on every node opens a centered modal (`js/ui/showwhen-modal.js`); **draft pattern** — `enableWhen[]`, `enableBehavior`, `enableWhenExpression` deep-cloned on open; **Apply** commits to node + calls `triggerCalcRecalc()` (preview re-renders immediately); **Cancel** / Escape / backdrop click discards all edits; action button indicator (dark purple) only updates on Apply — no premature state change during editing; modal title: bold `.modal-title-label` ("Show When") + muted `.modal-title-subject` ("— item title")
- **Searchable question picker** — enableWhen condition rows have a sticky search input at the top of the dropdown; filters by `id` and title simultaneously; dropdown rendered as a **portal** (`document.body.appendChild`) with `position: fixed` + `getBoundingClientRect()` — escapes `overflow:hidden/auto` in any ancestor; auto-flips upward if bottom extends beyond viewport; z-index 10200
- **Shared modal system** — all dialogs (Variables, Show When, Constraints, Patient Context, Validate, Expression Explain) use the same `.modal-backdrop`, `.modal-box`, `.modal-header`, `.modal-close`, `.modal-body`, `.modal-footer`, `.modal-btn`, `.modal-btn--cancel`, `.modal-btn--apply` classes from `css/modals.css`; per-modal overrides (z-index, width, body padding) via `#id` CSS selectors only; design tokens `--c-hover` (`#f0f2f5`) and `--c-text-1` added to `css/styles.css`
- **Rich tooltips on action buttons** — all builder action buttons (Answer Type, Required, Show When, Expression, Default, Appearance), toolbar buttons (Load, Export, Add Root Group, Renumber, prefix format select, id/prefix/collapse/expand, Patient Context), and the Variables card title carry `data-tip-*` attributes with FHIR field path and spec reference; implemented via delegated `mouseover` in `js/ui/tooltip.js` — no per-element registration needed
- **Tooltip toggle** — `tips` button in the preview toolbar; green when enabled (default), orange when disabled; state persisted in `localStorage` (`tooltips-enabled`); a plain orange **tooltips off** label appears next to the Logic Builder heading when disabled
- **Radio answer options in builder** — Answer Type panel now shows the Options (comma-separated) editor for `radio` items (previously only shown for `select` and `open-choice`)
- **Export validation** — on Export: `validateTree()` runs; if issues found → modal with error/warning list, ↗ navigate-to-node button per issue, "Fix first" / "Export anyway" actions
- **Validate button** — standalone **Validate** button in the Questionnaire Preview header; runs same `validateTree()` check; shows green ✅ "All good" state when no issues; only visible when questionnaire is loaded
- **Esc closes modals** — Validate modal and Variables modal both close on Escape key
- **Ctrl+F** — intercepts browser find and focuses the preview search input (when search is visible)
- **Import validation** — same modal shown after loading a file/sample (mode: OK only)
- **Auto calculatedExpression** — `calculatedExpression` FHIRPath fields (SDC `_calculatedExpr`/`_readOnly` nodes) are evaluated automatically on every `effect()` run; for **checkbox** calc fields the badge shows `✓ true` / `✗ false` with green/red colouring; for **all other types** the computed value is shown as a soft blue pill (`.preview-calc-value` — `#f0f4ff` background, `#3b4db8` text, rounded border) distinct from status badges
- **Expression Explain modal** — shared modal system (backdrop + Close button); clicking a checkbox calc-badge or `👁️`/`🔒` condition-hint badge opens the modal; FHIRPath expression strip at the bottom of the body inside the modal
- **Live eval icons in builder panels** — `✓` / `✗` icon appears to the right of the label in the `calculatedExpression`, `initialExpression`, and `enableWhenExpression` panels; evaluated on panel open and after every form interaction; `oninput` updates only data + debounces icon refresh (400ms); `triggerCalcRecalc()` fires on `onblur` only — eliminates typing lag in expression fields
- **Initial expression (SDC `sdc-questionnaire-initialExpression`)** — **Init Expr** action button on every item node (dark purple when set); FHIRPath evaluated once on import and on every ↺ Re-init click; result written to `values[]`; imported from / exported to `sdc-questionnaire-initialExpression` extension; builder panel shows hint about Re-init workflow
- **Re-init button** — ↺ button in the Variables card header (before Edit); calls `reinitForm()` — re-evaluates all `_initialExpr` nodes against current questionnaire variables; use after switching patient presets to propagate patient values into `initialExpression` fields
- **Patient presets dropdown** — `Patient ▾` button in toolbar replaces the old Patient Context button; opens a fixed-position dropdown (uses `getBoundingClientRect()` to escape `overflow-x: auto` clipping) with 5 preset profiles (Adult Male 35·BMI 24, Adult Female 28·BMI 22, Obese Male 45·BMI 38·smoker, Child 10·BMI 16, Pregnant Female 30·BMI 26) + Custom…; selecting a preset auto-applies patient vars and calls `reinitForm()`; Custom… opens the manual edit modal
- **Empty-state placeholder** — right panel shows hint text when tree is empty; Validate, Export buttons are hidden until a questionnaire is loaded
- **Resizable panels** — drag the divider between left/right panels; width persisted in `localStorage`
- **Autosave** — background `setInterval` (15 s) saves current questionnaire as FHIR JSON to `localStorage` (`autosave-draft` + `autosave-meta`); only saves when tree is non-empty; on next visit Load menu shows **"Recent: &lt;title&gt; (date/time)"** item at top if a draft exists; loading via Recent calls `_importAndValidate` (full render + file name set); draft cleared on Reset/Clear; implemented in `js/ui/autosave.js`
- **Variables modal Apply/Cancel** — the Edit modal uses a draft pattern: on open a deep copy of `questVariables` is made; all edits go to the draft; **Cancel** discards the draft (variables unchanged); **Apply** strips blank rows, validates (blocks if any variable has expression but no name — highlights the field red with "Name is required"), then commits the draft to `questVariables` and calls `reinitForm()`; Escape or backdrop click acts as Cancel
- **Variable chip tooltips** — `%varName` chips in the Variables card carry rich tooltips showing the FHIRPath expression body and FHIR extension path `Questionnaire.extension[sdc-questionnaire-variable]` + SDC spec footer
- **Text control — textarea** — `text`-type items in the preview use `<textarea>` instead of `<input>`: starts at 1 row, grows with content (auto-resize via `scrollHeight`), max 200px, manual `resize: vertical` handle; takes full available row width via `flex: 1` on `ctrl-wrap--text`; `_reCalc`/`onChange` debounced 200ms to avoid lag on fast typing; `values` updated immediately on every keystroke
- **Visibility condition tooltip** — the `👁️` condition hint badge in preview now carries a rich tooltip explaining the auto-generated text and pointing to the Show When panel
- **Async preview rendering** — `reinitForm()` is async: shows progress bar (`progress.show(label)`) and yields two rAF frames between each stage (buildQR → buildVarEnv → evalInitialExprNodes → DOM rebuild); `effect()` delegates all work to `_asyncRender(version)` which yields between FHIRPath evaluation (Phase 1) and DOM mutation (Phase 2); stale renders abort before any DOM write; `DocumentFragment` batches top-level DOM insertions into a single reflow; `_preQR`/`_preEnvVars` cache avoids double `buildQR`/`buildVarEnv` when patient profile switches

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

## Development Rules

### Workflow — Before Every Push
1. Update `CONTEXT.md` (file table, UX features, known limitations)
2. Update `README.md` (same sections)
3. `git add -A` → `git commit` → `git push`

Never commit+push without updating both docs first.

### Architecture — No Hardcoded DOM IDs in Submodules
Submodules must **not** call `document.getElementById()` or `querySelector()` internally.
DOM nodes are resolved **once** in `app.js` (the top-level entry point) and **passed in** via `init(elements)`.

```js
// ✅ correct — app.js resolves, module receives
validateModal.init({ backdrop, closeBtn, body, footer });

// ❌ wrong — submodule reaches into the DOM itself
document.getElementById('validateModal')  // inside a submodule
```

The same applies to all builder submodules: dependencies injected via `init(deps)`, never pulled from globals or the DOM directly.

---

## CSS Architecture

Styles are split into modules — `css/styles.css` contains only design tokens + base reset + global utilities. All component styles live in dedicated files:

| File | Lines | Content |
|---|---|---|
| `css/styles.css` | ~85 | CSS custom properties (`:root`), base reset, progress bar, `.resize-overlay` |
| `css/layout.css` | ~236 | Top panel, 2-column layout, section titles, loaded file name, clear button |
| `css/builder.css` | ~520 | Toolbar, node cards, drag/drop zones, action chips, collapsible panels, vis-builder, vis-q-sel custom picker, constraint-card, flash animation |
| `css/preview.css` | ~280 | Preview card, lform-item, status icons, AND/OR badges, final result, calc-badge, constraint/meta/default badges, flash |
| `css/controls.css` | ~106 | `.ctrl-wrap`, `.ctrl-err`, `.ref-*`, `.qty-*`, open-choice, file input, radio, shared-success |
| `css/tooltip.css` | ~60 | Dark card tooltip (`#1a2535`), CSS arrow, `.rich-tooltip__title`, `.rich-tooltip__body`, `.rich-tooltip__fhir` FHIR spec footer row |
| `css/modals.css` | ~105 | Clear-confirm modal, validate modal, preview placeholder |

**Inline styles remaining** (genuinely dynamic — not convertible):
- `js/builder/node-group.js` / `node-item.js` — `titleTextarea.style.height` (auto-resize)
- `js/app.js` — `leftPanel.style.width` (resizer); `label.style.cssText = _renderStyle` (user CSS)

---

## Known Limitations / TODO

- Multi-condition visibility with complex FHIRPath (cross-group references, extensions) not supported in the visual enableWhen builder — must be typed as `enableWhenExpression` directly

