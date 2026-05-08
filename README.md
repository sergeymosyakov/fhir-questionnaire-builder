# QuestionaryPrototype — FHIR Questionnaire Logic Builder

A prototype **visual logic builder** for medical prior authorization questionnaires based on [FHIR R4 Questionnaire](https://hl7.org/fhir/R4/questionnaire.html).

Lets you build questionnaire logic visually, test it against patient data, and import/export valid FHIR R4 JSON.

---

## Files

| File | Purpose |
|---|---|
| `index.html` | Entry point — markup and script imports |
| `favicon.svg` | Browser tab icon |
| `start.ps1` | Local dev server shortcut: `npx serve .` |
| `css/styles.css` | All styles and CSS design tokens |
| `js/app.js` | Entry point — wires inputs, buttons, loads example |
| `js/state.js` | Reactive state, data factories, shared utilities |
| `js/eval.js` | Tree evaluation (visibility / condition rules) |
| `js/render-builder.js` | Left panel — builder tree DOM |
| `js/render-preview.js` | Right panel — reactive preview + controls |
| `js/fhir/import.js` | FHIR R4 → internal model |
| `js/fhir/export.js` | Internal model → FHIR R4 |
| `sampledata/example-bariatric.fhir.json` | Built-in example (bariatric surgery pre-authorization) |
| `sampledata/1776102565767-...json` | Real-world questionnaire for testing |

---

## Tech Stack

- **`@vue/reactivity`** (ESM CDN) — only `ref`, `reactive`, `effect`. No Vue components.
- **ES Modules** — `import/export` between files; requires HTTP server
- **Vanilla JS DOM** — left panel (builder) constructed imperatively
- **`effect()`** — rebuilds the right panel (preview) on reactive state changes
- **`new Function()`** — sandboxed rule evaluation (`evalRule`)

---

## Architecture

### Reactive State (FHIR Patient R4)

```js
age, gender, bmi, pregnant, smoker, proc, comorb  // ref() — patient fields
tree        // reactive([]) — questionnaire node tree
values      // plain object — form answers (not reactive; avoids re-render on every keystroke)
_formTick   // ref(0) — incremented on checkbox/select change to re-trigger effect()
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

## FHIR Import / Export

### Import mapping

| FHIR | Internal model |
|---|---|
| `type:'group'` with children | `type:'group'` |
| `type:'group'` with no children | Rendered as informational display text (`[Info]` in builder) |
| `type:'boolean'` | `itemType:'checkbox'` |
| `type:'integer'` / `type:'decimal'` | `itemType:'number'` |
| `type:'choice'` | `itemType:'select'` |
| `type:'string'` / `type:'text'` / etc. | `itemType:'text'` |
| `item.required` | `mandatory` |
| `item.linkId` | `id` (editable in builder) |
| `item.enableWhen` | `visibilityRule` (JS expression) + `_enableWhenText` (human label) |
| `item.enableBehavior:'any'` | `logicWithParent:'OR'` |
| `item.answerOption` | `options` |
| `_text.extension[rendering-style]` | `_renderStyle` (applied as inline CSS in preview) |

Custom extensions (URL prefix `http://logicbuilder.example.org/extension/`):
- `conditionRule` — applicability condition
- `visibilityRule` — complex JS expression (when not convertible to enableWhen)
- `successValue` — expected answer for pass/fail evaluation

### Export

- Simple `visibilityRule` patterns (`values['id'] OP value`) → standard FHIR `enableWhen`
- Complex JS expressions → stored as extension (round-trip safe)
- `conditionRule`, `successValue` → always as extensions

---

## UX Features

- **Bidirectional navigation** — click preview row → scroll+flash builder node (teal); click builder node header → scroll+flash preview row (blue)
- **Collapse groups** — `▼/▶` toggle on each group in the builder; state persists through re-renders
- **Editable linkId** — blue monospace input in the builder node header; directly edits `node.id`
- **Style editor** — `Style` panel on every node: Bold / Italic checkboxes, color picker, raw CSS field. Changes apply live in the preview
- **Auto-scroll on add** — `+ Group`, `+ Item`, `Add Root Group` scroll to and flash the new node; parent group auto-expands
- **Visual condition builder** — in the Visibility panel: pick a question by title to generate JS
- **Auto-fill** — checkboxes with `conditionRule` are pre-filled from patient data (🤖), overridable by the clinician
- **AND/OR badges** — on group headers: `ALL items ✓` / `ANY item ✓`
- **Logic separators** — `— AND —` / `— OR —` between sibling items inside a group
- **Dimmed rows** — conditional items shown grayed out (🔒) when their condition is not met; animate to active when met
- **Informational rows** — `type:'group'` nodes with no children rendered as plain italic text; labeled `[Info]` in builder

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

---

## Known Limitations / TODO

- Multi-condition visibility (`&&`, `||`) not supported in the visual builder — must be written manually as JS
- `conditionRule` on items is not exported to standard FHIR (prototype-specific concept with no direct R4 equivalent)
