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
| `js/builder/panels.js` | All action panel builders (vis, mand, cond, type, expr, style) |
| `js/builder/node-item.js` | `renderItem(node, ctx)` — item node DOM |
| `js/builder/node-group.js` | `renderGroup(node, ctx)` — group node DOM |
| `js/render-preview.js` | Right panel — reactive preview + controls |
| `js/controls/index.js` | Control registry — dispatches by `itemType` |
| `js/controls/{type}.js` | Per-type control implementations |
| `js/fhir/import.js` | FHIR R4 → internal model |
| `js/fhir/export.js` | Internal model → FHIR R4 |
| `js/fhir/calc.js` | `evalCalcNodes` — FHIRPath calculatedExpression evaluation |
| `js/fhir/qr-builder.js` | QuestionnaireResponse builder for FHIRPath context |
| `js/fhir/validate.js` | `validateTree` → `{severity, nodeId, message}[]` |
| `js/ui/validate-modal.js` | Validate modal — `init(elements)`, `show(title, issues, mode, callbacks)` |
| `js/ui/variables-panel.js` | SDC Variables card + edit modal — `init(elements, questVariables)`, `refresh()` |
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
| `sampledata/sdc-variables-demo.fhir.json` | SDC Variables demo — BMI calculator with `%weightKg`, `%heightM`, `%bmiCalc` variables |
| `ROADMAP.md` | Prioritized feature roadmap (Now / Next / Later) |
| `docs/FHIR-MAPPING.md` | Full FHIR ↔ internal model mapping + not-supported list |
| `docs/CONTEXT.md` | Internal architecture notes (product direction, scenarios, data flow) |

---

## Sample Questionnaires

All samples live in `sampledata/` and can be loaded via the **Load** button.

| File | Items | enableWhen | What to look for |
|---|---|---|---|
| `example-bariatric.fhir.json` | ~25 | ~8 | Built-in default — loads on startup. Covers most item types. BMI calculated field, radio buttons, attachments, open-choice. |
| `bariatric-extended.fhir.json` | 87 | 32 | **Stress-test.** Synthetic bariatric pre-authorization. All item types: text, number, date, url, attachment, checkbox, select, radio, display. Sub-questions for diabetes (HbA1c, medications, type), hypertension, sleep apnea (CPAP, severity), prior surgery (date, complications), psych eval (eating disorder, substance history), cardiac clearance, GERD warning display. BMI `calculatedExpression`. |
| `ussg-fht.fhir.json` | 49 | 0 | Deep nesting (depth 5). US Surgeon General Family Health History Tool. Good for testing tree collapse/expand and navigation. No enableWhen — purely structural. |
| `prowl-ss.fhir.json` | 44 | 0 | Flat structure (depth 1). PROWL-SS post-operative pain assessment. Likert-scale radio groups and display items. |
| `phq-9.fhir.json` | 11 | 0 | Minimal — PHQ-9 depression screening. Fast to load; good baseline smoke-test. |
| `reference-example.fhir.json` | 4 | 0 | Demonstrates the `reference` item type — Patient, Practitioner, Encounter references with `questionnaire-referenceResource` extension. |
| `1776102565767-...json` | — | — | Real-world production snapshot. Use for regression testing after refactors. |

---

## Tech Stack

- **`@vue/reactivity`** (ESM CDN) — only `ref`, `reactive`, `effect`. No Vue components.
- **ES Modules** — `import/export` between files; requires HTTP server
- **Vanilla JS DOM** — left panel (builder) constructed imperatively
- **`effect()`** — rebuilds the right panel (preview) on reactive state changes
- **`new Function()`** — sandboxed rule evaluation (`evalRule`)
- **Dependency injection** — `dnd.js` and `_shared.js` receive all state via `init()`, no global imports
- **`ctx` object** — `renderNode` passes `{ renderTree, renderNode, tree, formTick, collapsed }` down to node renderers and panels; no module-level singletons
- **CSS modules** — styles split by concern: `css/styles.css` (tokens + reset), `css/layout.css`, `css/builder.css`, `css/preview.css`, `css/controls.css`, `css/modals.css`, `css/tooltip.css`
- **Vitest** — unit test suite for pure-function modules (`utils`, `eval`, `fhir/calc`, `fhir/validate`, `fhir/export`, `fhir/import`, `fhir/qr-builder`); 160 tests; CDN imports mocked via `vi.mock`; CI via GitHub Actions

---

## Architecture

### Reactive State

```js
// Patient R4 context (js/patient.js)
age, gender, bmi, pregnant, smoker, proc, comorb  // ref() — patient fields

// App state (js/state.js)
tree          // reactive([]) — questionnaire node tree
values        // plain object — form answers (not reactive; avoids re-render on every keystroke)
_formTick     // ref(0) — incremented on checkbox/select change to re-trigger effect()
calcTested    // REMOVED — calculatedExpression evaluated automatically on every effect() run
autoFilledIds // Set — IDs of items auto-filled from conditionRule
```

### Node Data Model

```js
// Group
{ id, type:'group', title, visibilityRule, conditionRule, mandatory,
  logicWithParent:'AND'|'OR', children:[] }

// Item
{ id, type:'item', title, visibilityRule, conditionRule, mandatory,
  itemType:'text'|'number'|'checkbox'|'select'|'radio'|'open-choice'|'date'|'url'|'attachment'|'reference'|'quantity'|'display',
  options, successValue }

// FHIR-imported nodes also carry:
_enableWhenText  // human-readable visibility condition label
_renderStyle     // raw CSS string from FHIR _text.extension[rendering-style]
```

### evalRule

```js
new Function('age','gender','bmi','pregnant','smoker','proc','comorb','values',
  'return (' + rule + ');')
```

- `values['linkId']` — enables enableWhen-style rules on form answers
- Empty rule → `true` (always visible)

---

## Evaluation Logic

### visibilityRule
- `false` → node is not rendered
- `false` + `_enableWhenText` → rendered dimmed with 🔒 and condition label

### conditionRule on a group
- `false` → group and all descendants are marked **N/A** (grayed, `—`)
- Excluded from the final result (not FAIL — simply not applicable)
- Example: `gender === 'female'` on a "Female-Specific Requirements" group

### conditionRule on an item
- Used for **auto-filling checkboxes** from patient data (🤖 badge)
- The clinician can override the auto-filled value

### Final Result
- **PASS** — all visible, non-N/A mandatory items are satisfied
- **FAIL** — at least one mandatory item is not satisfied
- N/A groups do **not** affect the result

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
| `item.enableWhen` | `visibilityRule` (JS expression) + `_enableWhenText` (human label) |
| `item.enableBehavior:'any'` | `logicWithParent:'OR'` |
| `item.answerOption` | `options` — stored as `code=display` per option (e.g. `bmi35=BMI 35–39.9 with comorbidity`); plain value if code==display |
| `_text.extension[rendering-style]` | `_renderStyle` (applied as inline CSS in preview) |
| `item.prefix` | `_prefix` — amber badge in preview; editable in builder; exported back (round-trip safe) |
| `item.code[]` | `_codes` — preserved as-is; exported back unchanged (round-trip safe) |

Custom extensions (URL prefix `http://logicbuilder.example.org/extension/`):
- `conditionRule` — applicability condition
- `visibilityRule` — complex JS expression (when not convertible to enableWhen)
- `successValue` — expected answer for pass/fail evaluation

Standard extensions preserved on export:
- `http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl` — `radio-button` code for `radio` itemType

### Export

- Simple `visibilityRule` patterns (`values['id'] OP value`) → standard FHIR `enableWhen`
- Complex JS expressions → stored as extension (round-trip safe)
- `conditionRule`, `successValue` → always as extensions

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
- **Visual condition builder** — in the Visibility panel: pick a question by title to generate JS
- **Auto-fill** — checkboxes with `conditionRule` are pre-filled from patient data (🤖), overridable by the clinician
- **AND/OR badges** — on group headers: `ALL items ✓` / `ANY item ✓`
- **Logic separators** — `— AND —` / `— OR —` between sibling items inside a group
- **Dimmed rows** — conditional items shown grayed out (🔒) when their condition is not met; animate to active when met
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
- **SDC Variables** — `sdc-questionnaire-variable` extensions on root Questionnaire imported into `questVariables[]`; collapsible card above tree shows `%name` chips; Edit modal for add/edit/delete; passed as `%varName` env vars to FHIRPath `calculatedExpression` automatically on every preview render; round-trip safe
- **Auto calculatedExpression** — calc fields re-evaluated automatically on every patient input, answer, or tree change; no Test button; calc-badge shows current value immediately
- **Default value (item.initial[])** — `item.initial[0]` imported → `node._initialValue`; pre-fills preview on load; editable via **Default** action panel (type-aware: select/date/number/text); `× clear` link syncs preview; round-trip safe export
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
npm test          # single run (Vitest)
npm run test:watch  # watch mode — re-runs on file changes
```
CI runs automatically on every push via GitHub Actions (see `.github/workflows/test.yml`).

---

## Known Limitations / TODO

- Multi-condition visibility (`&&`, `||`) not supported in the visual builder — must be written manually as JS
- `conditionRule` on items is not exported to standard FHIR (prototype-specific concept with no direct R4 equivalent)
- Full list of unsupported FHIR features (repeating items, answerValueSet, initial values, etc.) → [docs/FHIR-MAPPING.md](docs/FHIR-MAPPING.md#not-supported-out-of-scope)
