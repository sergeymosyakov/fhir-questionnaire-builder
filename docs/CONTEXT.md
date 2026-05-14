# QuestionaryPrototype — Build Context

> Internal architecture and codebase notes. See [README.md](../README.md) for user-facing docs.

## ⚠️ WORKFLOW RULES — MANDATORY

1. **git commit/push only on explicit user instruction** ("push it", "пушай"). Never automatically.
2. **Before every push** — update CONTEXT.md, docs/CONTEXT.md, docs/FHIR-MAPPING.md (if FHIR mapping changed), and README.md (file table, UX features, Known Limitations).
3. **Modularity** — new UI widget → `js/ui/<name>.js`; new control → `js/controls/<name>.js`; new CSS concern → `css/<name>.css` + `<link>` in index.html. Do not add logically separate code into existing modules.
4. **DI** — DOM resolved once in `app.js`, passed via `init(elements)`. No `getElementById` inside submodules.
5. **No inline styles** — `style="..."` in HTML and `el.style.foo =` in JS are forbidden for static values. Allowed only for **runtime-dynamic** values: show/hide (`display`), computed dimensions, user-driven colors. All static appearance → CSS classes.
6. **English only** — all code comments, doc strings, commit messages, CONTEXT.md, README.md, any in-repo text, **and all UI labels, button text, and tooltip text in HTML and JS** must be in English. No Russian anywhere in the codebase.

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
| `css/styles.css` | All styles and CSS design tokens |
| `js/app.js` | Entry point — wires inputs, buttons, loads example |
| `js/state.js` | Reactive state, data factories, shared utilities |
| `js/eval.js` | Tree evaluation — `enableWhen[]` visibility, `enableWhenExpression` FHIRPath, `evalConstraints` |
| `js/render-builder.js` | Left panel — builder tree DOM |
| `js/render-preview.js` | Right panel — reactive preview |
| `js/fhir/import.js` | FHIR R4 → internal model |
| `js/fhir/export.js` | Internal model → FHIR R4 |
| `js/ui/variables-panel.js` | SDC Variables card + edit modal — `init(elements, questVariables)`, `refresh()` |
| `js/ui/patient-ctx.js` | Patient context popup — seeds and manages `%age`, `%gender`, `%bmi`, `%pregnant`, `%smoker`, `%proc`, `%comorb` as FHIRPath literal expressions in `questVariables` |
| `sampledata/example-bariatric.fhir.json` | FHIR R4 example (bariatric pre-authorization) |
| `sampledata/1776102565767-...json` | Real-world questionnaire for testing |
| `package.json` | Node dev tooling — Vitest test runner (`npm test`) |
| `vitest.config.js` | Vitest config — node environment, `tests/**/*.test.js` |
| `tests/utils.test.js` | Unit tests for `js/utils.js` (22 tests) |
| `tests/eval.test.js` | Unit tests for `js/eval.js` — `evaluateNode`, `markAllDisabled`, `enableWhen` AND/OR logic (23 tests) |
| `tests/calc.test.js` | Unit tests for `js/fhir/calc.js` — `buildVarEnv`, `evalCalcNodes` (11 tests) |
| `tests/validate.test.js` | Unit tests for `js/fhir/validate.js` — `validateTree` (21 tests) |
| `tests/export.test.js` | Unit tests for `js/fhir/export.js` — enableWhen, constraints, SDC variables (33 tests) |
| `tests/import.test.js` | Unit tests for `js/fhir/import.js` — `fhirTypeToItemType`, `fhirOptsToStr`, `humanEnableWhen`, `applyVisibility` (45 tests) |
| `tests/qr-builder.test.js` | Unit tests for `js/fhir/qr-builder.js` — `buildQR`, `buildQRItem` (23 tests) |
| `.github/workflows/test.yml` | GitHub Actions CI — runs `npm test` on every push/PR to main |

---

## Tech Stack

- **`@vue/reactivity`** (ESM CDN) — only `ref`, `reactive`, `effect`. No Vue components.
- **ES Modules** — `import/export` between files; requires HTTP server (`npx serve .` or GitHub Pages)
- **Vanilla JS DOM** — left panel (builder) constructed imperatively
- **`effect()`** — rebuilds the right panel (preview) on reactive state changes
- **FHIRPath** — `window.fhirpath` (global, `lib/fhirpath.min.js`); used in `enableWhenExpression`, `calculatedExpression`, `evalConstraints`, and `buildVarEnv`
- **Vitest** — unit test suite for pure-function modules; **178 tests**; CDN imports mocked via `vi.mock`; CI via GitHub Actions (`npm test`)
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
```

---

## Evaluation Logic

### enableWhen
- `node.enableWhen[]` checked against `values[ew.question]` using `checkOneEnableWhen(ew)`
- `node.enableBehavior === 'all'` (default) → all conditions must pass (AND)
- `node.enableBehavior === 'any'` → any one condition passes (OR)
- If `enableWhenExpression` is set, evaluated via `fhirpath.evaluate()` as override/fallback
- Node hidden if conditions not met; `showDimmed` set if any enableWhen is defined

### Final Result
- **PASS** — all visible, mandatory items are satisfied
- **FAIL** — at least one mandatory item is not satisfied

---

## Preview Rendering (renderPreviewNode)

1. `!visible && showDimmed` → gray row with 🔒 + `_enableWhenText`
2. `disabled` → gray row with `—` icon, pointer-events:none
3. `type:'group'` with no children → italic gray text (informational display, no controls, no logic badge)
4. Normal → row with ✔/✘ icon, control, linkId prefix, AND/OR badge (groups)
- `_renderStyle` applied as inline `style` on the label span in all row types

---

## FHIR Item Type Support

| FHIR R4 type | `itemType` | Control | Validation | Notes |
|---|---|---|---|---|
| `boolean` | `checkbox` | ✅ | — | |
| `integer`, `decimal` | `number` | ✅ | — | `quantity` → number, unit ignored |
| `string`, `text` | `text` | ✅ | — | |
| `date`, `dateTime`, `time` | `date` | ✅ date-picker | — | All three → `date` |
| `url` | `url` | ✅ | ✅ `new URL()` | Invalid format → ✘ even if optional |
| `choice` | `select` / `radio` | ✅ | — | `questionnaire-itemControl: radio-button` → `radio` |
| `open-choice` | `select` | ⚠️ | — | Free-text option not rendered |
| `display` | `display` | ✅ label | — | No control, no pass/fail |
| `group` | `group` | ✅ | — | |
| `group` (no children) | `group` | ✅ `[Info]` | — | |
| `attachment` | `attachment` | ✅ file input | ✅ required = file chosen | |
| `reference` | `text` | ⚠️ fallback | — | No resource search |

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
- Downloads as `<name>.json` (user prompted for filename)

---

## Key UX Features

- **Bidirectional navigation** — click preview row → scroll+flash builder node (teal); click builder node header → scroll+flash preview row (blue); `↗` button on every builder node header (after `[Item]`/`[Group]` label) provides explicit one-click navigation to the corresponding preview row
- **Drag & drop reorder** — ⠿ handle on every node; drag to reorder, drop between nodes (blue line), drop into group (dashed zone), drop at root level; ancestor→descendant drop blocked
- **Collapse sections (preview)** — `▼/▶` toggle on each group row in the preview; SVG corner-arrow icon buttons in the preview toolbar collapse/expand all (appear when tree is non-empty, right-aligned via flex spacer)
- **Preview toolbar order** — `⬆ Load ▾` | `⬇ Export` | 🔍 Search | [flex spacer] | `id` toggle | `prefix` toggle | collapse | expand; search and collapse/expand shown only when tree has content
- **Disabled groups clickable** — N/A (grayed `—`) groups in preview are still clickable to navigate to builder node
- **Editable linkId** — blue monospace input in the builder node header; directly edits `node.id`
- **item.prefix** — FHIR R4 `Questionnaire.item.prefix` imported into `node._prefix` and exported back (round-trip safe); amber pill badge in preview; editable in builder meta-row; **Renumber** assigns sequential prefixes (e.g. `1`, `1.1`) — writes `_prefix` only, never changes `node.id`
- **linkId / prefix toggles** — `id` (blue) and `prefix` (amber) buttons in preview toolbar toggle the corresponding pill badges; state stored in `showLinkId` / `showPrefix` refs; clicking a linkId badge copies the linkId to clipboard (✓ copied feedback); badge shows rich tooltip with visibility-rule usage, expected value type, item type
- **SDC Variables** — `sdc-questionnaire-variable` extensions on the root Questionnaire are imported into `questVariables[]`; a collapsible card above the tree shows `%name` chips; clicking Edit opens a modal to add/edit/delete variables (name + FHIRPath expression); variables are passed as `%varName` env vars when evaluating `calculatedExpression` automatically on every preview render; round-trip safe on export
- **Default value (item.initial[])** — `item.initial[0]` imported → `node._initialValue`; pre-fills the preview on load; editable via **Default** action panel in builder; control adapts to itemType (select for checkbox/choice, date, number, text); `× clear` link updates preview instantly; exported back as `item.initial[]`
- **Rich tooltips on action buttons** — all builder action buttons (Answer Type, Required, Show When, Applicability, Expression, Default, Appearance), toolbar buttons (Load, Export, Add Root Group, Renumber, prefix format select, id/prefix/collapse/expand), and the Variables card title carry `data-tip-*` attributes with FHIR field path and spec reference (R4 / SDC) in the footer; implemented via delegated `mouseover` in `js/ui/tooltip.js`
- **Tooltip toggle** — `tips` button in the preview toolbar; green = enabled (default), orange = disabled; persisted in `localStorage` (`tooltips-enabled`); **tooltips off** label shown next to Logic Builder heading when disabled
- **Radio answer options in builder** — Answer Type panel shows the Options (comma-separated) editor for `radio` items (bug fix: was shown only for `select` and `open-choice`)
- **Validate button** — standalone **Validate** button in the Questionnaire Preview header; runs `validateTree()`; shows green ✅ "All good" when no issues; only visible when questionnaire is loaded
- **Esc closes modals** — Validate modal and Variables modal both close on Escape key
- **Ctrl+F** — intercepts browser find and focuses preview search input (when visible)
- **Auto calculatedExpression** — `_calculatedExpr`/`_readOnly` nodes evaluated via FHIRPath automatically on every `effect()` run (patient input, answer, or tree change); `buildVarEnv` resolves `questVariables` as `%varName`; no manual Test button
- **Empty-state placeholder** — right panel shows hint text when tree is empty; Validate, Export hidden until questionnaire is loaded
- **Variables card visibility** — controlled solely by `effect()` in `app.js` based on `tree.length`; `refresh()` only updates chips/count
- **PASS/FAIL status badge** — replaces the full-width status bar; a small pill badge (`✓ PASS` / `✗ FAIL · N issues`) in the preview header right of the filename; click opens a dark dropdown listing numbered failing items with ↗ links to navigate directly to the problem field; dropdown has scroll, closes on outside click; implemented in `js/ui/status-badge.js` + `css/status-badge.css`
- **Collapse-safe navigation** — `navigateToPreview(id)` in `render-preview.js` finds collapsed ancestors via `findAncestorGroupIds`, expands them, then scrolls; used by ↗ builder buttons and status-badge dropdown
- **Autosave toggle** — `autosave` button in Logic Builder header (green = on, grey = off); when enabled label shows last save time `autosave · HH:MM`; state persisted in `localStorage` (`autosave-enabled`); rich tooltip explains the feature
- **Variables validation** — closing Variables modal strips blank rows; blocks close if any variable has expression but no name; highlights name field red with "Name is required"
- **Copyright + GitHub in top panel** — copyright text and GitHub link moved to the top (patient data) panel, right-aligned; order: GitHub icon → copyright text
- **Expandable title** — node title shown as a read-only span; click → expands to a full-width textarea (auto-height), collapses on blur
- **Style editor** — `Style` panel on every node: Bold / Italic checkboxes, color picker, raw CSS field. Syncs with `_renderStyle`; applied live in preview
- **Auto-scroll on add** — `+ Group`, `+ Item`, `Add Root Group` scroll to and flash the new node; parent group auto-expands
- **Visual condition builder** — "Show When" action panel uses FHIR `enableWhen[]` directly: AND/ANY toggle, per-condition rows (question picker + operator + type-aware value input), "+ Add condition", FHIRPath `enableWhenExpression` for advanced expressions
- **Patient Context popup** — "Patient Context" button in toolbar opens modal; sets `%age`, `%gender`, `%bmi`, `%pregnant`, `%smoker`, `%proc`, `%comorb` as FHIRPath literal expressions in `questVariables`
- **AND/OR badges** — on group headers: `ALL items ✓` / `ANY item ✓`
- **Logic separators** — `— AND —` / `— OR —` between sibling items inside a group
- **Dimmed rows** — conditional items shown grayed (🔒) when condition not met; animate to active when met
- **Informational rows** — `type:'group'` nodes with no children rendered as plain italic text; labeled `[Info]` in builder
- **required text/number** — `required:true` on text/number items means non-empty; shows ✔/✘ icon and affects PASS/FAIL
- **select / radio controls** — no longer auto-fill the first option on render; mandatory fields start empty (`— select —` placeholder for select, no pre-check for radio) so PASS/FAIL is accurate on initial load
- **text / number / date / url / attachment / quantity / reference controls** — all call `_reCalc()` + `_formTick.value++` on every change so FHIRPath calculatedExpression nodes update live

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

- `conditionRule` on items is not exported to FHIR (prototype-specific concept, no R4 equivalent)
- Example loads via `window.EXAMPLE_FHIR_Q` (JS wrapper), not `fetch`, for `file://` compatibility

