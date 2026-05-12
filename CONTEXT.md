# QuestionaryPrototype — Build Context

## ⚠️ WORKFLOW RULES — MANDATORY

1. **git commit/push только по явной команде пользователя** ("пушай"). Не делать автоматически.
2. **Перед каждым пушем** — обновить CONTEXT.md и README.md (таблица файлов, UX features, Known Limitations).
3. **Модульность** — новый UI виджет → `js/ui/<name>.js`; новый контрол → `js/controls/<name>.js`; новый CSS блок → `css/<name>.css` + `<link>` в index.html. Не добавлять в уже существующие файлы то, что логически принадлежит отдельному модулю.
4. **DI** — DOM резолвится один раз в `app.js`, передаётся через `init(elements)`. Никаких `getElementById` внутри субмодулей.

---

## What It Is

A prototype **Logic Builder** for medical questionnaires (FHIR R4 Questionnaire).  
Allows visually building questionnaire logic, testing it against patient data, and importing/exporting FHIR R4 JSON.

---

## Files

| File | Purpose |
|---|---|
| `index.html` | Entry point — markup, script imports |
| `favicon.svg` | Browser tab icon |
| `start.ps1` | Local dev server: `npx serve .` |
| `css/styles.css` | All styles and CSS design tokens |
| `js/app.js` | Entry point — wires inputs, buttons, loads example |
| `js/state.js` | Reactive state, data factories, business logic |
| `js/utils.js` | Pure utility functions (`escAttr`, `findAndRemove`, `isDescendant`, `parseOption`, `parseOptions`) |
| `js/eval.js` | Tree evaluation (visibility / condition rules) |
| `js/render-builder.js` | Left panel — 3-line re-export shim → `js/builder/` |
| `js/builder/ctx.js` | `BuilderCtx` JSDoc typedef (no runtime exports) |
| `js/builder/index.js` | Builder orchestrator — public API (`renderTree`, `collapseAll`, etc.) |
| `js/builder/_shared.js` | Shared utilities; injected deps via `init(deps)` |
| `js/builder/dnd.js` | Self-contained drag & drop; all state via `init(onDrop, tree, formTick)` |
| `js/builder/panels.js` | All action panel builders (vis, mand, cond, type, expr, style) |
| `js/builder/node-item.js` | `renderItem(node, ctx)` |
| `js/builder/node-group.js` | `renderGroup(node, ctx)` |
| `js/render-preview.js` | Right panel — reactive preview |
| `js/controls/index.js` | Control registry — dispatches by `itemType` |
| `js/controls/{type}.js` | Per-type control implementations |
| `js/fhir/import.js` | FHIR R4 → internal model |
| `js/fhir/export.js` | Internal model → FHIR R4 |
| `js/fhir/validate.js` | `validateTree(tree)` → `{severity,nodeId,message}[]`; linkId uniqueness, JS/FHIRPath syntax, empty titles, missing options |
| `js/ui/validate-modal.js` | Validation modal UI — `init(elements)` + `show(title, issues, mode, onExport?)`; no hardcoded DOM IDs |
| `js/ui/progress.js` | Global progress bar — `init(elements)`, `show/update/hide` |
| `js/ui/search.js` | Preview search — `init(elements)`, `refresh()`; highlight + up/down/Enter navigation |
| `sampledata/example-bariatric.fhir.json` | Built-in example loaded on startup |
| `sampledata/bariatric-extended.fhir.json` | Synthetic bariatric pre-auth — 87 items, 32 enableWhen, all types |
| `sampledata/ussg-fht.fhir.json` | US Surgeon General Family Health History (49 items, depth 5) |
| `sampledata/prowl-ss.fhir.json` | PROWL-SS post-op pain assessment (44 items) |
| `sampledata/phq-9.fhir.json` | PHQ-9 depression screening (11 items) |
| `sampledata/1776102565767-...json` | Real-world questionnaire snapshot for regression testing |

---

## Tech Stack

- **`@vue/reactivity`** (ESM CDN) — only `ref`, `reactive`, `effect`. No Vue components.
- **ES Modules** — `import/export` between files; requires HTTP server (`npx serve .` or GitHub Pages)
- **Vanilla JS DOM** — left panel (builder) constructed imperatively
- **`effect()`** — rebuilds the right panel (preview) on reactive state changes
- **`new Function()`** — sandboxed rule evaluation (`evalRule`)
- **Dependency injection** — `dnd.js` and `_shared.js` receive all state via `init()`, no module-level singletons
- **`ctx` object** — `{ renderTree, renderNode, tree, formTick, collapsed }` passed down to renderers and panels
- **GitHub Pages** — https://sergeymosyakov.github.io/fhir-questionnaire-builder/

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
calcTested    // ref(false) — true after Test button clicked; enables calculatedExpression evaluation
autoFilledIds // Set — IDs of items auto-filled from conditionRule
```

### Node Data Model

```js
// Group
{ id, type:'group', title, visibilityRule, conditionRule, mandatory,
  logicWithParent:'AND'|'OR', children:[] }

// Item
{ id, type:'item', title, visibilityRule, conditionRule, mandatory,
  itemType:'text'|'number'|'checkbox'|'select'|'display', options, successValue }

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
- `false` → group and all descendants marked **N/A** (grayed, `—`)
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

## FHIR Import (importFHIR)

- `enableWhen` → `visibilityRule` JS expression + `_enableWhenText` (human label)
- `type:group` → group node; `enableBehavior:any` → `logicWithParent:'OR'`
- `type:boolean` → `itemType:'checkbox'`; `type:choice` → `itemType:'select'` or `'radio'` (if `questionnaire-itemControl: radio-button`)
- Custom extensions at URL `http://logicbuilder.example.org/extension/...`: `conditionRule`, `visibilityRule`, `successValue`
- `_text.extension[rendering-style]` → `_renderStyle` (applied as inline CSS in preview)
- `linkIdMap` built before parsing → used for human-readable condition text

## FHIR Export (exportFHIR)

- Simple `visibilityRule` patterns (`values['id'] OP value`) → standard FHIR `enableWhen`
- Complex JS → stored as extension (round-trip safe)
- `conditionRule`, `successValue` → always as extensions
- `itemType:'radio'` → exports `type:'choice'` + standard `questionnaire-itemControl: radio-button` extension (round-trip safe)
- Downloads as `<name>.json` (user prompted for filename before download)

---

## Key UX Features

- **Clear questionnaire** — `×` button next to the loaded file name clears tree, values, rawFhir; if tree is non-empty shows a modal asking to export first (Export first / Clear anyway / Cancel)
- **Loaded file name** — shown in right-panel header after import; also appears as `New Questionnaire` when building from scratch; `×` button always visible when tree is non-empty
- **Export filename prompt** — `window.prompt` before every export; pre-filled with current file name; adds `.json` if not already present
- **Bidirectional navigation** — click preview row → scroll+flash builder node (teal); click builder node header → scroll+flash preview row (blue)
- **Drag & drop reorder** — ⠿ handle on every node; drag to reorder, drop between nodes, drop into group, drop at root level; ancestor→descendant drop blocked. Drop zones appear only during drag (`body.dragging` CSS class, `height:0` → `28px`); labeled: "Drop here to add as first child" (top of group), "Drop here" (between siblings), "Drop here to add as last child" (bottom of group), "Drop here to move to end" (root zone). Each node wrapped in `div.node-wrap` (display:contents) so drop zones sit outside the styled box.
- **Collapse sections (preview)** — `▼/▶` toggle on each group row in the preview; `⊟`/`⊞` buttons in the preview toolbar collapse/expand all (appear after FHIR load)
- **Disabled groups clickable** — N/A (grayed `—`) groups in preview are still clickable to navigate to builder node
- **Editable linkId** — blue monospace input in the builder node header; directly edits `node.id`
- **Expandable title** — node title shown as a read-only span; click → expands to a full-width textarea (auto-height), collapses on blur
- **Style editor** — `Style` panel on every node: Bold / Italic checkboxes, color picker, raw CSS field. Syncs with `_renderStyle`; applied live in preview
- **Auto-scroll on add** — `+ Group`, `+ Item`, `Add Root Group` scroll to and flash the new node; parent group auto-expands
- **Visual condition builder** — in the Visibility panel: pick a question by title to generate JS
- **Auto-fill** — checkboxes with `conditionRule` pre-filled from patient data (🤖), overridable by clinician
- **AND/OR badges** — on group headers: `ALL items ✓` / `ANY item ✓`
- **Logic separators** — `— AND —` / `— OR —` between sibling items inside a group
- **Dimmed rows** — conditional items shown grayed (🔒) when condition not met; animate to active when met
- **Informational rows** — `type:'group'` nodes with no children rendered as plain italic text; labeled `[Info]` in builder
- **required text/number** — `required:true` on text/number items means non-empty; shows ✔/✘ icon and affects PASS/FAIL
- **required checkbox** — `required:true` on boolean items requires the box to be checked; shows ✔/✘; affects PASS/FAIL
- **required radio/select** — `required:true` on choice/radio items requires an option to be selected; shows ✔/✘ on item and group icon; affects PASS/FAIL
- **Required star** — `mandatory===true` items (default) show a red `*` in the label in preview
- **Optional badge** — `mandatory===false` items show a small italic `optional` badge in preview
- **Styled file input** — `attachment` renders as a custom **Choose file** button (blue, themed) + file name; native input hidden
- **Active action buttons** — action panel buttons (Show When, Applicability, Expression, Appearance, Required) turn **dark purple** when they have content set; initialised on load, updated in real-time on edit
- **Load ▾ dropdown** — single button opens a menu with all built-in samples + "From file…" option; replaces separate Load/Example buttons; no startup auto-load (empty-state placeholder shown instead)
- **Hierarchical node IDs** — new groups/items get IDs like `1`, `1.1`, `1.1.1` using the active renumber format (numeric / roman / letters)
- **Export validation** — on Export: `validateTree()` runs; if issues found → modal with error/warning list, ↗ navigate-to-node button per issue, "Fix first" / "Export anyway" actions
- **Import validation** — same modal shown after loading a file/sample (mode: OK only)
- **Empty-state placeholder** — right panel shows hint text when tree is empty
- **Resizable panels** — drag the divider between left/right panels; width persisted in `localStorage`

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
| `css/builder.css` | ~485 | Toolbar, node cards, drag/drop zones, action chips, collapsible panels, vis-builder, flash animation, `.panel-color-inp/clear`, `.panel-hint` |
| `css/preview.css` | ~244 | Preview card, lform-item, status icons, AND/OR badges, final result, calc-badge, flash |
| `css/controls.css` | ~106 | `.ctrl-wrap`, `.ctrl-err`, `.ref-*`, `.qty-*`, open-choice, file input, radio, shared-success |
| `css/modals.css` | ~105 | Clear-confirm modal, validate modal, preview placeholder |

**Inline styles remaining** (genuinely dynamic — not convertible):
- `js/builder/node-group.js` / `node-item.js` — `titleTextarea.style.height` (auto-resize)
- `js/app.js` — `leftPanel.style.width` (resizer); `label.style.cssText = _renderStyle` (user CSS)

---

## Known Limitations / TODO

- Multi-condition visibility (`&&`, `||`) not supported in the visual builder — must be typed as JS manually
- `conditionRule` on items is not exported to FHIR (prototype-specific concept, no R4 equivalent)

