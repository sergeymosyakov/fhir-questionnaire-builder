# QuestionaryPrototype — Build Context

> Internal architecture and codebase notes. See [README.md](../README.md) for quick-start and sample data; [FHIR-MAPPING.md](FHIR-MAPPING.md) for FHIR field coverage; [GitHub issues labeled `roadmap`](https://github.com/sergeymosyakov/fhir-questionnaire-builder/issues?q=is%3Aissue+is%3Aopen+label%3Aroadmap) for the feature backlog.

> **⚠️ Critical workflow rules:** See [`.github/copilot-instructions.md`](../.github/copilot-instructions.md) for THE MUST and WORKFLOW RULES (git push policy, testing checklist, modularity, English-only, etc.).

---

## What It Is

A prototype **Logic Builder** for medical questionnaires (FHIR R4 / R4B / R5 Questionnaire).
Allows visually building questionnaire logic, testing it against patient data, and importing/exporting FHIR R4/R4B/R5 JSON or REDCap CSV.

---

## Product Direction

**Target audience:** Developers and FHIR integration engineers who build, inspect, or maintain logic-heavy questionnaires in FHIR R4 format.

This is a **Variant B** tool — it surfaces FHIR concepts directly (linkId, enableWhen, extensions, FHIRPath) rather than hiding them behind simplified UX. It is not designed for direct use by clinicians without training.

### Key Scenarios

These three scenarios act as a feature filter: new functionality is considered only if it directly supports at least one of them.

**Scenario 1 — Edit & round-trip**  
Import an existing FHIR R4/R4B/R5 `Questionnaire`, adjust visibility/applicability logic using the visual builder, then export the modified questionnaire back to FHIR JSON. Primary workflow for integration projects.

**Scenario 2 — Build from scratch**  
Assemble a new questionnaire (e.g., bariatric surgery pre-authorization) from scratch using the builder, test it against patient profiles, and export validated FHIR JSON.

**Scenario 3 — Logic testing**  
Load any FHIR questionnaire and simulate different patient profiles in the patient-data panel. Instantly see which items are visible, which are N/A, and whether the questionnaire resolves to PASS or FAIL.

---

## Files

See [context/file-manifest.md](context/file-manifest.md) for the full per-file reference table.

---

## Tech Stack

- **ES Modules** — `import/export` between files; requires HTTP server (`npx serve .` or GitHub Pages)
- **Vanilla JS DOM** — left panel (builder) constructed imperatively
- **Event-driven rendering** — cross-module communication via `AppEvents` custom events; preview re-renders on `RESPONSE_CHANGED`, `REINIT_FORM`, etc.
- **FHIRPath** — `window.fhirpath` (global, `lib/fhirpath.min.js`, vendored at `npm run vendor:fhirpath` / `vendor:fhirpath:r4` after a version bump — no CDN, CSP blocks arbitrary script hosts); used in `enableWhenExpression`, `calculatedExpression`, `evalConstraints`, and `buildVarEnv`
- **StructureMap execution** — [`fhir-structuremap-js`](https://github.com/sergeymosyakov/fhir-structuremap-js), a real FML/StructureMap engine, vendored at `lib/fhir-structuremap-js.esm.js` (`npm run vendor:structuremap` to rebuild after a version bump — not loaded from a CDN, CSP's `script-src` only allows `'self'`); executes `sdc-questionnaire-targetStructureMap` for **Save ▾ → StructureMap Extract** and `sdc-questionnaire-sourceStructureMap` for **Answers ▾ → Fill via StructureMap** (fetches the source resource from the FHIR Base Server, then runs the map in-browser — no server-side `$populate` support required)
- **CQL execution** — [`cql-execution`](https://github.com/cqframework/cql-execution) + [`cql-exec-fhir`](https://github.com/cqframework/cql-exec-fhir), vendored at `lib/cql-execution.esm.js` / `lib/cql-exec-fhir.esm.js` (`npm run vendor:cql` / `vendor:cql-fhir`, lazy dynamic-imported — no CDN); resolves `initialExpression` fields with `language: text/cql-identifier` against a `#id` contained `Library`'s embedded precompiled ELM (`cqf-library` extension) — self-contained/offline only, see `docs/FHIR-MAPPING.md` "CQL execution"
- **Playwright** — E2E test suite; 128 spec files (Chromium); CI via GitHub Actions (`npx playwright test`)
- **Dependency injection** — `dnd.js` receives callbacks from `BuilderPanel`; `_shared.js` is pure-function only (no injected state)
- **Event-driven calc** — nodes/modals dispatch `CALC_RECALC_REQUESTED`; `BuilderPanel` listens and runs `evalCalcNodes` + dispatches `RESPONSE_CHANGED`
- **Confirm dialog** — `ConfirmDialog.show(label)` in `js/ui/confirm-dialog.js` — no DI, standalone `Promise<boolean>`
- **`ctx` object** — `{ renderTree, renderNode, tree, collapsed }` passed down to renderers and panels
- **Vitest** — unit test suite for pure-function modules; **1735 tests** across 52 files; CI via GitHub Actions (`npm test`)
- **GitHub Pages** — https://fhirbuilder.com/

---

## Architecture

### Node Class Hierarchy (OOP Rendering)

Each node type owns its own DOM rendering via the `renderPreview(res, container, rc)` method:

```
BaseNode            — js/nodes/base-node.js       shared scaffold, dimmed/disabled rows
  ├─ GroupNode      — js/nodes/group-node.js       group rows, AND/OR logic, collapse, refreshIcon()
  └─ ItemNode       — js/nodes/item-node.js        all item types, badges, controls
       ├─ DisplayNode   — js/nodes/display-node.js   display items, category icons, help toggle
       └─ ChecklistNode — js/nodes/choice-node.js    multi-select checkboxes (check-box itemControl)
```

- **`NODE_REGISTRY`** (`js/nodes/index.js`) — `Map<itemType → class>`; dispatch: `NODE_REGISTRY.get(node.itemType)?.prototype.renderPreview.call(node, …)`
- **`_rc`** (`js/preview/render-ctx.js`) — dependency injection hub; node classes read stable refs (`buildControl`, `isMandatory`, etc.) from `_rc` instead of importing `js/fhir/form-checks.js` / `js/fhir/quest-document.js` directly (avoids circular deps)
- **Circular dep rule**: node class files **must not** import `js/fhir/form-checks.js` or `js/fhir/quest-document.js` directly. Inject via `_rc` instead.
- **`js/controls/{type}.js`** — per-type interactive control factories (date picker, select, checkbox, etc.); called via `rc.buildControl(node, ctx)`. Control files do **not** own row rendering.

### State

```js
// Patient context — stored as FHIRPath literal expressions in questVariables (js/ui/patient-panel.js)
// NOT auto-seeded: created only when a patient preset is selected or Custom… is applied
// e.g. { name:'age', expression:'30' }, { name:'gender', expression:"'male'" }, etc.
// Accessible in FHIRPath as %age, %gender, %bmi, %pregnant, %smoker, %proc, %comorb

tree              // plain array — questionnaire node tree
values            // plain object — form answers (not reactive; avoids re-render on every keystroke)
questVariables    // plain array — SDC variable entries; patient ctx added here on preset/Custom apply
questContained    // plain array — Questionnaire.contained[] raw FHIR resources (round-trip)
questMeta         // plain object — questionnaire-level metadata: id, url, version, title, status, publisher, description
rawFhir           // { value: null } — original FHIR JSON after import
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
_renderXhtml     // raw XHTML string from FHIR _text.extension[rendering-xhtml] (round-trip only, not rendered)
_calculatedExpr  // FHIRPath string (SDC calculatedExpression)
_initialExpr     // FHIRPath string (SDC initialExpression) — evaluated once on import + Re-init
_readOnly        // boolean — FHIR item.readOnly
_initialValue    // any — FHIR item.initial[0] value (pre-fills values[] on import)
_prefix          // string — FHIR item.prefix (amber badge; editable in builder)
_codes           // object[] — FHIR item.code[] (preserved round-trip; not displayed)
_maxLength       // integer — FHIR item.maxLength (imported/exported; character counter + maxlength attr enforced in preview)
_minLength       // integer — SDC minLength ext (imported/exported; minlength HTML attr + inline error on blur when non-empty value is too short)
_minOccurs       // integer — questionnaire-minOccurs ext (imported/exported when repeats:true)
_maxOccurs       // integer — questionnaire-maxOccurs ext; enforced in preview — add button disabled at limit
_answerValueSet  // string — FHIR item.answerValueSet URL; round-trip preserved; local #vs-id refs resolved into node.options during import so preview renders real options
_minValue        // number — questionnaire-minValue ext; error badge shown in preview + blocks PASS when violated
_maxValue        // number — questionnaire-maxValue ext; error badge shown in preview + blocks PASS when violated
_optionOrdinals  // object — map of option code → numeric ordinalValue; shown as (N) badge on radio/select options; round-trip safe
_sliderStep      // number — questionnaire-sliderStepValue ext; when set, integer/decimal renders as <input type="range"> slider; editable in Answer Type modal
_disabledDisplay // 'hidden'|'protected' — when not visible: 'hidden' removes item from DOM entirely, 'protected' shows grayed row (default); editable in Show When modal
_choiceOrientation // 'vertical'|'horizontal' — questionnaire-choiceOrientation ext; controls layout of radio button groups (vertical: stacked column, horizontal: inline row); editable in Answer Type modal for radio items
_displayCategory   // 'instructions'|'security'|'help' — questionnaire-displayCategory ext; applies colored bg + left border + icon (instructions/security) or collapsible help toggle (help) to group items in preview; R4: only exported for group items (suppressed on display items with validator warning); editable in Answer Type modal for group items
_shortText         // string — sdc-questionnaire-shortText ext; abbreviated label for summary views; shown as a small blue badge in builder preview row (not in patient view); round-trip safe; not editable in builder UI
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
- Evaluated via FHIRPath against the QuestionnaireResponse in `evalConstraints(node, qr, envVars)` in `js/fhir/form-checks.js`
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
| `choice` | `select` / `radio` / `checklist` | ✅ | — | `questionnaire-itemControl: radio-button` → `radio`; `check-box` → `checklist` (multi-select checkboxes); `autocomplete` → searchable dropdown; `drop-down` preserved |
| `open-choice` | `open-choice` | ✅ text + datalist | — | Free-text allowed; datalist populated from `answerOption[]` |
| `display` | `display` | ✅ label | — | No control, no pass/fail |
| `group` | `group` | ✅ | — | |
| `group` (no children) | `group` | ✅ `[Info]` | — | |
| `attachment` | `attachment` | ✅ file input | ✅ required = file chosen | |
| `reference` | `reference` | ✅ dropdown (resource type) + id input; **live FHIR search** when `fhirBaseUrl` configured in Settings — autocomplete by name (Patient/Practitioner/etc.) or `patient.name` (Encounter/Condition/etc.) via portal dropdown | ✅ required = type+id filled | `questionnaire-referenceResource` extension locks dropdown |

---

## FHIR Import (`importFHIR`)

- `enableWhen[]` + `enableBehavior` → `node.enableWhen[]`, `node.enableBehavior`, `node._enableWhenText`
- `sdc-questionnaire-enableWhenExpression` → `node.enableWhenExpression`
- `questionnaire-constraint` extensions → `node.constraint[]`
- `type:group` → group node; `type:boolean` → `itemType:'checkbox'`; `type:choice` → `itemType:'select'` or `'radio'` (if `questionnaire-itemControl: radio-button`) or `'checklist'` (if `check-box`); `autocomplete`/`drop-down`/`text-area`/`text-box`/`spinner`/`slider`/`lookup` → stored as `node._itemControl`
- `_text.extension[rendering-style]` → `_renderStyle` (applied as inline CSS in preview)
- `_text.extension[rendering-xhtml]` → `_renderXhtml` (rendered via `DOMPurify.sanitize()` + `innerHTML` in preview; editable in Appearance modal)
- `item.prefix` → `node._prefix` (amber badge in preview; editable in builder; exported back)
- `item.code[]` → `node._codes` (preserved as-is; exported back unchanged)
- `item.repeats` → `node.repeats` (multi-row input; not for checkbox/display)
- `item.maxLength` → `node._maxLength` (character counter + `maxlength` HTML attribute enforced in preview)
- `minLength` SDC extension → `node._minLength` (inline error shown on blur when non-empty value is shorter than limit)
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
- `node._minLength` → `minLength` SDC extension with `valueInteger` (when set)
- `node._minOccurs` → `questionnaire-minOccurs` extension (when `node.repeats` **and** `node.required === true` — R4 context invariant `que-minoccurs-1`)
- `node._maxOccurs` → `questionnaire-maxOccurs` extension (when `node.repeats`)
- `node._minValue` → `questionnaire-minValue` extension (`valueInteger` when integer, `valueDecimal` otherwise)
- `node._maxValue` → `questionnaire-maxValue` extension (`valueInteger` when integer, `valueDecimal` otherwise)
- `node._optionOrdinals` → `ordinalValue` extension on each `answerOption[].extension` (at answerOption level, per FHIR R4 spec) that has an entry
- `node._sliderStep` → `questionnaire-sliderStepValue` extension (always `valueInteger`; decimal steps rounded; R4 constraint)
- `node._disabledDisplay` (when not `'protected'`) → `item.disabledDisplay` (omitted when `'protected'` as it is the default)
- `itemType:'radio'` → exports `type:'choice'` + standard `questionnaire-itemControl: radio-button` extension (round-trip safe)
- `itemType:'checklist'` → exports `type:'choice'` + `questionnaire-itemControl: check-box` extension + `repeats: true` (round-trip safe)
- `node._itemControl` → exports corresponding `questionnaire-itemControl` extension code (`autocomplete`, `drop-down`, `text-area`, `text-box`, `spinner`, `slider`, `lookup`)
- Downloads as `<name>.json` (user prompted for filename)

---

## Key UX Features

See [context/ux-features.md](context/ux-features.md) for the full list.

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
https://fhirbuilder.com/

---

## Known Limitations / TODO

- Multi-condition visibility with complex FHIRPath (cross-group references, extensions) not supported in the visual enableWhen builder — must be typed as `enableWhenExpression` directly

