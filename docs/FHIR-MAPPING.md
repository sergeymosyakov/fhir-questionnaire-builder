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
  _renderMarkdown:     string,           // Markdown text (from rendering-markdown extension; parsed by marked.js + sanitized via DOMPurify; rendering-xhtml takes priority)
  _calculatedExpr:     string,           // FHIRPath expression (SDC calculatedExpression)
  _initialExpr:        string,           // FHIRPath expression (SDC initialExpression) — evaluated once on import + Re-init
  _readOnly:           boolean,          // FHIR item.readOnly
  _enableWhenText:     string,           // human-readable condition label (UI only, not persisted)
  _initialValue:       any,              // FHIR item.initial[0] value; pre-fills values[] on import
  _initialValues:      any[],            // FHIR item.initial[] all values (set only for repeating items with >1 initial)
  _initialSelected:    string,           // answerOption[].initialSelected code (round-trip; pre-fills _initialValue when no item.initial)
  _maxLength:          integer,          // FHIR item.maxLength
  _minLength:          integer,          // SDC ext http://hl7.org/fhir/StructureDefinition/minLength
  _maxFileSizeMB:      number,           // http://hl7.org/fhir/StructureDefinition/maxSize — max file size in MB for attachment items
  _mimeTypes:          string[],         // http://hl7.org/fhir/StructureDefinition/mimeType — 0..* allowed MIME types for attachment items
  _minOccurs:          integer,          // questionnaire-minOccurs extension (when repeats: true)
  _maxOccurs:          integer,          // questionnaire-maxOccurs extension (when repeats: true; enforced in preview)
  _answerValueSet:     string,           // FHIR item.answerValueSet URL — preserved round-trip; external URLs expanded via terminologyService on load
  _answerExpression:   string,           // SDC sdc-questionnaire-answerExpression — FHIRPath expression evaluated at render time; result replaces answerOption[] in preview
  _minValue:           number,           // questionnaire-minValue extension value (decimal or integer)
  _maxValue:           number,           // questionnaire-maxValue extension value (decimal or integer)
  _optionOrdinals:     object,           // map of option code → ordinalValue (from ordinalValue extension on answerOption.extension or valueCoding.extension fallback)
  _optionPrefixes:     object,           // map of option code → display prefix string (from questionnaire-optionPrefix extension on answerOption.extension)
  _sliderStep:         number,           // questionnaire-sliderStepValue ext; when set, integer/decimal renders as <input type="range"> slider
  _disabledDisplay:    string,           // 'hidden'|'protected' — behaviour when enableWhen condition is not met; 'protected' is default (not persisted)
  _supportLinks:       string[],         // questionnaire-supportLink URIs (0..*); 🔗 icons in builder preview; "More info ↗" buttons in patient view
  _hidden:             true|undefined,   // sdc-questionnaire-hidden: never shown to patients; participates in calculatedExpression; controls disabled in preview
  _usageMode:          string,           // questionnaire-usageMode: 'capture'|'display'|'display-non-empty'|'capture-display'|'capture-display-non-empty' — controls item visibility per mode
  _itemMedia:          object,           // sdc-questionnaire-itemMedia valueAttachment: { url, contentType, title? } — media inline before the control
  _optionWeights:      object,           // map of option code → weight (from itemWeight extension on answerOption)
  _answerMedias:       object,           // map of option code → Attachment (from sdc-questionnaire-answerMedia extension on answerOption)
}
```

---

## Questionnaire-Level Metadata

Stored in `questMeta` (plain object in `js/state.js`). Populated on import, written back on export, editable via the Properties modal. Reset to defaults when the questionnaire is cleared.

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
| `questMeta._rawContact` | `Questionnaire.contact[]` | ← stored as ContactDetail[] | → written back; editable via **Contact** collapsible section in Properties modal — name text input + telecom rows (system select + value); badge shows count; null when empty |
| `questMeta._rawUseContext` | `Questionnaire.useContext[]` | ← stored as-is (pass-through) | → written back unchanged (omitted when null); **no editing UI** — structure too variable for a generic editor |
| `questMeta._rawJurisdiction` | `Questionnaire.jurisdiction[]` | ← stored as CodeableConcept[]; first coding per entry surfaced for editing | → each entry reconstructed as `{ coding: [{ system, code, display }] }`; editable via **Jurisdiction** collapsible section in Properties modal (system/code/display rows); ⚠ extra codings and `text` field within each CodeableConcept are not preserved on save; null when empty |
| `questMeta._rawCode` | `Questionnaire.code[]` | ← stored as Coding[] (default: `null`) | → written back; editable via **Codes** collapsible section in Properties modal (system/code/display rows; badge shows count); null when empty |
| `questMeta.derivedFrom` | `Questionnaire.derivedFrom[]` | ← stored as string array (default: `[]`) | → written back as array; editable via **Derived From** collapsible section in Properties modal; round-trip safe |
| `questMeta.replaces` | `extension[].valueCanonical` where `url = …/replaces` | ← one entry per extension occurrence (default: `[]`) | → each URL written as a separate `replaces` extension entry (`http://hl7.org/fhir/StructureDefinition/replaces`); editable via **Replaces** collapsible section in Properties modal; round-trip safe |
| `questMeta.replaces` | `extension[].valueCanonical` where `url = http://hl7.org/fhir/StructureDefinition/replaces` | ← one entry per extension occurrence (default: `[]`) | → each URL written as a separate `replaces` extension entry; editable via **Replaces** collapsible section in Properties modal; round-trip safe |
| `questMeta._metaVersionId` | `Questionnaire.meta.versionId` | ← `meta.versionId` (default: `''`) | → written back when set; editable in Properties modal — **Resource Meta** section; **Generate** button creates a fresh UUID v4 |
| `questMeta._implicitRules` | `Questionnaire.implicitRules` | ← `implicitRules` (default: `''`) | → written back when set; editable URI input in Properties modal — Resource Meta section |
| `questMeta._metaSource` | `Questionnaire.meta.source` | ← `meta.source` (default: `''`) | → written back when set; editable URI input in Properties modal — Resource Meta section |
| `questMeta._metaLastUpdated` | `Questionnaire.meta.lastUpdated` | ← `meta.lastUpdated` displayed read-only in Properties modal | → **always** replaced with `new Date().toISOString()` on every export |
| `questMeta._rawMetaProfile` | `Questionnaire.meta.profile[]` | ← stored as string array (default: `[]`) | → written back as array; editable list of canonical URLs in Properties modal — Resource Meta section |
| `questMeta._rawMetaTag` | `Questionnaire.meta.tag[]` | ← stored as Coding[] (default: `[]`) | → written back unchanged; editable system/code/display rows in Properties modal — Resource Meta section |
| `questMeta._rawMetaSecurity` | `Questionnaire.meta.security[]` | ← stored as Coding[] (default: `[]`) | → written back unchanged; editable system/code/display rows in Properties modal — Resource Meta section |
| `questMeta._rawText` | `Questionnaire.text` | ← stored as Narrative `{ status, div }` when present (default: `null`) | → if preserved: written back unchanged; if null: auto-generated from title/status/items (`status: "generated"`, XHTML div via `generateNarrativeDiv()`) — always present in export; shown **read-only** in the Advanced section of Properties modal (status + raw div); **no editing UI** |

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
| `choice` | `select` | unless `questionnaire-itemControl: radio-button` → `radio` or `check-box` → `checklist` |
| `choice` + itemControl `radio-button` | `radio` | see Extensions section |
| `choice` + itemControl `check-box` | `checklist` | multi-select checkboxes; see Extensions section |
| `choice` + itemControl `autocomplete` | `select` + `_itemControl:'autocomplete'` | searchable dropdown; see Extensions section |
| `choice` + itemControl `drop-down` | `select` + `_itemControl:'drop-down'` | explicit dropdown (default) |
| `string` + itemControl `text-area` | `text` + `_itemControl:'text-area'` | multi-line textarea |
| `string` + itemControl `text-box` | `text` + `_itemControl:'text-box'` | explicit single-line (default) |
| `integer` + itemControl `spinner` | `integer` + `_itemControl:'spinner'` | spinner control hint |
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
| `checklist` | `choice` | + `answerOption[]` + `questionnaire-itemControl: check-box` extension + `repeats: true` |
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
| `enableBehavior` | `item.enableBehavior` | written when `enableWhen.length > 1` (que-12 required) **or** when explicitly set to `'any'`; value is `'any'` or `'all'`; default `'all'` is omitted when only one `enableWhen` condition exists |
| `enableWhenExpression` | SDC `sdc-questionnaire-enableWhenExpression` ext | FHIRPath string; omitted if empty |
| `constraint[]` | `questionnaire-constraint` ext entries | round-trip safe |
| `logicWithParent: 'OR'` | AND/OR preview badge | Exported as `questionnaire-constraint` (key `ITLH_NS:group-or`) with FHIRPath over child linkIds; restored on import |
| `logicWithParent: 'AND'` | *(default)* | No constraint generated; restored as default on import |
| `children` | `item.item[]` | recursive |
| `_definition` | `item.definition` | URL pointing to a StructureDefinition element; round-trip safe; editable via **Props** button |
| `_codes` | `item.code[]` | coding entries (system / code / display); round-trip safe; editable via **Props** button |
| `_supportLinks` | `questionnaire-supportLink` ext (0..*) | help / documentation URIs; rendered as 🔗 icons in builder preview and "More info ↗" buttons in patient view; editable via **Props** button |
| `_hidden` | `sdc-questionnaire-hidden` ext (`valueBoolean: true`) | item/group permanently hidden from patients; still participates in `calculatedExpression`; rendered with purple dashed border + **HIDDEN badge** in builder preview when **hidden** toggle is on; excluded from PASS/FAIL validation; controls disabled in preview; toggled via **Hidden** action button in builder; **on import also reads** `http://hl7.org/fhir/StructureDefinition/questionnaire-hidden` (R4 standard alias) | Yes |

### Item-specific

| Internal field | FHIR field / extension | Notes |
|---|---|---|
| `options` | `item.answerOption[]` | comma-split → `valueCoding.{code, display}` on export (default path); see `_rawAnswerOptions` for non-Coding types |
| `_rawAnswerOptions` | `item.answerOption[]` | set on import when any option uses a non-`valueCoding` type (`valueString`, `valueInteger`, `valueDate`, `valueTime`, `valueReference`); exported verbatim for full round-trip fidelity; overrides the `options` string path on export; cleared when user edits options via Answer Type modal (converting to `valueCoding`) |
| `_renderStyle` | `item._text.extension[rendering-style]` | standard FHIR `rendering-style` extension |
| `_renderXhtml` | `item._text.extension[rendering-xhtml]` | raw XHTML markup; sanitized via DOMPurify + rendered as `innerHTML` in preview; editable in Appearance modal |
| `_calculatedExpr` | SDC `sdc-questionnaire-calculatedExpression` extension (`valueExpression.expression`) | FHIRPath |
| `_initialExpr` | SDC `sdc-questionnaire-initialExpression` extension (`valueExpression.expression`) | FHIRPath; evaluated once on import and on Re-init; result pre-fills `values[]` |
| `_readOnly` | `item.readOnly` | |
| `_prefix` | `item.prefix` | imported and exported; displayed as amber badge in preview; editable in builder meta-row |
| `_answerConstraint` | `item.answerConstraint` (R4B/R5) | `optionsOnly` / `optionsOrType` / `optionsOrString`; import + export + Answer Type modal dropdown; `optionsOnly` makes open-choice preview read-only |
| `_codes` | `item.code[]` | imported and exported unchanged (round-trip safe); editable via **Props** button (codes-modal — system/code/display rows, draft pattern); also supported on groups (see Group-specific) |
| `_maxLength` | `item.maxLength` | imported → `node._maxLength`; exported back when set; character counter + `maxlength` attribute enforced in preview |
| `_minLength` | SDC ext `http://hl7.org/fhir/StructureDefinition/minLength` (`valueInteger`) | imported → `node._minLength`; exported back when set; `minlength` HTML attribute enforced in preview; inline error `Min N chars` shown on blur when value is non-empty but shorter than limit; clears when value reaches the limit |
| `_maxFileSizeMB` | `questionnaire-maxSize` ext `http://hl7.org/fhir/StructureDefinition/maxSize` (`valueDecimal`) | imported → `node._maxFileSizeMB`; exported back when set; attachment items only; validated on file selection — error tag shown when file exceeds limit; `calcFormOk` returns `false`; hint shown below file button; editable in Answer Type modal |
| `_mimeTypes` | `http://hl7.org/fhir/StructureDefinition/mimeType` (`valueCode`, 0..*) | imported → `node._mimeTypes` string array; exported as one extension entry per MIME type; sets `accept` attribute on file input; hint shown below file button; editable in Answer Type modal (comma-separated) |
| `_minValue` | `questionnaire-minValue` ext (`valueDecimal` or `valueInteger`) | imported/exported for `integer`/`decimal` items; min HTML attribute set on input; error shown in preview when violated |
| `_maxValue` | `questionnaire-maxValue` ext (`valueDecimal` or `valueInteger`) | imported/exported for `integer`/`decimal` items; max HTML attribute set on input; error shown in preview when violated |
| `_optionOrdinals` | `ordinalValue` ext on `answerOption[].extension` (primary) or `valueCoding.extension` (fallback) | map of option code → numeric score; shown as `(N)` badge in radio/select; editable in Answer Type modal (`code=Label=score` format); exported to `answerOption.extension` |
| `_optionPrefixes` | `questionnaire-optionPrefix` ext on `answerOption[].extension` | map of option code → display prefix string (e.g. `'A.'`, `'1.'`); prepended to option label in select/radio preview; editable in Answer Type modal (`code=Prefix` format, comma-separated); exported to `answerOption.extension` alongside `ordinalValue` when present |
| `_sliderStep` | `questionnaire-sliderStepValue` ext (`valueDecimal` or `valueInteger`) | imported/exported for `integer`/`decimal` items; renders item as `<input type="range">` slider in preview; editable in Answer Type modal |
| `_disabledDisplay` | `item.disabledDisplay` (R4B native field) + R4 backport extension `extension-Questionnaire.item.disabledDisplay` | `'hidden'` → item removed from DOM when not visible; `'protected'` (default) → grayed row; editable in Show When modal |
| `_minOccurs` | `questionnaire-minOccurs` ext (`valueInteger`) | imported/exported when `node.repeats === true` |
| `_maxOccurs` | `questionnaire-maxOccurs` ext (`valueInteger`) | imported/exported when `node.repeats === true`; enforced in preview — add button disabled at limit |
| `_answerValueSet` | `item.answerValueSet` | imported → `node._answerValueSet`; exported back unchanged; external URLs expanded via `terminologyService.expandAll()` on questionnaire load — options cached in `node._vsCache` and rendered in preview; server resolved via per-item `_preferredTermServer` → questionnaire-level default → `https://tx.fhir.org/r4`; expansion failures shown in validateModal |
| `_answerExpression` | SDC `sdc-questionnaire-answerExpression` extension (`valueExpression.expression`) | FHIRPath evaluated at render time; result replaces static `answerOption[]` in preview; `answerOption[]` is suppressed on export when set; editable in Answer Type modal (Expression source radio) |
| `_initialValue` | `item.initial[0]` value | imported from `initial[0]`; exported as `initial: [entry]`; pre-fills `values[]` on import |
| `_initialValues` | `item.initial[]` all values | set only for repeating items with >1 initial value; exported as `initial: [entry, …]`; `_initialValue` holds `initial[0]` for backwards compat |
| `_initialSelected` | `answerOption[].initialSelected` | code of the initially-selected option; preserved round-trip; if no `item.initial[]` exists, also used to pre-fill `_initialValue` |
| `_definition` | `item.definition` | URL pointing to a StructureDefinition element; stored as `node._definition`; editable via **Props** button (codes-modal); round-trip safe; also supported on groups (see Group-specific) |
| `_maxDecimalPlaces` | `maxDecimalPlaces` ext (`valueInteger`) | Maximum decimal places for `decimal` items; enforced in preview (error message + `step` attribute); editable in Answer Type modal; round-trip safe |
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
- `node.enableBehavior` → `item.enableBehavior` (`'any'` or `'all'`); **required (que-12) when `enableWhen.count() > 1`**; omitted when only one condition exists and value is `'all'`
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
| `http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl` | standard | `itemType: 'radio'`, `'checklist'`, or `_itemControl` string | Yes (codes: `radio-button`, `check-box`, `autocomplete`, `lookup`, `drop-down`, `text-area`, `text-box`, `spinner`); `lookup` triggers live server-side ValueSet search via `$expand?filter=` |
| `http://hl7.org/fhir/StructureDefinition/rendering-style` | standard | `_renderStyle` | Yes |
| `http://hl7.org/fhir/StructureDefinition/rendering-xhtml` | standard | `_renderXhtml` | Yes |
| `http://hl7.org/fhir/StructureDefinition/rendering-markdown` | standard | `_renderMarkdown` | Yes (parsed by marked.js + DOMPurify; xhtml takes priority) |
| `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-calculatedExpression` | SDC | `_calculatedExpr` | Yes (SDC) |
| `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-initialExpression` | SDC | `_initialExpr` | Yes (SDC) |
| `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-answerExpression` | SDC | `_answerExpression` (dynamic answer options for choice/radio/open-choice) | Yes (SDC) |
| `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-variable` | SDC | `questVariables[]` on root | Yes (SDC) |
| `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-enableWhenExpression` | SDC | `enableWhenExpression` | Yes (SDC) |
| `http://hl7.org/fhir/StructureDefinition/questionnaire-constraint` | standard | `constraint[]` | Yes |
| `http://hl7.org/fhir/StructureDefinition/questionnaire-unit` | standard | `quantityUnit` (quantity default unit) | Yes |
| `http://hl7.org/fhir/StructureDefinition/questionnaire-unitValueSet` | standard | `_unitValueSet` — canonical URL of a ValueSet of selectable UCUM units; unit dropdown in preview uses `_unitVsCache` expanded on load; falls back to built-in list if offline | Yes |
| `http://hl7.org/fhir/StructureDefinition/questionnaire-unitOption` | standard | `_unitOptions` — 0..* explicit selectable units for quantity items; each extension carries a `valueCoding` (system, code, display); when set, unit dropdown shows only these units; editable in **Answer Type** modal "Unit options" section; mutually exclusive with `unitValueSet` | Yes |
| `http://hl7.org/fhir/StructureDefinition/questionnaire-referenceResource` | standard | `referenceResource` (reference type lock) | Yes |
| `http://hl7.org/fhir/StructureDefinition/questionnaire-referenceFilter` | standard | `_referenceFilter` (FHIRPath filter expression for reference targets) | Yes |
| `http://hl7.org/fhir/StructureDefinition/questionnaire-referenceProfile` | standard | `_referenceProfiles` (0..* canonical URLs restricting valid profiles for reference items) | Yes |
| `http://hl7.org/fhir/StructureDefinition/questionnaire-signatureRequired` | standard | `_signatureRequired` (0..* CodeableConcept with Signature Type Codes; item-level and root-level) | Yes |
| `http://hl7.org/fhir/StructureDefinition/questionnaire-minOccurs` | standard | `_minOccurs` (min repeat rows required) | Yes |
| `http://hl7.org/fhir/StructureDefinition/questionnaire-maxOccurs` | standard | `_maxOccurs` (max repeat rows; enforced in preview) | Yes |
| `http://hl7.org/fhir/StructureDefinition/minValue` | standard | `_minValue` (minimum value for numeric inputs; enforced in preview) | Yes |
| `http://hl7.org/fhir/StructureDefinition/maxValue` | standard | `_maxValue` (maximum value for numeric inputs; enforced in preview) | Yes |
| `http://hl7.org/fhir/StructureDefinition/ordinalValue` | standard | `_optionOrdinals[code]` (score per answer option; on `answerOption.extension`; displayed in preview; editable in builder) | Yes |
| `http://hl7.org/fhir/StructureDefinition/questionnaire-optionPrefix` | standard | `_optionPrefixes[code]` (display prefix per answer option e.g. `'A.'`; prepended to label in select/radio preview; editable in Answer Type modal; exported to `answerOption.extension`) | Yes |
| `http://hl7.org/fhir/StructureDefinition/questionnaire-sliderStepValue` | standard | `_sliderStep` (step for range slider; triggers slider rendering); also sets `_itemControl = 'slider'` on export and recognises imported `questionnaire-itemControl = slider` | Yes |
| `http://hl7.org/fhir/StructureDefinition/maxDecimalPlaces` | standard | `_maxDecimalPlaces` (max decimal digits for `decimal` items; enforced in preview; editable in Answer Type modal) | Yes |
| `http://hl7.org/fhir/5.0/StructureDefinition/extension-Questionnaire.item.disabledDisplay` | R4 backport | `_disabledDisplay` (hidden/protected; also read from native `item.disabledDisplay` field) | Yes (R4B/R5 backport) |
| `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-entryFormat` | SDC | `_entryFormat` (placeholder hint text shown on text/url/number/quantity controls; editable in Answer Type modal); **on import also reads** `http://hl7.org/fhir/StructureDefinition/entryFormat` (R4 element-definition alias); SDC URL takes precedence when both are present | Yes |
| `http://hl7.org/fhir/StructureDefinition/questionnaire-choiceOrientation` | standard | `_choiceOrientation` (`vertical` / `horizontal`; controls layout of radio button groups; editable in Answer Type modal for `radio` items) | Yes |
| `http://hl7.org/fhir/StructureDefinition/questionnaire-displayCategory` | standard | `_displayCategory` (`instructions` / `security` / `help`; applies visual category styling to `display` items in preview; editable in Answer Type modal) | Yes |
| `http://hl7.org/fhir/StructureDefinition/questionnaire-supportLink` | standard | `_supportLinks` (0..* help/documentation URIs per item or group; 🔗 icons in builder; "More info ↗" in patient view; editable via **Props** button) | Yes |
| `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-hidden` | SDC | `_hidden` (item/group hidden from patients; purple dashed border + HIDDEN badge in builder preview; excluded from PASS/FAIL; controls disabled; **Hidden** toggle button in builder actions); **on import also reads** `http://hl7.org/fhir/StructureDefinition/questionnaire-hidden` (R4 standard alias); SDC URL takes precedence when both are present | Yes (SDC) |
| `http://hl7.org/fhir/StructureDefinition/designNote` | Core | `_designNote` — author-facing note; editable via "Note" action on each item/group card; exported as `valueMarkdown`; never rendered in preview | Yes (Core) |
| `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-collapsible` | SDC | `_collapsible` (`'default-closed'` / `'default-open'`; groups only; controls initial collapsed state in patient-facing preview; `default-closed` groups start collapsed on load; user can still expand/collapse; editable via **States** → **Collapsible** select in builder) | Yes (SDC) |
| `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-openLabel` | SDC | `_openLabel` (`open-choice` items only; replaces the default "Choose or type…" placeholder with a custom label; editable in **Answer Type** modal under "Open label"; exported as `valueString`) | Yes (SDC) |
| `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-shortText` | SDC | `_shortText` — abbreviated label for summary views; shown as a small blue badge in the builder preview row (not visible in patient view); imported/exported as `valueString`; round-trip safe | Yes (SDC) |
| `http://hl7.org/fhir/StructureDefinition/minLength` | standard | `_minLength` (minimum character count for `text`/`url` items; `minlength` HTML attribute enforced in preview; inline error `Min N chars` on blur when value is non-empty but shorter than limit; clears when limit is reached) | Yes |
| `http://hl7.org/fhir/StructureDefinition/maxSize` | standard | `_maxFileSizeMB` (maximum file size in MB for `attachment` items; validated on file selection; error tag shown when exceeded; `calcFormOk` returns `false`; hint shown below file button; editable in Answer Type modal) | Yes |
| `http://hl7.org/fhir/StructureDefinition/mimeType` | standard | `_mimeTypes` (0..* allowed MIME types for `attachment` items; sets `accept` attribute on file input; hint shown below file button; editable in Answer Type modal as comma-separated list) | Yes |
| `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-preferredTerminologyServer` | SDC | `_preferredTermServer` — per-item preferred FHIR terminology server URL; editable via **Terminology** action on each item/group card; exported as `valueUrl`; Questionnaire-level default editable in Properties modal | Yes (SDC) |
| `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-choiceColumn` | SDC | `_choiceColumns` — 0..* complex extension defining multi-column display for choice/open-choice dropdowns; each column has `path` (FHIRPath), `label` (header text), optional `width` (Quantity), and `forDisplay` (boolean — which column shows in trigger after selection); editable in **Answer Type** modal "Choice columns" section; rendered as columned dropdown in preview | Yes (SDC) |
| `http://hl7.org/fhir/StructureDefinition/regex` | standard | `_regex` — regular expression pattern for `text`/`url` items; imported as `valueString`; validated on blur in preview (inline error "Does not match pattern"); editable in **Answer Type** modal "Regex validation pattern" field | Yes |
| `http://hl7.org/fhir/StructureDefinition/questionnaire-optionExclusive` | standard | `_optionExclusives` — on `answerOption.extension`; marks an option as exclusive (e.g. "None of the above"); selecting an exclusive option in a checklist deselects all other options; selecting a non-exclusive option deselects all exclusive ones; editable in **Answer Type** modal options editor "Excl" checkbox column | Yes |
| `http://hl7.org/fhir/StructureDefinition/questionnaire-usageMode` | standard | `_usageMode` — `valueCode`: `capture` / `display` / `display-non-empty` / `capture-display` / `capture-display-non-empty`; controls item visibility in patient vs preview mode; `display` / `display-non-empty` items hidden in patient view; editable in **States** modal dropdown | Yes |
| `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-itemMedia` | SDC | `_itemMedia` — `valueAttachment` with `url`, `contentType`, optional `title`; renders image/audio/video inline before the control in preview; editable in **Answer Type** modal "Item media URL" section | Yes (SDC) |
| `http://hl7.org/fhir/StructureDefinition/itemWeight` | R4 | `_optionWeights` — on `answerOption.extension` (or `valueCoding.extension` fallback); per-option `valueDecimal` scoring weight; shown as `[w:N]` badge in preview; editable in **Answer Type** modal options editor "Weight" column | Yes |
| `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-answerMedia` | SDC | `_answerMedias` — on `answerOption.extension`; `valueAttachment` with `url`/`contentType`; renders media inline next to option label in preview; preserved on round-trip (no inline editor) | Yes (SDC) |

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
| `_answerValueSet` | `item.answerValueSet` | URL preserved; expanded via `terminologyService` on load |
| `questContained[]` | `Questionnaire.contained[]` | Resources deep-copied on export; not otherwise processed |
| `_unknownExtensions[]` | `item.extension[]` | Unrecognised extension objects preserved verbatim; editable via Props modal |

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
| `id` | ← `id` in `qrMeta.id` | → written when non-empty; editable in QR Export modal | Optional |
| `language` | ← `language` in `qrMeta.language` | → written when non-empty; editable in QR Export modal | BCP-47 code |
| `meta.versionId` | ← `meta.versionId` in `qrMeta.metaVersionId` | → written when non-empty; Generate UUID button available | Optional |
| `meta.source` | ← `meta.source` in `qrMeta.metaSource` | → written when non-empty; editable in QR Export modal | Optional URI |
| `meta.lastUpdated` | not stored | → `new Date().toISOString()` | Always set to current time on export |
| `meta.profile[]` | ← `meta.profile` in `qrMeta.metaProfile[]` | → written when non-empty array; editable list in QR Export modal | Optional canonical URLs |
| `meta.tag[]` | ← `meta.tag` in `qrMeta.metaTag[]` | → written when non-empty array | Round-trip preserved; no editing UI |
| `meta.security[]` | ← `meta.security` in `qrMeta.metaSecurity[]` | → written when non-empty array | Round-trip preserved; no editing UI |

`qrMeta` is reset to defaults when a new questionnaire is imported. When a QR is loaded via the Answers menu, `qrMeta` is updated from the loaded response and pre-populates the QR Export modal.

---

## FHIR Version Support

| Version | Status |
|---|---|
| R4 | ✅ Fully supported |
| R4B / R5 | 🔧 Partial — most fields overlap; `disabledDisplay` is R4B/R5 native (R4 backport extension handled); `answerConstraint` is fully supported |
| STU3 | ✅ Import shim — automatically normalised to R4 on load via `js/fhir/stu3-shim.js`; see table below |

### STU3 → R4 Normalisation (`js/fhir/stu3-shim.js`)

Applied automatically in `importFHIR()` before the R4 parser runs. Detection: `meta.fhirVersion` starts with `3.`/`1.`, or presence of STU3-only fields anywhere in the item tree.

| STU3 field | R4 equivalent | Notes |
|---|---|---|
| `item.option[]` | `item.answerOption[]` | Field renamed; entry shape is identical |
| `item.options` (Reference) | `item.answerValueSet` | Reference URL extracted to canonical string |
| `enableWhen.hasAnswer: true` | `enableWhen.operator: 'exists', answerBoolean: true` | Visibility condition "has any answer" |
| `enableWhen.hasAnswer: false` | `enableWhen.operator: 'exists', answerBoolean: false` | Visibility condition "has no answer" |
| `enableWhen` with `answer[x]` but no `operator` | adds `operator: '='` | STU3 implicit equality |
| `item.initial<Type>` (e.g. `initialInteger`, `initialCoding`) | `item.initial: [{ value<Type>: ... }]` | All 12 typed initial fields covered |

**Output:** always R4 — the STU3 shim is import-only. Exporting an imported STU3 questionnaire produces valid FHIR R4 JSON.

---

## Extension URL Aliasing

Some capabilities exist as both a **standard R4 extension** and a separate **SDC extension**, each with a different URL. The builder reads **both** variants on import; the SDC URL takes precedence when both are present in the same item.

| Capability | URLs read on import | Precedence |
|---|---|---|
| Hidden item | `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-hidden` (SDC, primary) and `http://hl7.org/fhir/StructureDefinition/questionnaire-hidden` (R4 standard, alias) | SDC URL wins if both present |
| Entry format hint | `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-entryFormat` (SDC, primary) and `http://hl7.org/fhir/StructureDefinition/entryFormat` (R4 element-definition ext, alias) | SDC URL wins if both present |

---

## Not Supported / Partial Support

Legend: ⚠️ = silent data loss (field present in import file, ignored or overwritten on export); ❌ = not handled at all; 🔧 = partial support.

### Questionnaire root-level — silent data loss on export

These fields are present in the FHIR spec at the `Questionnaire` root level but are not stored on import and are therefore not written back on export.

| FHIR field | Status | Notes |
|---|---|---|
| `Questionnaire.implicitRules` | ✅ Fully implemented | Editable URI input in Properties modal — Resource Meta section; import + export |

### Item-level — not implemented

| FHIR field / extension | Status | Notes |
|---|---|---|
| `Questionnaire.contained[]` | 🔧 Preserved round-trip | Viewable as JSON in the Contained card; not otherwise editable |
| Resource reference resolution | 🔧 Partial | `type: 'reference'`: resource-type dropdown + id text input; no live FHIR server search |
| `questionnaire-baseType` / `questionnaire-fhirType` | ❌ Not handled | Base FHIR type for items derived from `ElementDefinition` (used with `item.definition`). |

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
| `sdc-questionnaire-candidateExpression` | FHIRPath expression that returns a list of candidate answer options for choice/open-choice items; evaluated at render time (similar to `answerExpression` but intended for lookup items) |
| `sdc-questionnaire-lookupQuestionnaire` | Canonical reference to a Questionnaire used to produce candidate answers for `reference` items (for server-side lookup) |
| `sdc-questionnaire-isSubject` | Marks the item whose answer identifies the subject of the questionnaire response (overrides `Questionnaire.subjectType` for the response) |


