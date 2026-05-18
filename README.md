# QuestionaryPrototype — FHIR Questionnaire Logic Builder

A prototype **visual logic builder** for medical prior authorization questionnaires based on [FHIR R4 Questionnaire](https://hl7.org/fhir/R4/questionnaire.html).

Lets you build questionnaire logic visually, test it against patient data, and import/export valid FHIR R4 JSON.

> © 2026 [Sergey Mosyakov](https://github.com/sergeymosyakov). Free to use with attribution.

---

## Files

| File | Purpose |
|---|---|
| `index.html` | Entry point — markup and script imports |
| `favicon.svg` | Browser tab icon |
| `start.ps1` | Local dev server shortcut: `npx serve .` |
| `css/styles.css` | All styles and CSS design tokens |
| `js/app.js` | Entry point — wires inputs, buttons, loads example |
| `js/state.js` | Reactive state, data factories, business logic |
| `js/utils.js` | Pure utility functions (`escAttr`, `findAndRemove`, `isDescendant`, `findAncestorGroupIds`, `parseOption`, `parseOptions`) |
| `js/eval.js` | Tree evaluation (visibility / condition rules) |
| `js/render-builder.js` | Left panel — 3-line re-export shim → `js/builder/` |
| `js/builder/ctx.js` | `BuilderCtx` JSDoc typedef (no runtime exports) |
| `js/builder/index.js` | Builder orchestrator — public API (`renderTree`, `collapseAll`, etc.) |
| `js/builder/_shared.js` | Shared utilities injected via `init(deps)` |
| `js/builder/dnd.js` | Self-contained drag & drop, injected via `init(onDrop, tree, formTick)` |
| `js/builder/panels.js` | All action panel builders (enableWhen vis panel, mand, type, expr, style) |
| `js/builder/node-item.js` | `renderItem(node, ctx)` — item node DOM |
| `js/builder/node-group.js` | `renderGroup(node, ctx)` — group node DOM |
| `js/render-preview.js` | Right panel — async preview; `reinitForm()` shows progress bar, yields between stages; `_asyncRender(version)` separates FHIRPath eval from DOM rebuild; DocumentFragment; stale-render abort |
| `js/controls/index.js` | Control registry — dispatches by `itemType` |
| `js/controls/{type}.js` | Per-type control implementations. `select` and `open-choice` use custom portal dropdowns instead of native `<select>` / `<datalist>` |
| `js/fhir/import.js` | FHIR R4 → internal model |
| `js/fhir/export.js` | Internal model → FHIR R4 |
| `js/fhir/calc.js` | `evalCalcNodes`, `evalInitialExprNodes` — FHIRPath calculatedExpression and initialExpression evaluation |
| `js/fhir/qr-builder.js` | QuestionnaireResponse builder for FHIRPath context |
| `js/fhir/validate.js` | `validateTree` → `{severity, nodeId, message}[]` |
| `js/ui/validate-modal.js` | Validate modal — `init(elements)`, `show(title, issues, mode, callbacks)` |
| `js/ui/variables-panel.js` | SDC Variables card + edit modal — `init(elements, questVariables, onReinit)`, `refresh()`; draft-based editing with Apply/Cancel buttons; `%name` chip rich tooltips |
| `js/ui/showwhen-modal.js` | Show When centered modal — draft pattern (Apply/Cancel); action button indicator only changes on Apply; searchable question picker portal dropdown |
| `js/ui/constraint-modal.js` | Constraint edit modal — draft pattern; Apply commits + calls `triggerCalcRecalc()` so preview re-renders; expression field is a resizable `.expr-textarea` |
| `js/ui/expression-modal.js` | Config-driven modal for `_calculatedExpr` and `_initialExpr` FHIRPath fields — `open(cfg)`; draft pattern; auto-resize textarea; live expr icon |
| `js/ui/patient-ctx.js` | Patient presets dropdown — 5 built-in profiles (Adult Male, Adult Female, Obese Male, Child, Pregnant Female) + Custom…; `Patient ▾` button in toolbar; selecting a preset auto-applies patient vars and calls `reinitForm()`; seeds `%age`, `%gender`, `%bmi`, `%pregnant`, `%smoker`, `%proc`, `%comorb` as FHIRPath literal expressions in `questVariables` |
| `js/ui/progress.js` | Global progress bar — `init(elements)`, `show/update/hide` |
| `js/ui/search.js` | Preview search — `init(elements)`, `refresh()`; highlight + keyboard navigation |
| `js/ui/tooltip.js` | Rich tooltip system — delegated `mouseover` on `[data-tip-title]`/`[data-tip-body]`; dark card with optional FHIR spec footer |
| `js/ui/autosave.js` | Background autosave every 15 s to `localStorage`; `onSaved(date)` callback; Recent draft item in Load menu |
| `js/ui/status-badge.js` | PASS/FAIL pill badge with dark issue-list dropdown; collapse-safe ↗ navigation |
| `sampledata/example-bariatric.fhir.json` | Built-in example loaded on startup (bariatric surgery pre-auth, compact) |
| `sampledata/bariatric-extended.fhir.json` | Synthetic bariatric pre-auth — 87 items, 32 enableWhen, all item types |
| `sampledata/ussg-fht.fhir.json` | US Surgeon General Family Health History — 49 items, depth 5 |
| `sampledata/prowl-ss.fhir.json` | PROWL-SS Post-Operative pain assessment — 44 items |
| `sampledata/phq-9.fhir.json` | PHQ-9 Patient Health Questionnaire (depression screening) — 11 items |
| `sampledata/1776102565767-...json` | Real-world questionnaire snapshot for regression testing |
| `sampledata/patient-scenario-eligibility.fhir.json` | Scenario: Bariatric Surgery Eligibility — `initialExpression` fills patient fields, `enableWhenExpression` gates pathways |
| `sampledata/patient-scenario-risk.fhir.json` | Scenario: Pre-op Risk Assessment — readOnly `initialExpression` fields, risk groups by `enableWhenExpression` |
| `sampledata/patient-scenario-calc-chain.fhir.json` | Scenario: Risk Score Calc Chain — `initialExpression` → `calculatedExpression` → `enableWhenExpression` pipeline |
| `sampledata/sdc-variables-demo.fhir.json` | SDC Variables demo — BMI calculator with `%weightKg`, `%heightM`, `%bmiCalc` variables |
| `tests/fixtures/` | Frozen FHIR samples used by e2e tests — never modified by hand; keeps tests stable when sampledata evolves |
| `ROADMAP.md` | Prioritized feature roadmap (Now / Next / Later) |
| `docs/FHIR-MAPPING.md` | Full FHIR ↔ internal model mapping + not-supported list |
| `docs/CONTEXT.md` | Internal architecture notes (product direction, scenarios, data flow) |

---

## Sample Questionnaires

All samples live in `sampledata/` and can be loaded via the **Load** button.

| File | Items | enableWhen | What to look for |
|---|---|---|---|
| `example-bariatric.fhir.json` | ~25 | ~8 | Built-in default — loads on startup. Covers most item types. BMI calculated field, radio buttons, attachments, open-choice. Constraint demos: `diet-min-months` (error, int ≥ 3), `phq9-severity` (warning), `bmi-eligibility` (error on readOnly calc). |
| `bariatric-extended.fhir.json` | 87 | 32 | **Stress-test.** Synthetic bariatric pre-authorization. All item types: text, number, date, url, attachment, checkbox, select, radio, display. Sub-questions for diabetes (HbA1c, medications, type), hypertension, sleep apnea (CPAP, severity), prior surgery (date, complications), psych eval (eating disorder, substance history), cardiac clearance, GERD warning display. BMI `calculatedExpression`. |
| `ussg-fht.fhir.json` | 49 | 0 | Deep nesting (depth 5). US Surgeon General Family Health History Tool. Good for testing tree collapse/expand and navigation. No enableWhen — purely structural. |
| `prowl-ss.fhir.json` | 44 | 0 | Flat structure (depth 1). PROWL-SS post-operative pain assessment. Likert-scale radio groups and display items. |
| `phq-9.fhir.json` | 11 | 0 | Minimal — PHQ-9 depression screening. Fast to load; good baseline smoke-test. |
| `reference-example.fhir.json` | 4 | 0 | Demonstrates the `reference` item type — Patient, Practitioner, Encounter references with `questionnaire-referenceResource` extension. |
| `1776102565767-...json` | — | — | Real-world production snapshot. Use for regression testing after refactors. |
| `patient-scenario-eligibility.fhir.json` | — | — | Load + select "Adult Male" preset + Re-init. Verifies `initialExpression` fills patient fields; `enableWhenExpression` shows/hides Adult, Pediatric, Pregnancy, Smoker sections. |
| `patient-scenario-risk.fhir.json` | — | — | Pre-op risk assessment. ReadOnly fields filled via `initialExpression`; risk sections gated by `enableWhenExpression`. |
| `patient-scenario-calc-chain.fhir.json` | — | — | **Expression chain demo.** Preset → Re-init → `initialExpression` fills Step 1 → `calculatedExpression` computes risk pts → `enableWhenExpression` shows LOW/MODERATE/HIGH. Obese Male → HIGH; Pregnant F → MODERATE; others → LOW. |

---

## Tech Stack

- **`@vue/reactivity`** (ESM CDN) — only `ref`, `reactive`, `effect`. No Vue components.
- **ES Modules** — `import/export` between files; requires HTTP server
- **Vanilla JS DOM** — left panel (builder) constructed imperatively
- **`effect()`** — rebuilds the right panel (preview) on reactive state changes
- **Dependency injection** — `dnd.js` and `_shared.js` receive all state via `init()`, no global imports
- **`ctx` object** — `renderNode` passes `{ renderTree, renderNode, tree, formTick, collapsed }` down to node renderers and panels; no module-level singletons
- **CSS modules** — styles split by concern: `css/styles.css` (tokens + reset), `css/layout.css`, `css/builder.css`, `css/preview.css`, `css/controls.css`, `css/modals.css`, `css/tooltip.css`
- **Vitest** — unit test suite for pure-function modules (`utils`, `eval`, `fhir/calc`, `fhir/validate`, `fhir/export`, `fhir/import`, `fhir/qr-builder`, `state`, integration); **246 tests** across 9 files; CDN imports mocked via `vi.mock`; CI via GitHub Actions (`npm test`)
- **Playwright** — e2e test suite (`tests/e2e/`); **130 tests** across 12 spec files (Chromium); all selectors use `data-testid` / `data-node-id` / `data-preview-id`; fixtures frozen in `tests/fixtures/`; run with `npm run test:e2e`

---

## Architecture

### Reactive State

```js
// Patient R4 context (js/patient.js)
age, gender, bmi, pregnant, smoker, proc, comorb  // ref() — patient fields

// App state (js/state.js)
tree          // reactive([]) — questionnaire node tree
values        // plain object — form answers; access via getValue/setValue/deleteValue/clearAllValues
              // Repeat rows: values[id+'$$1'], values[id+'$$2']…; count: values[id+'$$n']
_formTick     // ref(0) — incremented on discrete answer change to re-trigger effect()
questVariables // reactive([]) — SDC sdc-questionnaire-variable entries; patient ctx seeded here
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
  itemType:'text'|'integer'|'decimal'|'checkbox'|'select'|'radio'|'open-choice'|'date'|'url'|'attachment'|'reference'|'quantity'|'display',
  repeats: bool,   // allows multiple answers in preview (not for checkbox/display)
  enableWhen: [], enableBehavior: 'all'|'any', enableWhenExpression: '',
  constraint: [], options }

// FHIR-imported nodes also carry:
_enableWhenText  // human-readable enableWhen label (e.g. "«Q» = Yes AND «Q2» = No")
_renderStyle     // raw CSS string from FHIR _text.extension[rendering-style]
_calculatedExpr  // FHIRPath string (SDC calculatedExpression)
_initialExpr     // FHIRPath string (SDC initialExpression) — evaluated once on import + Re-init
_readOnly        // boolean — FHIR item.readOnly
_initialValue    // any — FHIR item.initial[0] value; pre-fills values[] on import
_prefix          // string — FHIR item.prefix (amber badge; editable in builder)
_codes           // object[] — FHIR item.code[] (round-trip safe; not displayed)
```

---

## Evaluation Logic

### enableWhen
- `node.enableWhen[]` checked against `values[ew.question]` using `checkOneEnableWhen(ew)`
- `node.enableBehavior === 'all'` (default) → all conditions must pass (AND)
- `node.enableBehavior === 'any'` → any one condition passes (OR)
- `enableWhenExpression` FHIRPath expression used as override/fallback if set
- Node hidden if conditions not met; rendered dimmed with 🔒 if `enableWhen` defined

### constraint[]
- Each `node.constraint[]` entry: `{ key, severity, human, expression }`
- Evaluated via FHIRPath; empty result or `false` → constraint fails
- `severity: 'error'` fail blocks PASS; `severity: 'warning'` shows badge only

### Final Result
- **PASS** — all visible, mandatory items satisfied and no `error`-severity constraint fails
- **FAIL** — at least one mandatory item not satisfied, or one `error`-severity constraint fails

---

## FHIR Item Type Support

| FHIR R4 type | Internal `itemType` | Control in preview | Validation | Notes |
|---|---|---|---|---|
| `boolean` | `checkbox` | ✅ checkbox | — | |
| `integer`, `decimal` | `number` | ✅ number input | — | |
| `string`, `text` | `text` | ✅ text input | — | |
| `date`, `dateTime`, `time` | `date` | ✅ date-picker | — | All three map to `date` |
| `url` | `url` | ✅ url input | ✅ `new URL()` format check | Invalid URL → ✘ even if not required |
| `choice` | `select` or `radio` | ✅ dropdown / radio-buttons | — | Determined by `questionnaire-itemControl` extension |
| `open-choice` | `open-choice` | ✅ text + datalist | — | Dropdown suggestions + free-text via `<datalist>` |
| `display` | `display` | ✅ label only | — | No control, no pass/fail |
| `group` | `group` | ✅ section header | — | |
| `group` (no children) | `group` | ✅ info text `[Info]` | — | |
| `attachment` | `attachment` | ✅ file input | ✅ required = file chosen | |
| `reference` | `reference` | ✅ dropdown (resource type) + `/` + id input | ✅ required = type+id filled | `questionnaire-referenceResource` locks dropdown to that type; otherwise all 96 FHIR R4 types |
| `quantity` | `quantity` | ✅ number + unit dropdown (UCUM) | ✅ required = value+unit filled | Builder: Default unit; import/export `questionnaire-unit` extension |

### Import mapping

| FHIR | Internal model |
|---|---|
| `type:'group'` with children | `type:'group'` |
| `type:'group'` with no children | Rendered as informational display text (`[Info]` in builder) |
| `type:'boolean'` | `itemType:'checkbox'` |
| `type:'integer'` / `type:'decimal'` | `itemType:'number'` |
| `type:'choice'` | `itemType:'select'` or `itemType:'radio'` (if `questionnaire-itemControl: radio-button`) |
| `type:'string'` / `type:'text'` / etc. | `itemType:'text'` |
| `item.required` | `mandatory` |
| `item.linkId` | `id` (editable in builder) |
| `item.enableWhen` | `node.enableWhen[]` — stored directly; `node._enableWhenText` set for display (e.g. `«Q» = Yes AND «Q2» = No`) |
| `item.enableBehavior` | `node.enableBehavior` — `'all'` (default) or `'any'` |
| SDC `enableWhenExpression` | `node.enableWhenExpression` — FHIRPath string |
| `item.answerOption` | `options` — stored as `code=display` per option (e.g. `bmi35=BMI 35–39.9 with comorbidity`); plain value if code==display |
| `_text.extension[rendering-style]` | `_renderStyle` (applied as inline CSS in preview) |
| `item.prefix` | `_prefix` — amber badge in preview; editable in builder; exported back (round-trip safe) |
| `item.code[]` | `_codes` — preserved as-is; exported back unchanged (round-trip safe) |

Standard extensions preserved on export:
- `http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl` — `radio-button` code for `radio` itemType
- `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-enableWhenExpression` — `enableWhenExpression` field
- `http://hl7.org/fhir/StructureDefinition/questionnaire-constraint` — `constraint[]` entries

### Export

- `node.enableWhen[]` → standard FHIR `item.enableWhen[]` (shallow-copied directly)
- `node.enableBehavior === 'any'` → `item.enableBehavior: 'any'`
- `node.enableWhenExpression` → SDC `sdc-questionnaire-enableWhenExpression` extension
- `node.constraint[]` → `questionnaire-constraint` extensions

See [docs/FHIR-MAPPING.md](docs/FHIR-MAPPING.md) for the full FHIR field mapping, including partial support and known gaps.

---

## UX Features

- **Bidirectional navigation** — click preview row → scroll+flash builder node (teal); click builder node header → scroll+flash preview row (blue); `↗` button on every builder node header provides explicit one-click navigation to the preview row
- **Drag & drop reorder** — ⠿ handle on every node; drag to reorder within the tree, drop between nodes, drop into a group, or drop at root level; drop zones appear only during drag (height 0 → 28px, labeled contextually: "Drop here to add as first child", "Drop here", "Drop here to add as last child", "Drop here to move to end") — no layout shift
- **Resizable panels** — drag the divider between Logic Builder and Preview to resize; width persisted in `localStorage`
- **Clear questionnaire** — `×` button next to the loaded file name; if tree is non-empty shows a modal asking to export first (Export first / Clear anyway / Cancel)
- **Loaded file name** — shown in right-panel header after import; appears as `New Questionnaire` when building from scratch; `×` always visible when tree is non-empty
- **Export filename prompt** — `window.prompt` before every export; pre-filled with current file name; adds `.json` if not present
- **Collapse sections (preview)** — `▼/▶` toggle on each group row; SVG corner-arrow icon buttons in toolbar right-aligned (visible when tree has content)
- **Disabled groups clickable** — N/A groups in preview still navigate to builder on click
- **Editable linkId** — blue monospace input in the builder node header; directly edits `node.id`
- **Expandable title** — node title shown as read-only span; click → expands to full-width textarea, collapses on blur
- **Style editor** — `Style` panel on every node: Bold / Italic checkboxes, color picker, raw CSS field. Changes apply live in the preview
- **Auto-scroll on add** — `+ Group`, `+ Item`, `Add Root Group` scroll to and flash the new node; parent group auto-expands
- **enableWhen panel** — "Show When" action panel on every node; FHIR `enableWhen[]` list UI: AND/ALL vs OR/ANY toggle, per-condition rows (question picker + operator + type-aware value input + remove button), "+ Add condition" button; FHIRPath `enableWhenExpression` field for advanced SDC expressions
- **Patient presets dropdown** — `Patient ▾` button in toolbar opens a fixed-position dropdown with 5 preset profiles (Adult Male 35·BMI 24, Adult Female 28·BMI 22, Obese Male 45·BMI 38·smoker, Child 10·BMI 16, Pregnant Female 30·BMI 26) + Custom…; selecting a preset auto-applies patient vars and calls `reinitForm()`; Custom… opens the manual edit modal; seeds `%age`, `%gender`, `%bmi`, `%pregnant`, `%smoker`, `%proc`, `%comorb` in `questVariables`
- **AND/OR badges** — on group headers: `ALL items ✓` / `ANY item ✓`
- **Logic separators** — `— AND —` / `— OR —` between sibling items inside a group
- **Dimmed rows** — conditional items shown grayed out (🔒) when their condition is not met; dimmed groups also show their children as disabled (N/A) rows; animate to active when met
- **Informational rows** — `type:'group'` nodes with no children rendered as plain italic text; labeled `[Info]` in builder
- **required text/number/decimal/reference** — `required:true` on text, number, decimal, integer, quantity, reference items requires a non-empty value; shows ✔/✘ and affects PASS/FAIL
- **required checkbox** — `required:true` on boolean items requires the box to be checked; shows ✔/✘ and affects PASS/FAIL
- **required radio/select** — `required:true` on choice/radio items requires an option to be selected; shows ✔/✘ on item and group icon; affects PASS/FAIL
- **Required star** — mandatory items show a red `*` in the label in preview
- **Optional badge** — non-mandatory items show a small `optional` badge in the preview
- **Search in preview** — 🔍 search box in the preview toolbar (after Export button); type to highlight matching rows (yellow), `↑`/`↓` buttons or keyboard arrows or **Enter** to navigate between matches; shows `2 / 5` counter; red border + "No results" when nothing found; Escape clears; hidden when tree is empty
- **File attachments** — `attachment` item type renders as styled **Choose file** button; `required:true` requires a file to be chosen
- **Export validation** — on Export: `validateTree()` runs; modal lists errors/warnings with ↗ navigate-to-node per issue; "Fix first" / "Export anyway"
- **Validate button** — standalone **Validate** in Questionnaire Preview header; same check as export; green ✅ panel when no issues found; hidden when no questionnaire loaded
- **Esc closes modals** — Validate and Variables modals close on Escape
- **Ctrl+F** — focuses the preview search input instead of browser find (when search is visible)
- **Import validation** — same modal shown after loading a file/sample (OK-only mode)
- **Empty-state placeholder** — right panel shows hint text when no questionnaire is loaded; Validate, Export buttons are hidden until a questionnaire is loaded
- **Date picker / URL input** — `date` renders as native date-picker; `url` validates format with `new URL()`
- **Load ▾ dropdown** — single button opens a menu with all built-in samples + "From file…" option; no startup auto-load (empty-state placeholder shown instead)
- **item.prefix** — FHIR R4 `Questionnaire.item.prefix` imported into `node._prefix` and exported back (round-trip safe); amber pill badge in preview; editable in builder meta-row; **Renumber** assigns sequential prefixes (e.g. `1`, `1.1`) — writes `_prefix` only, never changes `node.id`
- **linkId / prefix toggles** — `id` (blue) and `prefix` (amber) buttons in preview toolbar toggle the corresponding pill badges; state stored in `showLinkId` / `showPrefix` refs; clicking a linkId badge copies the linkId to clipboard; rich tooltip shows visibility-rule usage + expected value type + item type
- **Rich tooltips** — all builder action buttons, toolbar buttons (Load, Export, Add Root Group, Renumber, format select, id/prefix/collapse/expand), and the Variables card title show contextual help cards with FHIR field path and spec reference (R4 / SDC); `js/ui/tooltip.js` uses delegated `mouseover`; dark card positions below or above target
- **Tooltip toggle** — `tips` button in the preview toolbar toggles all rich tooltips on/off; green when on (default), orange when off; state persisted in `localStorage`; **tooltips off** label appears next to Logic Builder heading when disabled
- **Radio answer options** — Answer Type panel shows the Options (comma-separated) editor when `radio` is selected (same as `select` / `open-choice`)
- **SDC Variables** — `sdc-questionnaire-variable` extensions on root Questionnaire imported into `questVariables[]`; collapsible card above tree shows `%name` chips with rich tooltips (expression + FHIR spec footer); Edit modal uses draft pattern — Apply commits, Cancel discards; passed as `%varName` env vars to FHIRPath `calculatedExpression` on every preview render; round-trip safe
- **Auto calculatedExpression** — calc fields re-evaluated automatically on every patient input, answer, or tree change; no Test button; for **checkbox** calc fields the badge shows `✓ true` / `✗ false` with green/red colouring; for **all other types** the computed value is shown as a soft blue pill (distinct from status badges, no green)
- **Expression Explain** — click a checkbox calc-badge or `👁️`/`🔒` condition-hint badge (when `enableWhenExpression` is set) to open a centered modal that breaks the FHIRPath expression into an AND/OR/NOT/LEAF tree and shows ✓/✗ next to each node; single Close button
- **Live eval icons in builder** — `✓`/`✗` icon next to expression field labels (`calculatedExpression`, `initialExpression`, `enableWhenExpression`); updates on panel open and after each form change; no typing lag — full recalc fires on blur
- **Initial expression (SDC `sdc-questionnaire-initialExpression`)** — **Init Expr** action button on every item node (dark purple when set); FHIRPath evaluated once on import and on every ↺ Re-init; result written to `values[]`; imported/exported as `sdc-questionnaire-initialExpression` extension
- **Re-init button** — ↺ button in the Variables card header; calls `reinitForm()` to re-evaluate all `_initialExpr` nodes; use after switching patient presets
- **Default value (item.initial[])** — `item.initial[0]` imported → `node._initialValue`; pre-fills preview on load; editable via **Default** action panel (type-aware: select/date/number/text); `× clear` link syncs preview; round-trip safe export
- **Constraint modal** — **Constraint** action button on every node (dark purple when `constraint[]` non-empty) opens a centered modal with draft pattern; editable cards per constraint (key, severity error/warning, human message, FHIRPath expression, remove) + **+ Add constraint**; Apply commits, Cancel discards; exported as `questionnaire-constraint` extensions
- **QR Export** — **⬇ Response** button in toolbar (visible when questionnaire loaded); prompts for filename; downloads current answers as FHIR R4 `QuestionnaireResponse` JSON with `authored` timestamp
- **QR Import (Load Answers)** — **Load Answers…** at bottom of Load dropdown (visible when questionnaire loaded); reads a `QuestionnaireResponse` file; loads matched answers into `values[]`; shows warning for URL mismatch or unknown linkIds
- **Constraint badge in preview** — per-node badge: amber ⚠️ (warning or passing error), red ✘ (failing error); tooltip shows key/severity/message/expression; `error`+fail blocks Final Result
- **Read-only badge** — grey 🔒 `read-only` pill when `_readOnly === true` and no `_calculatedExpr`
- **Default badge** — purple ↺ `default` pill when `_initialValue` is defined
- **Real-time calc badge** — `refreshCalcBadges()` patches calc-badge in-place via `data-calc-id` after each answer change — no full DOM rebuild
- **Calc-badge tooltip** — FHIRPath expression + SDC spec footer
- **Custom question picker** — Show When panel uses `.vis-q-sel` styled dropdown (div-based) for question picker; shows full title with ellipsis; max-height 200px with scroll
- **Text control — textarea** — `text`-type items use `<textarea>`: starts at 1 row, grows with content up to 200px, manual resize handle, full row width; `_reCalc`/`onChange` debounced 200ms
- **Hierarchical node IDs** — new groups/items get IDs like `1`, `1.1`, `1.1.1` using the active renumber format (numeric / roman / letters)

---

## Running

> **Requires an HTTP server** — ES modules do not work over `file://`.

### Locally
```powershell
.\start.ps1
# or: npx serve .
# open http://localhost:3000
```

### GitHub Pages
https://sergeymosyakov.github.io/fhir-questionnaire-builder/

### Tests
```powershell
npm test             # unit tests — single run (Vitest, 221 tests)
npm run test:watch   # unit tests — watch mode
npm run test:e2e     # e2e tests — Playwright/Chromium (24 tests, requires Chromium installed)
npm run test:e2e:ui  # e2e tests — Playwright UI mode
```
Vitest and Playwright CI run automatically on every push via GitHub Actions (see `.github/workflows/test.yml`).
After each push the `deploy` job publishes the app **and** the latest Playwright HTML report to GitHub Pages:
- **App** — https://sergeymosyakov.github.io/fhir-questionnaire-builder/
- **Test report** — https://sergeymosyakov.github.io/fhir-questionnaire-builder/playwright-report/

> **Requires one-time setup**: in the repo go to **Settings → Pages → Source** and select **GitHub Actions**.

---

## Known Limitations / TODO

- Multi-condition visibility with complex FHIRPath (cross-group references, extensions) not supported in the visual enableWhen builder — must be typed as `enableWhenExpression` directly
