# FHIR R4 Mapping Specification

How the internal node model maps to and from FHIR R4 `Questionnaire` JSON.

---

## Internal Node Model

Every node in the tree is either a **group** or an **item**:

```js
// Group
{
  id:                  string,          // FHIR linkId
  type:                'group',
  title:               string,          // FHIR item.text
  mandatory:           true|false|null, // null = not set (omit required from FHIR)
  enableWhen:          object[],        // FHIR enableWhen[] entries
  enableBehavior:      'all'|'any',     // FHIR enableBehavior ('all' = AND, default)
  enableWhenExpression:string,          // SDC enableWhenExpression (FHIRPath)
  constraint:          object[],        // questionnaire-constraint extension entries
  logicWithParent:     'AND'|'OR',      // AND/OR badge for children in preview
  children:            Node[],
  // ── also possible on groups (imported/exported; editable via Props button) ──
  _definition:         string,          // item.definition URL
  _codes:              object[],        // item.code[] coding entries
  _supportLinks:       string[],        // questionnaire-supportLink URIs (0..*)
  _hidden:             true|undefined   // sdc-questionnaire-hidden: never shown to patients; participates in calculatedExpression
}

// Item
{
  id:                  string,
  type:                'item',
  title:               string,
  mandatory:           true|false|null,
  enableWhen:          object[],
  enableBehavior:      'all'|'any',
  enableWhenExpression:string,
  constraint:          object[],
  itemType:            'text'|'integer'|'decimal'|'date'|'dateTime'|'time'|'url'|'attachment'|'checkbox'|'select'|'radio'|'open-choice'|'quantity'|'reference'|'display', // 'number' legacy alias
  options:             string,           // comma-separated, used by select/radio/open-choice
  repeats:             boolean,          // FHIR item.repeats — multi-row input in preview
  _renderStyle:        string,           // inline CSS (from rendering-style extension)
  _renderXhtml:        string,           // raw XHTML markup (from rendering-xhtml extension; sanitized via DOMPurify and rendered as innerHTML in preview)
  _calculatedExpr:     string,           // FHIRPath expression (SDC calculatedExpression)
  _initialExpr:        string,           // FHIRPath expression (SDC initialExpression) — evaluated once on import + Re-init
  _readOnly:           boolean,          // FHIR item.readOnly
  _enableWhenText:     string,           // human-readable condition label (UI only, not persisted)
  _initialValue:       any,              // FHIR item.initial[0] value; pre-fills values[] on import
  _initialValues:      any[],            // FHIR item.initial[] all values (set only for repeating items with >1 initial)
  _initialSelected:    string,           // answerOption[].initialSelected code (round-trip; pre-fills _initialValue when no item.initial)
  _maxLength:          integer,          // FHIR item.maxLength
  _minOccurs:          integer,          // questionnaire-minOccurs extension (when repeats: true)
  _maxOccurs:          integer,          // questionnaire-maxOccurs extension (when repeats: true; enforced in preview)
  _answerValueSet:     string,           // FHIR item.answerValueSet URL — preserved round-trip; not resolved to options
  _minValue:           number,           // questionnaire-minValue extension value (decimal or integer)
  _maxValue:           number,           // questionnaire-maxValue extension value (decimal or integer)
  _optionOrdinals:     object,           // map of option code → ordinalValue (from ordinalValue extension on answerOption.extension or valueCoding.extension fallback)
  _sliderStep:         number,           // questionnaire-sliderStepValue ext; when set, integer/decimal renders as <input type="range"> slider
  _disabledDisplay:    string,           // 'hidden'|'protected' — behaviour when enableWhen condition is not met; 'protected' is default (not persisted)
  _supportLinks:       string[],         // questionnaire-supportLink URIs (0..*); 🔗 icons in builder preview; "More info ↗" buttons in patient view
  _hidden:             true|undefined    // sdc-questionnaire-hidden: never shown to patients; participates in calculatedExpression; controls disabled in preview
}
```

---

## Questionnaire-Level Metadata

Stored in `questMeta` (reactive object in `js/state.js`). Populated on import, written back on export, editable via the Properties modal. Reset to defaults when the questionnaire is cleared.

| Field | FHIR field | Import | Export |
|---|---|---|---|
| `questMeta.id` | `Questionnaire.id` | ← `id` | → `id` (fallback: `'logic-builder-export'`) |
| `questMeta.url` | `Questionnaire.url` | ← `url` | → `url` (omitted when empty) |
| `questMeta.version` | `Questionnaire.version` | ← `version` | → `version` (omitted when empty) |
| `questMeta.name` | `Questionnaire.name` | ← `name` | → `name` (omitted when empty) |
| `questMeta.title` | `Questionnaire.title` | ← `title` | → `title` (takes precedence over rawFhir.title; fallback: `'Untitled Questionnaire'`) |
| `questMeta.status` | `Questionnaire.status` | ← `status` (default: `'draft'`) | → `status` |
| `questMeta.date` | `Questionnaire.date` | ← `date` | → `date` (preserved from import; falls back to today's ISO date for new questionnaires) |
| `questMeta.publisher` | `Questionnaire.publisher` | ← `publisher` | → `publisher` (omitted when empty) |
| `questMeta.description` | `Questionnaire.description` | ← `description` | → `description` (omitted when empty) |
| `questMeta.purpose` | `Questionnaire.purpose` | ← `purpose` | → `purpose` (omitted when empty) |
| `questMeta.copyright` | `Questionnaire.copyright` | ← `copyright` | → `copyright` (omitted when empty) |
| `questMeta.approvalDate` | `Questionnaire.approvalDate` | ← `approvalDate` | → `approvalDate` (omitted when empty) |
| `questMeta.lastReviewDate` | `Questionnaire.lastReviewDate` | ← `lastReviewDate` | → `lastReviewDate` (omitted when empty) |
| `questMeta.subjectType` | `Questionnaire.subjectType` | ← `subjectType[]` joined as comma-separated string (default: `'Patient'`) | → split back to array (default: `['Patient']`) |
| `questMeta.effectivePeriodStart` | `Questionnaire.effectivePeriod.start` | ← `effectivePeriod?.start` (default: `''`) | → `effectivePeriod.start` (omitted when empty) |
| `questMeta.effectivePeriodEnd` | `Questionnaire.effectivePeriod.end` | ← `effectivePeriod?.end` (default: `''`) | → `effectivePeriod.end` (omitted when empty) |
| `questMeta.experimental` | `Questionnaire.experimental` | ← `experimental` (default: `null`) | → `experimental` (omitted when `null`) |
| `questMeta.language` | `Questionnaire.language` | ← `language` (default: `''`) | → `language` (omitted when empty) |
| `questMeta._rawIdentifier` | `Questionnaire.identifier[]` | ← stored as Identifier[] (default: `[]`) | → written back unchanged; editable via **Identifiers** collapsible section in Properties modal (use/system/value rows; badge shows count) |
| `questMeta._rawContact` | `Questionnaire.contact[]` | ← stored as-is (pass-through) | → written back unchanged (omitted when null) |
| `questMeta._rawUseContext` | `Questionnaire.useContext[]` | ← stored as-is (pass-through) | → written back unchanged (omitted when null) |
| `questMeta._rawJurisdiction` | `Questionnaire.jurisdiction[]` | ← stored as-is (pass-through) | → written back unchanged (omitted when null) |
| `questMeta._rawCode` | `Questionnaire.code[]` | ← stored as array (default: `null`) | → written back unchanged; editable via **Codes** section in Properties modal (system/code/display rows; draft pattern; badge shows count) |
| `questMeta.derivedFrom` | `Questionnaire.derivedFrom[]` | ← stored as string array (default: `[]`) | → written back as array; editable via **Derived From** collapsible section in Properties modal; round-trip safe |
| `questMeta._metaVersionId` | `Questionnaire.meta.versionId` | ← `meta.versionId` (default: `''`) | → written back when set; editable in Properties modal — **Resource Meta** section; **Generate** button creates a fresh UUID v4 |
| `questMeta._metaSource` | `Questionnaire.meta.source` | ← `meta.source` (default: `''`) | → written back when set; editable URI input in Properties modal — Resource Meta section |
| `questMeta._metaLastUpdated` | `Questionnaire.meta.lastUpdated` | ← `meta.lastUpdated` displayed read-only in Properties modal | → **always** replaced with `new Date().toISOString()` on every export |
| `questMeta._rawMetaProfile` | `Questionnaire.meta.profile[]` | ← stored as string array (default: `[]`) | → written back as array; editable list of canonical URLs in Properties modal — Resource Meta section |
| `questMeta._rawMetaTag` | `Questionnaire.meta.tag[]` | ← stored as Coding[] (default: `[]`) | → written back unchanged; editable system/code/display rows in Properties modal — Resource Meta section |
| `questMeta._rawMetaSecurity` | `Questionnaire.meta.security[]` | ← stored as Coding[] (default: `[]`) | → written back unchanged; editable system/code/display rows in Properties modal — Resource Meta section |
| `questMeta._rawText` | `Questionnaire.text` | ← stored as Narrative `{ status, div }` (default: `null`) | → written back unchanged; round-trip preservation only — no editing UI |

> **`Questionnaire.meta` is fully covered.** All six sub-fields (`versionId`, `source`, `lastUpdated`, `profile[]`, `tag[]`, `security[]`) are imported, editable in the **Resource Meta** collapsible section of the Properties modal, and written back on export. `meta.lastUpdated` is always refreshed to the current time on export.

---

## Item Type Mapping

### Import: `item.type` → `itemType`

| FHIR `item.type` | `itemType` | Notes |
|---|---|---|
| `boolean` | `checkbox` | Tristate UX: indeterminate = unanswered, checked = `true`, unchecked = `false`; for `required` items only `undefined` fails validation |
| `integer` | `integer` | Stored as `valueInteger` in QR; use `.answer.valueInteger` in FHIRPath constraints |
| `decimal` | `decimal` | Stored as `valueDecimal` in QR; use `.answer.valueDecimal` in FHIRPath constraints |
| `quantity` | `quantity` | UCUM unit dropdown; `questionnaire-unit` extension read/written |
| `string`, `text` | `text` | |
| `reference` | `reference` | dropdown (resource type) + id input; `questionnaire-referenceResource` extension locks dropdown to one type |
| `choice` | `select` | unless `questionnaire-itemControl: radio-button` → `radio` |
| `choice` + itemControl `radio-button` | `radio` | see Extensions section |
| `open-choice` | `open-choice` | text input + `<datalist>` suggestions from `answerOption[]`; free-text allowed |
| `display` | `display` | label only, no control, no pass/fail |
| `date` | `date` | |
| `dateTime` | `dateTime` | Stored as `YYYY-MM-DDTHH:MM:SS`; QR → `valueDateTime` |
| `time` | `time` | Stored as `HH:MM:SS`; QR → `valueTime` |
| `url` | `url` | format validated with `new URL()` |
| `attachment` | `attachment` | file input, stores `{name, size, type}` |
| `group` | `group` (node.type) | |

### Export: `itemType` → `item.type`

| `itemType` | FHIR `item.type` | Extra |
|---|---|---|
| `checkbox` | `boolean` | |
| `integer` | `integer` | round-trip safe; QR stores as `valueInteger` |
| `decimal` | `decimal` | round-trip safe; QR stores as `valueDecimal` |
| `number` | `decimal` | legacy alias — kept for backward compatibility with saved questionnaires |
| `text` | `string` | |
| `select` | `choice` | + `answerOption[]` |
| `radio` | `choice` | + `answerOption[]` + `questionnaire-itemControl: radio-button` extension |
| `open-choice` | `open-choice` | + `answerOption[]` (used as datalist suggestions) |
| `quantity` | `quantity` | + `questionnaire-unit` extension (default unit from builder) |
| `reference` | `reference` | + `questionnaire-referenceResource` extension (if type is locked) |
| `display` | `display` | |
| `date` | `date` | |
| `dateTime` | `dateTime` | |
| `time` | `time` | |
| `url` | `url` | |
| `attachment` | `attachment` | |

---

## Field Mapping

### Common fields (group and item)

| Internal field | FHIR field | Import | Export |
|---|---|---|---|
| `id` | `item.linkId` | ← `linkId` | → `linkId` |
| `title` | `item.text` | ← `text` | → `text` |
| `mandatory: true` | `item.required: true` | ← `required` | → `required: true` |
| `mandatory: false` | `item.required: false` | ← `required` | → `required: false` |
| `mandatory: null` | *(omitted)* | `required` absent → `null` | not written |

### Group-specific

| Internal field | FHIR field | Notes |
|---|---|---|
| `enableWhen[]` | `item.enableWhen[]` | shallow-copied on export; re-parsed on import |
| `enableBehavior: 'any'` | `item.enableBehavior: 'any'` | only written when `'any'`; default `'all'` is omitted |
| `enableWhenExpression` | SDC `sdc-questionnaire-enableWhenExpression` ext | FHIRPath string; omitted if empty |
| `constraint[]` | `questionnaire-constraint` ext entries | round-trip safe |
| `logicWithParent: 'OR'` | AND/OR preview badge | Exported as `questionnaire-constraint` (key `ITLH_NS:group-or`) with FHIRPath over child linkIds; restored on import |
| `logicWithParent: 'AND'` | *(default)* | No constraint generated; restored as default on import |
| `children` | `item.item[]` | recursive |
| `_definition` | `item.definition` | URL pointing to a StructureDefinition element; round-trip safe; editable via **Props** button |
| `_codes` | `item.code[]` | coding entries (system / code / display); round-trip safe; editable via **Props** button |
| `_supportLinks` | `questionnaire-supportLink` ext (0..*) | help / documentation URIs; rendered as 🔗 icons in builder preview and "More info ↗" buttons in patient view; editable via **Props** button |
| `_hidden` | `sdc-questionnaire-hidden` ext (`valueBoolean: true`) | item/group permanently hidden from patients; still participates in `calculatedExpression`; rendered with purple dashed border + **HIDDEN badge** in builder preview when **hidden** toggle is on; excluded from PASS/FAIL validation; controls disabled in preview; toggled via **Hidden** action button in builder |

### Item-specific

| Internal field | FHIR field / extension | Notes |
|---|---|---|
| `options` | `item.answerOption[]` | comma-split → `valueCoding.{code, display}` on export; reverse on import |
| `_renderStyle` | `item._text.extension[rendering-style]` | standard FHIR `rendering-style` extension |
| `_renderXhtml` | `item._text.extension[rendering-xhtml]` | raw XHTML markup; sanitized via DOMPurify + rendered as `innerHTML` in preview; editable in Appearance modal |
| `_calculatedExpr` | SDC `sdc-questionnaire-calculatedExpression` extension (`valueExpression.expression`) | FHIRPath |
| `_initialExpr` | SDC `sdc-questionnaire-initialExpression` extension (`valueExpression.expression`) | FHIRPath; evaluated once on import and on Re-init; result pre-fills `values[]` |
| `_readOnly` | `item.readOnly` | |
| `_prefix` | `item.prefix` | imported and exported; displayed as amber badge in preview; editable in builder meta-row |
| `_codes` | `item.code[]` | imported and exported unchanged (round-trip safe); editable via **Props** button (codes-modal — system/code/display rows, draft pattern); also supported on groups (see Group-specific) |
| `_maxLength` | `item.maxLength` | imported → `node._maxLength`; exported back when set; character counter + `maxlength` attribute enforced in preview |
| `_minValue` | `questionnaire-minValue` ext (`valueDecimal` or `valueInteger`) | imported/exported for `integer`/`decimal` items; min HTML attribute set on input; error shown in preview when violated |
| `_maxValue` | `questionnaire-maxValue` ext (`valueDecimal` or `valueInteger`) | imported/exported for `integer`/`decimal` items; max HTML attribute set on input; error shown in preview when violated |
| `_optionOrdinals` | `ordinalValue` ext on `answerOption[].extension` (primary) or `valueCoding.extension` (fallback) | map of option code → numeric score; shown as `(N)` badge in radio/select; editable in Answer Type modal (`code=Label=score` format); exported to `answerOption.extension` |
| `_sliderStep` | `questionnaire-sliderStepValue` ext (`valueDecimal` or `valueInteger`) | imported/exported for `integer`/`decimal` items; renders item as `<input type="range">` slider in preview; editable in Answer Type modal |
| `_disabledDisplay` | `item.disabledDisplay` (R4B native field) + R4 backport extension `extension-Questionnaire.item.disabledDisplay` | `'hidden'` → item removed from DOM when not visible; `'protected'` (default) → grayed row; editable in Show When modal |
| `_minOccurs` | `questionnaire-minOccurs` ext (`valueInteger`) | imported/exported when `node.repeats === true` |
| `_maxOccurs` | `questionnaire-maxOccurs` ext (`valueInteger`) | imported/exported when `node.repeats === true`; enforced in preview — add button disabled at limit |
| `_answerValueSet` | `item.answerValueSet` | imported → `node._answerValueSet`; exported back unchanged; URL not resolved — items show no selectable options in the builder |
| `_initialValue` | `item.initial[0]` value | imported from `initial[0]`; exported as `initial: [entry]`; pre-fills `values[]` on import |
| `_initialValues` | `item.initial[]` all values | set only for repeating items with >1 initial value; exported as `initial: [entry, …]`; `_initialValue` holds `initial[0]` for backwards compat |
| `_initialSelected` | `answerOption[].initialSelected` | code of the initially-selected option; preserved round-trip; if no `item.initial[]` exists, also used to pre-fill `_initialValue` |
| `_definition` | `item.definition` | URL pointing to a StructureDefinition element; stored as `node._definition`; editable via **Props** button (codes-modal); round-trip safe; also supported on groups (see Group-specific) |
---

## Show When (enableWhen)

Controls whether the item/group is **visible** in the preview.

The builder stores standard FHIR `enableWhen[]` objects directly on the node. The visual panel ("Show When") edits them in-place.

### Import

1. Standard `item.enableWhen[]` → `node.enableWhen[]` (copied as-is)
2. `item.enableBehavior` → `node.enableBehavior` (`'all'` | `'any'`; default `'all'`)
3. SDC `sdc-questionnaire-enableWhenExpression` extension → `node.enableWhenExpression` (FHIRPath string)
4. `enableWhen` also generates `_enableWhenText` (human-readable label, e.g. `«Q» = Yes AND «Q2» = No`)

### Export

- `node.enableWhen[]` → `item.enableWhen[]` (shallow copy)
- `node.enableBehavior === 'any'` → `item.enableBehavior: 'any'` (omitted otherwise)
- `node.enableWhenExpression` → SDC `sdc-questionnaire-enableWhenExpression` extension

### Evaluation

- `node.enableBehavior === 'all'` (default): **all** conditions must be met (AND)
- `node.enableBehavior === 'any'`: **any** condition is sufficient (OR)
- `enableWhenExpression`: evaluated via FHIRPath if present (takes precedence over `enableWhen[]`)
- Answer type coercion: all comparisons use `String()` normalization for consistent boolean/string matching

---

## Extensions Summary

| Extension URL | Type | Field | Standard? |
|---|---|---|---|
| `http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl` | standard | `itemType: 'radio'` | Yes |
| `http://hl7.org/fhir/StructureDefinition/rendering-style` | standard | `_renderStyle` | Yes |
| `http://hl7.org/fhir/StructureDefinition/rendering-xhtml` | standard | `_renderXhtml` | Yes |
| `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-calculatedExpression` | SDC | `_calculatedExpr` | Yes (SDC) |
| `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-initialExpression` | SDC | `_initialExpr` | Yes (SDC) |
| `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-variable` | SDC | `questVariables[]` on root | Yes (SDC) |
| `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-enableWhenExpression` | SDC | `enableWhenExpression` | Yes (SDC) |
| `http://hl7.org/fhir/StructureDefinition/questionnaire-constraint` | standard | `constraint[]` | Yes |
| `http://hl7.org/fhir/StructureDefinition/questionnaire-unit` | standard | `quantityUnit` (quantity default unit) | Yes |
| `http://hl7.org/fhir/StructureDefinition/questionnaire-referenceResource` | standard | `referenceResource` (reference type lock) | Yes |
| `http://hl7.org/fhir/StructureDefinition/questionnaire-minOccurs` | standard | `_minOccurs` (min repeat rows required) | Yes |
| `http://hl7.org/fhir/StructureDefinition/questionnaire-maxOccurs` | standard | `_maxOccurs` (max repeat rows; enforced in preview) | Yes |
| `http://hl7.org/fhir/StructureDefinition/minValue` | standard | `_minValue` (minimum value for numeric inputs; enforced in preview) | Yes |
| `http://hl7.org/fhir/StructureDefinition/maxValue` | standard | `_maxValue` (maximum value for numeric inputs; enforced in preview) | Yes |
| `http://hl7.org/fhir/StructureDefinition/ordinalValue` | standard | `_optionOrdinals[code]` (score per answer option; on `answerOption.extension`; displayed in preview; editable in builder) | Yes |
| `http://hl7.org/fhir/StructureDefinition/questionnaire-sliderStepValue` | standard | `_sliderStep` (step for range slider; triggers slider rendering) | Yes |
| `http://hl7.org/fhir/5.0/StructureDefinition/extension-Questionnaire.item.disabledDisplay` | R4 backport | `_disabledDisplay` (hidden/protected; also read from native `item.disabledDisplay` field) | Yes (R4B/R5 backport) |
| `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-entryFormat` | SDC | `_entryFormat` (placeholder hint text shown on text/url/number/quantity controls; editable in Answer Type modal) | Yes |
| `http://hl7.org/fhir/StructureDefinition/questionnaire-choiceOrientation` | standard | `_choiceOrientation` (`vertical` / `horizontal`; controls layout of radio button groups; editable in Answer Type modal for `radio` items) | Yes |
| `http://hl7.org/fhir/StructureDefinition/questionnaire-displayCategory` | standard | `_displayCategory` (`instructions` / `security` / `help`; applies visual category styling to `display` items in preview; editable in Answer Type modal) | Yes |
| `http://hl7.org/fhir/StructureDefinition/questionnaire-supportLink` | standard | `_supportLinks` (0..* help/documentation URIs per item or group; 🔗 icons in builder; "More info ↗" in patient view; editable via **Props** button) | Yes |
| `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-hidden` | SDC | `_hidden` (item/group hidden from patients; purple dashed border + HIDDEN badge in builder preview; excluded from PASS/FAIL; controls disabled; **Hidden** toggle button in builder actions) | Yes (SDC) |

---

## Round-Trip Safety

All standard FHIR fields are preserved on export and correctly re-read on the next import.

Internal UI fields that are not written to FHIR JSON but are fully restored on import:

| Field | Why it is not in FHIR JSON |
|---|---|
| `logicWithParent` | `'OR'` exported as a namespaced `questionnaire-constraint` (key `e3a8c2f1-6b4d-4e9a-87c5:group-or`); round-trip safe |

Additional round-trip fields (stored opaquely; not editable in the builder):

| Field | FHIR field | Notes |
|---|---|---|
| `_answerValueSet` | `item.answerValueSet` | URL preserved; not resolved to answer options |
| `questContained[]` | `Questionnaire.contained[]` | Resources deep-copied on export; not otherwise processed |

### QR answer encoding

For `choice`/`open-choice` items the exported `QuestionnaireResponse.item.answer[].valueCoding` is enriched from `answerOption`:
- `system` and `display` copied from the matching `answerOption.valueCoding`
- `ordinalValue` extension (`http://hl7.org/fhir/StructureDefinition/ordinalValue`) added when present on `answerOption.extension` (primary) or `answerOption.valueCoding.extension` (fallback)

This allows scoring questionnaires (e.g. PHQ-9) to produce a fully scored QR with `ordinalValue` on every answer without any post-processing.

---

## QuestionnaireResponse

| QR field | Import | Export | Notes |
|---|---|---|---|
| `status` | ← preserved in `qrMeta.status` | → written; editable in QR Export modal | Default: `'in-progress'` |
| `subject` | ← `subject.reference` in `qrMeta.subject` | → `subject.reference` when non-empty | Optional; editable in QR Export modal |
| `author` | ← `author.reference` in `qrMeta.author` | → `author.reference` when non-empty | Optional; editable in QR Export modal |
| `authored` | not stored | → `new Date().toISOString()` | Always set to current time on export |

`qrMeta` is reset to defaults when a new questionnaire is imported. When a QR is loaded via the Answers menu, `qrMeta` is updated from the loaded response and pre-populates the QR Export modal.

**Minor gaps:** `id` is not preserved on import (generated fresh on export). `implicitRules`, `language`, and `meta` are not preserved — pass-through not implemented for QR-level meta.

---

## Not Supported / Partial Support

Legend: ⚠️ = silent data loss (field present in import file, ignored or overwritten on export); ❌ = not handled at all; 🔧 = partial support.

### Questionnaire root-level — silent data loss on export

These fields are present in the FHIR spec at the `Questionnaire` root level but are not stored on import and are therefore not written back on export.

| FHIR field | Status | Notes |
|---|---|---|
| `Questionnaire.implicitRules` | ⚠️ Silently dropped | Declares the rules set that constrains how the resource is used. Rare in practice. |
| `Questionnaire.implicitRules` | ⚠️ Silently dropped | Declares the rules set that constrains how the resource is used. Rare in practice. |
| Unknown item extensions | ⚠️ Silently dropped | Any `item.extension[]` entry whose URL is not explicitly handled by the builder is discarded on import and will not appear in the exported JSON. |

### Item-level — not implemented

| FHIR field / extension | Status | Notes |
|---|---|---|
| `answerConstraint` | ❌ Not handled | R4B/R5 field (`optionsOnly` / `optionsOrType` / `optionsOrString`) |
| `item.answerValueSet` — external URL | 🔧 URL preserved round-trip | Not resolved to answer options; no FHIR terminology server integration. `#id` contained refs ARE resolved (see Round-Trip Safety) |
| `Questionnaire.contained[]` | 🔧 Preserved round-trip | Viewable as JSON in the Contained card; not otherwise editable |
| Resource reference resolution | 🔧 Partial | `type: 'reference'`: resource-type dropdown + id text input; no live FHIR server search |
| `minLength` | ❌ Not handled | Minimum allowed response length for `string` / `text` / `url` items. Counterpart to `maxLength` which is fully supported. |
| `maxDecimalPlaces` | ❌ Not handled | Maximum number of decimal places for `decimal` items (`http://hl7.org/fhir/StructureDefinition/maxDecimalPlaces`). |
| `regex` | ❌ Not handled | Regular expression validation pattern for `string` / `text` / `url` items (`http://hl7.org/fhir/StructureDefinition/regex`). |
| `mimeType` | ❌ Not handled | One or more allowed MIME types for `attachment` items (`http://hl7.org/fhir/StructureDefinition/mimeType`). Multiple values permitted. |
| `maxSize` | ❌ Not handled | Maximum file size in MB for `attachment` items (`http://hl7.org/fhir/StructureDefinition/maxSize`). |
| `questionnaire-optionPrefix` | ❌ Not handled | Display prefix for each `answerOption` (e.g. `"A."`, `"1."`). Commonly used in clinical forms with lettered or numbered options. Silently dropped on import. |
| `questionnaire-unitValueSet` | ❌ Not handled | ValueSet of selectable units for `quantity` items (alternative to `questionnaire-unitOption` / `sdc-questionnaire-unitOption`). |
| `questionnaire-usageMode` | ❌ Not handled | Controls when the item is relevant: `capture` / `display` / `display-non-empty` / `capture-display` / `capture-display-non-empty`. |
| `questionnaire-referenceFilter` | ❌ Not handled | FHIRPath expression used to filter valid reference targets for `reference` items. |
| `questionnaire-referenceProfile` | ❌ Not handled | Profile URL that restricts valid resource types for `reference` items (complementary to `questionnaire-referenceResource` which is supported). |
| `questionnaire-signatureRequired` | ❌ Not handled | Indicates that a digital signature is required for the item or group. |
| `questionnaire-baseType` / `questionnaire-fhirType` | ❌ Not handled | Base FHIR type for items derived from `ElementDefinition` (used with `item.definition`). |
| `designNote` | ❌ Not handled | Author-facing design note text; not intended to be displayed to end users. Silently dropped. |

### Extension URL aliasing — silent data loss on import

Some capabilities exist as both a **standard R4 extension** and a separate **SDC extension**, each with a different URL. The builder reads only one variant; questionnaires using the other URL are silently not handled.

| Capability | URL the builder reads | URL that is NOT read | Impact |
|---|---|---|---|
| Hidden item | `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-hidden` (SDC) | `http://hl7.org/fhir/StructureDefinition/questionnaire-hidden` (R4 standard) | ⚠️ Items marked hidden via the R4 standard extension will NOT receive `_hidden = true` on import |
| Entry format hint | `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-entryFormat` (SDC) | `http://hl7.org/fhir/StructureDefinition/entryFormat` (R4 element-definition ext) | ⚠️ Placeholder hints set via the standard R4 `entryFormat` ext will NOT be imported |

### SDC extensions — not implemented (no server required)

| Extension | Status | Notes |
|---|---|---|
| `sdc-questionnaire-answerExpression` | ❌ | Dynamic answer options derived from FHIRPath over form values (no server needed) |
| `sdc-questionnaire-itemWeight` | ❌ | Per-option weight for scoring (analogous to `ordinalValue` at item level) |
| `sdc-questionnaire-unitOption[]` | ❌ | Multiple selectable units for `quantity` items |
| `sdc-questionnaire-shortText` | ❌ | Abbreviated label for summary views |
| `sdc-questionnaire-collapsible` | ❌ | Group renders collapsed by default (`default-closed`) or expanded (`default-open`). Currently all groups start expanded. |
| `sdc-questionnaire-openLabel` | ❌ | Custom label for the free-text "other" option in `open-choice` items (default: "Other"). |

### SDC extensions — population and extraction (out of scope)

These SDC extensions support advanced form pre-population from clinical data and extraction of completed answers into FHIR resources. They require a FHIR server and/or StructureMap tooling and are out of scope for this builder.

| Extension | Notes |
|---|---|
| `sdc-questionnaire-launchContext` | Declares named contexts (patient, encounter, user, etc.) passed at launch time; enables server-side pre-population |
| `sdc-questionnaire-itemContext` | FHIRPath expression that defines the FHIR context node for population and extraction of a specific item |
| `sdc-questionnaire-sourceQueries` / `sdc-questionnaire-contextExpression` | Batch FHIR queries to populate form data from a server at launch |
| `sdc-questionnaire-observationExtract` | Extracts completed answers as FHIR `Observation` resources on QR submission |
| `sdc-questionnaire-definitionExtract` | Extracts completed answers into specified FHIR resource element paths |
| `sdc-questionnaire-targetStructureMap` | StructureMap used to transform a completed QR into other FHIR resources |
| `sdc-questionnaire-sourceStructureMap` | StructureMap used to pre-populate the questionnaire from existing FHIR data |
| `sdc-questionnaire-columnCount` / `sdc-questionnaire-width` | Grid layout: number of columns in a group and per-item width for multi-column display |

### FHIR versions

| Version | Status |
|---|---|
| R4 | ✅ Fully supported |
| R4B / R5 | 🔧 Partial — most fields overlap; `answerConstraint` and `disabledDisplay` are R4B/R5 native (R4 backport extension handled for `disabledDisplay`) |
| STU3 | ❌ Not tested; may partially import |
