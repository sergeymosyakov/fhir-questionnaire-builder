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
  _baseType:           string,          // questionnaire-baseType extension valueCode
  _fhirType:           string,          // questionnaire-fhirType extension valueCode
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
  repeats:             boolean,          // FHIR item.repeats. For question items: multi-row input in preview ("+ Add another"). For checklist (multi-select check-box) repeats is intrinsic: always true, no "Add another" (multiple selection is the checkboxes themselves) — see impliesRepeats(). For groups: rendered with per-instance blocks in preview (dashed border, isolated values/enableWhen/validation per entry, Add/Remove buttons). Per-instance context threaded via rc.instancePath.
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
  _candidateExpression: string,          // SDC sdc-questionnaire-candidateExpression — FHIRPath expression for candidate/suggested answers; evaluated at render time; mutually exclusive with _answerExpression / answerOption[]
  _isSubject:          boolean,          // SDC sdc-questionnaire-isSubject — marks the item whose answer identifies the QuestionnaireResponse subject; only one item per questionnaire may set it
  _columnCount:        number,           // SDC sdc-questionnaire-columnCount — positiveInt; per spec valid on any choice item with options; editable/round-tripped for all choice types; preview lays out options across N columns (vertical-first) for inline lists (radio/checklist) only
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
  _definition:         string,          // item.definition URL (also on groups)
  _baseType:           string,          // questionnaire-baseType extension valueCode (also on groups)
  _fhirType:           string,          // questionnaire-fhirType extension valueCode (also on groups)
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
| `_baseType` | `questionnaire-baseType` ext (`valueCode`) | base FHIR type for items derived from an ElementDefinition (e.g. `string`, `HumanName`); round-trip safe; editable via **Props** button — Base Type field |
| `_fhirType` | `questionnaire-fhirType` ext (`valueCode`) | specific FHIR type for complex elements (e.g. `HumanName`, `ContactPoint`); round-trip safe; editable via **Props** button — FHIR Type field |
| `_codes` | `item.code[]` | coding entries (system / code / display); round-trip safe; editable via **Props** button |
| `_supportLinks` | `questionnaire-supportLink` ext (0..*) | help / documentation URIs; rendered as 🔗 icons in builder preview and "More info ↗" buttons in patient view; editable via **Props** button |
| `_hidden` | `sdc-questionnaire-hidden` ext (`valueBoolean: true`) | item/group permanently hidden from patients; still participates in `calculatedExpression`; rendered with purple dashed border + **HIDDEN badge** in builder preview when **hidden** toggle is on; excluded from PASS/FAIL validation; controls disabled in preview; toggled via **Hidden** action button in builder; **on import also reads** `http://hl7.org/fhir/StructureDefinition/questionnaire-hidden` (R4 standard alias) | Yes |

### Item-specific

| Internal field | FHIR field / extension | Notes |
|---|---|---|
| `options` | `item.answerOption[]` | comma-split → `valueCoding.{code, display}` on export (default path); `system` added per-option from `_optionSystems` when set; see `_rawAnswerOptions` for non-Coding types |
| `_rawAnswerOptions` | `item.answerOption[]` | set on import when any option uses a non-`valueCoding` type (`valueString`, `valueInteger`, `valueDate`, `valueTime`, `valueReference`); exported verbatim for full round-trip fidelity; overrides the `options` string path on export; **editable in Answer Type modal via the Type column** — user can change each row's value[x] type and save back correctly |
| `_renderStyle` | `item._text.extension[rendering-style]` | standard FHIR `rendering-style` extension |
| `_renderXhtml` | `item._text.extension[rendering-xhtml]` | raw XHTML markup; sanitized via DOMPurify + rendered as `innerHTML` in preview; editable in Appearance modal |
| `_calculatedExpr` | SDC `sdc-questionnaire-calculatedExpression` extension (`valueExpression.expression`) | FHIRPath |
| `_initialExpr` | SDC `sdc-questionnaire-initialExpression` extension (`valueExpression.expression`) | FHIRPath; evaluated once on import and on Re-init; result pre-fills `values[]` |
| `_readOnly` | `item.readOnly` | |
| `_prefix` | `item.prefix` | imported and exported; displayed as amber badge in preview; editable in builder meta-row |
| `_answerConstraint` | `item.answerConstraint` (R5 native) | `optionsOnly` / `optionsOrType` / `optionsOrString`; import + export + Answer Type modal dropdown; `optionsOnly` makes open-choice preview read-only; on R4/R4B export it is downgraded to the builder-private extension `item-answerConstraint` (field is absent from R4/R4B) |
| `_codes` | `item.code[]` | imported and exported unchanged (round-trip safe); editable via **Props** button (codes-modal — system/code/display rows, draft pattern); also supported on groups (see Group-specific) |
| `_maxLength` | `item.maxLength` | imported → `node._maxLength`; exported back when set; character counter + `maxlength` attribute enforced in preview |
| `_minLength` | SDC ext `http://hl7.org/fhir/StructureDefinition/minLength` (`valueInteger`) | imported → `node._minLength`; exported back when set; `minlength` HTML attribute enforced in preview; inline error `Min N chars` shown on blur when value is non-empty but shorter than limit; clears when value reaches the limit |
| `_maxFileSizeMB` | `questionnaire-maxSize` ext `http://hl7.org/fhir/StructureDefinition/maxSize` (`valueDecimal`) | imported → `node._maxFileSizeMB`; exported back when set; attachment items only; validated on file selection — error tag shown when file exceeds limit; `calcFormOk` returns `false`; hint shown below file button; editable in Answer Type modal |
| `_mimeTypes` | `http://hl7.org/fhir/StructureDefinition/mimeType` (`valueCode`, 0..*) | imported → `node._mimeTypes` string array; exported as one extension entry per MIME type; sets `accept` attribute on file input; hint shown below file button; editable in Answer Type modal (comma-separated) |
| `_minValue` | `questionnaire-minValue` ext (`valueDecimal` or `valueInteger`) | imported/exported for `integer`/`decimal` items; min HTML attribute set on input; error shown in preview when violated |
| `_maxValue` | `questionnaire-maxValue` ext (`valueDecimal` or `valueInteger`) | imported/exported for `integer`/`decimal` items; max HTML attribute set on input; error shown in preview when violated |
| `_optionOrdinals` | `ordinalValue` ext on `answerOption[].extension` (primary) or `valueCoding.extension` (fallback) | map of option code → numeric score; shown as `(N)` badge in radio/select; editable in Answer Type modal (`code=Label=score` format); exported to `answerOption.extension` |
| `_optionSystems` | `answerOption[].valueCoding.system` | map of option code → system URI (e.g. `http://loinc.org`); optional per-option; editable in Answer Type modal **System** column; exported as `valueCoding.system` in the simple options path; preserved from `_rawAnswerOptions.valueCoding.system` in the raw path |
| `_optionPrefixes` | `questionnaire-optionPrefix` ext on `answerOption[].extension` | map of option code → display prefix string (e.g. `'A.'`, `'1.'`); prepended to option label in select/radio preview; editable in Answer Type modal (`code=Prefix` format, comma-separated); exported to `answerOption.extension` alongside `ordinalValue` when present |
| `_sliderStep` | `questionnaire-sliderStepValue` ext (`valueDecimal` or `valueInteger` on import; always `valueInteger` on export — decimal steps rounded; R4 constraint) | imported/exported for `integer`/`decimal` items; renders item as `<input type="range">` slider in preview; editable in Answer Type modal |
| `_disabledDisplay` | `item.disabledDisplay` (R5 native field) + R4/R4B downgrade extension `item-disabledDisplay` | Effect applies in **patient view** only: `'hidden'` → item removed from the form when its condition is not met; `'protected'` (default) → item kept but shown grayed/read-only. In the **builder/design preview** every disabled item is always shown dimmed (`lform-waiting`) regardless of this value, so the author sees the full form. Editable in Show When modal; on R4/R4B export the native field is downgraded to the builder-private extension (field is absent from R4/R4B) |
| `_minOccurs` | `questionnaire-minOccurs` ext (`valueInteger`) | imported/exported when `node.repeats === true` |
| `_maxOccurs` | `questionnaire-maxOccurs` ext (`valueInteger`) | imported/exported when `node.repeats === true`; enforced in preview — add button disabled at limit |
| `_answerValueSet` | `item.answerValueSet` | imported → `node._answerValueSet`; exported back unchanged; external URLs expanded via `terminologyService.expandAll()` on questionnaire load — options cached in `node._vsCache` and rendered in preview; server resolved via per-item `_preferredTermServer` → questionnaire-level default → `https://tx.fhir.org/r4`; expansion failures shown in validateModal |
| `_answerExpression` | SDC `sdc-questionnaire-answerExpression` extension (`valueExpression.expression`) | FHIRPath evaluated at render time; result replaces static `answerOption[]` in preview; `answerOption[]` is suppressed on export when set; editable in Answer Type modal (Expression source radio) |
| `_candidateExpression` | SDC `sdc-questionnaire-candidateExpression` extension (`valueExpression.expression`) | FHIRPath evaluated at render time for candidate/suggested answers; same client-side evaluation as `_answerExpression`; mutually exclusive with `_answerExpression` and `answerOption[]` (each clears the others); `answerOption[]` suppressed on export when set; editable in Answer Type modal (Candidate source radio) |
| `_isSubject` | SDC `sdc-questionnaire-isSubject` extension (`valueBoolean`) | marks the item whose answer identifies the `QuestionnaireResponse.subject`; editable in States modal (Is subject checkbox, non-display items only); shown as a `SUBJECT` badge in the builder preview (not in patient view); export emits `valueBoolean: true`; validation errors when set on more than one item |
| `_initialValue` | `item.initial[0]` value | imported from `initial[0]`; exported as `initial: [entry]`; pre-fills `values[]` on import |
| `_initialValues` | `item.initial[]` all values | set only for repeating items with >1 initial value; exported as `initial: [entry, …]`; `_initialValue` holds `initial[0]` for backwards compat |
| `_initialSelected` | `answerOption[].initialSelected` | code of the initially-selected option; preserved round-trip; if no `item.initial[]` exists, also used to pre-fill `_initialValue` |
| `_definition` | `item.definition` | URL pointing to a StructureDefinition element; stored as `node._definition`; editable via **Props** button (codes-modal); round-trip safe; also supported on groups (see Group-specific) |
| `_baseType` | `questionnaire-baseType` ext (`valueCode`) | base FHIR type for items derived from an ElementDefinition; editable via **Props** button — Base Type field; round-trip safe; also supported on groups |
| `_fhirType` | `questionnaire-fhirType` ext (`valueCode`) | specific FHIR type for complex structures; editable via **Props** button — FHIR Type field; round-trip safe; also supported on groups |
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
- Quantity answers (`answerQuantity`): the referenced answer is a `{ value, unit }` object — compared numerically on `value` for all operators; `=`/`≠` additionally require the unit (UCUM code) to match when the condition specifies one

---

## Extensions Summary

| Extension URL | Type | Field | Standard? |
|---|---|---|---|
| `http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl` | standard | `itemType: 'radio'`, `'checklist'`, or `_itemControl` string | Yes (codes: `radio-button`, `check-box`, `autocomplete`, `lookup`, `drop-down`, `text-box`, `spinner`, `slider`, `flyover`, group `header`/`footer`; plus the **de-facto** `text-area` code, not defined in the FHIR item-control code system but permitted by the extension's Extensible binding); `lookup` triggers live server-side ValueSet search via `$expand?filter=`; `flyover` (display items) hides text inline and reveals it on hover; `header`/`footer` render a group as a top/bottom band |
| `http://hl7.org/fhir/StructureDefinition/rendering-style` | standard | `_renderStyle` | Yes |
| `http://hl7.org/fhir/StructureDefinition/rendering-xhtml` | standard | `_renderXhtml` | Yes |
| `http://hl7.org/fhir/StructureDefinition/rendering-markdown` | standard | `_renderMarkdown` | Yes (parsed by marked.js + DOMPurify; xhtml takes priority) |
| `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-calculatedExpression` | SDC | `_calculatedExpr` | Yes (SDC) |
| `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-initialExpression` | SDC | `_initialExpr` | Yes (SDC) |
| `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-answerExpression` | SDC | `_answerExpression` (dynamic answer options for choice/radio/open-choice) | Yes (SDC) |
| `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-candidateExpression` | SDC | `_candidateExpression` (dynamic candidate/suggested answers for choice/radio/open-choice) | Yes (SDC) |
| `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-isSubject` | SDC | `_isSubject` (item whose answer is the QR subject) | Yes (SDC) |
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
| `http://hl7.org/fhir/StructureDefinition/questionnaire-sliderStepValue` | standard | `_sliderStep` (step for range slider; triggers slider rendering); also sets `_itemControl = 'slider'` on export and recognises imported `questionnaire-itemControl = slider`; **R4 note:** export always uses `valueInteger` (decimal steps are rounded; local validator warns) | Yes |
| `http://hl7.org/fhir/StructureDefinition/maxDecimalPlaces` | standard | `_maxDecimalPlaces` (max decimal digits for `decimal` items; enforced in preview; editable in Answer Type modal) | Yes |
| `https://sergeymosyakov.github.io/fhir-questionnaire-builder/StructureDefinition/item-disabledDisplay` | builder-private | `_disabledDisplay` (hidden/protected; also read from native `item.disabledDisplay` R5 field) | Yes (R4/R4B downgrade of the R5-only field) |
| `https://sergeymosyakov.github.io/fhir-questionnaire-builder/StructureDefinition/item-answerConstraint` | builder-private | `_answerConstraint` (optionsOnly/optionsOrType/optionsOrString; also read from native `item.answerConstraint` R5 field) | Yes (R4/R4B downgrade of the R5-only field) |
| `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-entryFormat` | SDC | `_entryFormat` (placeholder hint text shown on text/url/number/quantity controls; editable in Answer Type modal); **on import also reads** `http://hl7.org/fhir/StructureDefinition/entryFormat` (R4 element-definition alias); SDC URL takes precedence when both are present | Yes |
| `http://hl7.org/fhir/StructureDefinition/questionnaire-choiceOrientation` | standard | `_choiceOrientation` (`vertical` / `horizontal`; controls layout of radio button groups; editable in Answer Type modal for `radio` items) | Yes |
| `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-columnCount` | SDC | `_columnCount` (`positiveInt`; per spec valid on any choice item with a set of options; editable in Answer Type modal "Option columns" for all choice types `select`/`radio`/`open-choice`/`checklist` and round-tripped; preview applies the visual N-column layout, vertical-first, to inline option lists (`radio`/`checklist`) only) | Yes (SDC) |
| `http://hl7.org/fhir/StructureDefinition/questionnaire-displayCategory` | standard | `_displayCategory` (`instructions` / `security` / `help`; applies visual category styling to `display` items in preview; editable in Answer Type modal); exported with `system: 'http://hl7.org/fhir/questionnaire-display-category'` in coding; **R4 note:** only exported for `group` items (R4 context invariant); suppressed on `display` items with local validator warning | Yes |
| `http://hl7.org/fhir/StructureDefinition/questionnaire-supportLink` | standard | `_supportLinks` (0..* help/documentation URIs per item or group; 🔗 icons in builder; "More info ↗" in patient view; editable via **Props** button) | Yes |
| `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-hidden` | SDC | `_hidden` (item/group hidden from patients; purple dashed border + HIDDEN badge in builder preview; excluded from PASS/FAIL; controls disabled; **Hidden** toggle button in builder actions); **on import also reads** `http://hl7.org/fhir/StructureDefinition/questionnaire-hidden` (R4 standard alias); SDC URL takes precedence when both are present | Yes (SDC) |
| `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-observationExtract` | SDC | `_observationExtract` (item/group flagged for Observation-based extraction; **States** → **Extract as Observation** checkbox; exported/imported as `valueBoolean`; an explicit `false` on a descendant suppresses an inherited `true`). **Save → Observations** runs the extraction in `js/fhir/extract.js`, producing a `transaction` Bundle of `Observation` resources from the current answers. Each coded leaf answer → one Observation (`status: final`, `code` from `item.code`, `value[x]` from the answer, `Quantity` when `questionnaire-unit` is present, `subject`/`encounter`/`effectiveDateTime`/`issued`/`performer`/`derivedFrom` from the QR). **Deliberate scope:** when a group carries only a boolean flag the SDC spec leaves the parent↔child relationship (component vs hasMember) undefined — the builder treats such a group as a container and emits each coded leaf as an independent Observation (no value-less parent, no `component[]`/`hasMember`). Root-level flag and `false`-suppression are honoured by the extraction engine but the builder UI models the flag per item/group only | Yes (SDC) |
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
| `http://hl7.org/fhir/StructureDefinition/translation` | standard | `questDoc.translations[lang].items[linkId]` / `.title` / `.opts[key]` — per-language plain text translations on `_text.extension`, `_title.extension`, and `answerOption._valueCoding._display.extension`; written/read by the Translate modal; active language selected via the language switcher in the header | Yes |
| `http://fhir-qb.app/StructureDefinition/ui-translations` | app-custom | `questDoc.translations[lang].ui` — JSON-serialised map of UI string keys → translated labels (AND/OR separators, "+ Add another", "More info ↗", etc.); stored as `valueString: JSON.stringify(ui)` on the root Questionnaire; round-trip safe | No (app-specific) |
| `http://fhir-qb.app/StructureDefinition/xhtml-translations` | app-custom | `questDoc.translations[lang].xhtml` — JSON-serialised map of `linkId → translated XHTML string`; for items that use `rendering-xhtml`; Google Translate preserves HTML tags; rendered via `innerHTML + DOMPurify`; stored as `valueString: JSON.stringify(xhtml)` on the root Questionnaire; round-trip safe | No (app-specific) |
| `http://fhir-qb.app/StructureDefinition/markdown-translations` | app-custom | `questDoc.translations[lang].markdown` — JSON-serialised map of `linkId → translated Markdown string`; for items that use `rendering-markdown`; Google Translate preserves Markdown syntax; rendered via `marked + DOMPurify`; stored as `valueString: JSON.stringify(markdown)` on the root Questionnaire; round-trip safe | No (app-specific) |

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
| `questMeta._rawQuestExtensions[]` | `Questionnaire.extension[]` (non-variable) | All root-level extensions that are **not** handled by a dedicated field (variables, replaces, preferredTerminologyServer, signatureRequired, launchContext, builder-target-version) are preserved verbatim in `_rawQuestExtensions` and written back unchanged on export. This covers round-trip fidelity for `sdc-questionnaire-itemContext`, `sdc-questionnaire-assembleExpectation`, `sdc-questionnaire-contextExpression`, and any other root-level SDC/custom extension. No editing UI. |

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
| R4B | ✅ Fully supported — schema overlaps R4; R5-only fields are downgraded to builder-private extensions on export |
| R5 | ✅ Fully supported — `disabledDisplay` and `answerConstraint` are R5 native fields; `choice`/`open-choice` exported as `coding`. The R5-only root metadata fields `versionAlgorithm[x]` and `copyrightLabel` are editable in Properties → Advanced and downgraded to their official `artifact-*` extensions on R4/R4B export. |
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

## Semantic Validation

The builder runs `validateTree()` (`js/fhir/validate.js`) automatically on import and when the **Validate** button is clicked. `validateTree(tree, values, questMeta)` accepts an optional `questMeta` object for root-level checks.

### FHIR R4 formal invariants

All R4 `Questionnaire` invariants (que-0 through que-13) are enforced by the local validator and/or suppressed silently on export:

| Invariant | Rule | Validator | Export |
|---|---|---|---|
| que-0 | `Questionnaire.name` must match `[A-Z][A-Za-z0-9_]{0,254}` | ⚠️ warning | — |
| que-1 | Group items must have nested items | ⚠️ warning | — |
| que-2 | All `linkId` values must be unique | ✅ error | Checked in `js/fhir/validators/local.js`; duplicate linkId surfaces as an error in the Validate modal |
| que-3 | `display` items cannot have `item.code[]` | ⚠️ warning | ✅ suppressed |
| que-4 | `answerOption[]` and `answerValueSet` are mutually exclusive | ❌ error | ✅ `answerOption[]` path skips when VS set |
| que-5 | `answerValueSet` only valid on choice/open-choice/decimal/integer/date/dateTime/time/string/quantity | ❌ error | ✅ suppressed on disallowed types |
| que-6 | `display` items cannot have `required` or `repeats` | ⚠️ warning | ✅ suppressed |
| que-7 | `enableWhen.operator = 'exists'` must use `answerBoolean` | ✅ error | Evaluated in `js/eval.js`; validator warns in `js/fhir/validate.js` when `answerBoolean` is missing |
| que-8 | `display`/`group` items cannot have `initial[]` | ⚠️ (via que-11) | ✅ suppressed |
| que-9 | `display` items cannot have `readOnly` | ⚠️ warning | ✅ suppressed |
| que-10 | `maxLength` only valid for boolean/decimal/integer/string/text/url/open-choice | ⚠️ warning | ✅ suppressed on disallowed types |
| que-11 | `initial[]` must be absent when `answerOption[]` present | ⚠️ warning | ✅ suppressed |
| que-12 | `enableBehavior` required when `enableWhen.count() > 1` | ✅ auto-handled | ✅ auto-written |
| que-13 | `repeats: false` → at most 1 initial value | ⚠️ warning | — |

### Cross-field semantic warnings

| Combination | Severity | Message |
|---|---|---|
| `required: true` + `hidden: true` | warning | Item can never receive an answer — required constraint can never be satisfied |
| `calculatedExpression` set + `readOnly` not `true` | warning | Computed value can be overwritten by the user — consider setting read-only |
| `answerExpression` set + `answerOption[]` also present | warning | Mutually exclusive in SDC — `answerOption[]` is ignored at runtime |
| `candidateExpression` set + `answerOption[]` also present | warning | Mutually exclusive in SDC — `answerOption[]` is ignored at runtime |
| `isSubject: true` on more than one item | error | A QuestionnaireResponse can have only one subject — lists all marked linkIds |
| `candidateExpression` with invalid FHIRPath syntax | error | Reported as `Candidate expression error: …` |
| `enableWhen[]` set + `enableWhenExpression` also set | warning | Both visibility controls are active — `enableWhenExpression` takes precedence in SDC |
| `repeats: false` + `_initialValues` count > 1 | warning | Only the first initial value is used when repeats is not enabled |
| `sliderStep` is a decimal | warning | R4 only allows `valueInteger`; step rounded on export |
| `displayCategory` on a `display` item | warning | R4 only allows on group items; suppressed on export |

All rules are tested in `tests/validate.test.js` (1064 unit tests total across all test files).

---

## SDC Operations

Server-side SDC operations that the builder integrates with, and the extensions that configure them.

### SDC server operations — supported

| Operation | How to use | Notes |
|---|---|---|
| `Questionnaire/$populate` | **Answers ▾ → ↧ Fill from FHIR Server…** (enabled when a questionnaire is loaded) → search for a Patient by name (live FHIR search against the FHIR Base Server) or type `Patient/{id}` → click **Fill from Server** | Sends `POST {SDC Server || FHIR Base}/Questionnaire/$populate` with `Parameters { questionnaire, subject }`. Merges returned `QuestionnaireResponse` answers into the current form via `importQRAnswers`. Accepts both direct QR result and Parameters-wrapped QR. Requires a server implementing the SDC IG (e.g. Matchbox). |
| Definition-based extraction | **Save ▾ → Definition Extract · FHIR JSON Bundle** (after filling answers) → review the extracted resources → **Download Bundle** | Client-side `definitionExtract(questJson, qr)` walks groups carrying the `sdc-questionnaire-definitionExtract` extension, maps each child `item.definition` answer to its FHIR resource element path, and produces a transaction `Bundle`. No server required. |

### SDC extensions — population and extraction

Extensions that configure how the server-side engine populates or extracts fields.

| Extension | Builder support | Notes |
|---|---|---|
| `sdc-questionnaire-launchContext` | ✅ Full | Editing UI in **Properties → Launch Context** + import/export. Execution requires SDC server. |
| `sdc-questionnaire-definitionExtract` | 🔧 Partial | Client-side extraction via **Save ▾ → Definition Extract**; `itemExtractionContext` and StructureMap-based extraction not evaluated |
| `sdc-questionnaire-itemContext` | 🔄 Round-trip only | Not evaluated client-side |
| `sdc-questionnaire-sourceQueries` / `contextExpression` | 🔄 Round-trip only | Server-side batch queries |
| `sdc-questionnaire-targetStructureMap` | 🔄 Round-trip only | Requires server StructureMap engine |
| `sdc-questionnaire-sourceStructureMap` | 🔄 Round-trip only | Requires server StructureMap engine |
| `sdc-questionnaire-width` | 🔄 Round-trip only | Table column width; table layout not implemented |
| `sdc-questionnaire-lookupQuestionnaire` | 🔄 Round-trip only | Server-side reference lookup |

---

## FHIR Coverage

A complete status listing of every FHIR R4 Questionnaire field, extension, and SDC feature relative to this builder.

**Legend:**
- ✅ **Full** — editable in the builder, imported, exported, and (where applicable) executed client-side.
- 🔧 **Partial** — some functionality works; specific gaps noted.
- 🔄 **Round-trip** — preserved on import and written back on export unchanged. No editing UI and no client-side execution.
- ❌ **Not supported** — not parsed; data may be lost on import/export cycle.

---

### Questionnaire root fields

| Field | Status | Notes |
|---|---|---|
| `id` | ✅ | Editable in Properties |
| `url` | ✅ | |
| `version` | ✅ | |
| `name` | ✅ | |
| `title` | ✅ | |
| `status` | ✅ | |
| `experimental` | ✅ | |
| `date` | ✅ | |
| `publisher` | ✅ | |
| `description` | ✅ | |
| `purpose` | ✅ | |
| `copyright` | ✅ | |
| `approvalDate` | ✅ | |
| `lastReviewDate` | ✅ | |
| `effectivePeriod` | ✅ | |
| `subjectType[]` | ✅ | Chip UI in Properties |
| `language` | ✅ | |
| `identifier[]` | ✅ | Editable in Properties |
| `code[]` | ✅ | Editable in Properties |
| `contact[]` | ✅ | Editable in Properties |
| `jurisdiction[]` | 🔧 | First `coding` per entry editable; extra codings and `text` field lost on save |
| `useContext[]` | 🔄 | Preserved; no editing UI (structure too variable) |
| `derivedFrom[]` | ✅ | Editable in Properties |
| `meta.*` | ✅ | versionId, source, lastUpdated (always refreshed), profile[], tag[], security[] — all editable in Properties |
| `text` (Narrative) | 🔧 | Read-only display in Properties; auto-generated on export; not user-editable |
| `contained[]` | 🔧 | Deep-copied on export; viewable as JSON chips; not editable in the builder |
| `implicitRules` | ✅ | Editable in Properties → Resource Meta |
| `modifierExtension[]` | 🔄 | Preserved in `questMeta._rawModifierExtension`; written back on export. Validator emits a warning when present — the builder does not interpret modifier semantics. |
| Unknown root `extension[]` | 🔄 | Preserved in `_rawQuestExtensions`; written back unchanged |

---

### Item core fields

| Field | Status | Notes |
|---|---|---|
| `linkId` | ✅ | Editable inline; validated unique |
| `text` | ✅ | Inline title editor |
| `type` | ✅ | All 16 R4 item types + builder aliases (radio, checklist, select, checkbox, …) |
| `required` | ✅ | |
| `repeats` | ✅ | |
| `readOnly` | ✅ | |
| `maxLength` | ✅ | |
| `prefix` | ✅ | Editable inline |
| `definition` (URL) | 🔧 | Preserved and editable as a URL; not resolved against StructureDefinition (requires server) |
| `code[]` | ✅ | Editable via Props button |
| `enableWhen[]` | ✅ | Full editor; AND/OR behavior |
| `enableBehavior` | ✅ | `all` / `any`; auto-written when required (que-12) |
| `answerValueSet` | ✅ | Expanded on load via terminology server; round-trip |
| `answerOption[]` | ✅ | valueCoding, valueString, valueInteger, valueDate, valueTime, valueReference; + initialSelected; + ordinalValue, optionPrefix, optionExclusive, itemWeight, answerMedia extensions |
| `initial[]` | ✅ | All supported value types; multi-value for repeating items |
| `item[]` (nested) | ✅ | Unlimited depth |
| `disabledDisplay` | 🔧 | R5 native; on R4/R4B export downgraded to builder-private extension for lossless round-trip |
| `answerConstraint` | 🔧 | R5 native; on R4/R4B export downgraded to builder-private extension |
| `enableWhen.answerQuantity` | ✅ | Quantity-type enableWhen conditions: numeric comparison on the value for all operators; `=`/`≠` also match the unit (UCUM code) when set. Edited in the Show When panel (value + unit) for quantity questions. |

---

### R4 standard extensions (item-level)

| Extension | Status | Notes |
|---|---|---|
| `questionnaire-itemControl` | ✅ | FHIR codes: radio-button, check-box, drop-down, autocomplete, lookup, text-box, spinner, slider, flyover; group codes: header, footer, **gtable**. **`text-area`** is a widely-used **de-facto** code (not defined in the FHIR item-control code system; the extension's *Extensible* binding permits it). Other FHIR codes (list, table, htable, atable, inline, prompt, unit, lower, upper) are preserved in `_itemControl` on round-trip but not specially rendered. |
| `rendering-style` | ✅ | Inline CSS on `item._text` |
| `rendering-xhtml` | ✅ | Raw XHTML, sanitized via DOMPurify |
| `rendering-markdown` | ✅ | Parsed by marked.js + DOMPurify |
| `ordinalValue` | ✅ | Per-option numeric score |
| `itemWeight` | ✅ | Per-option weight |
| `questionnaire-optionPrefix` | ✅ | Per-option display prefix |
| `questionnaire-optionExclusive` | ✅ | "None of the above" exclusive option |
| `questionnaire-unit` | ✅ | Quantity default unit (UCUM) |
| `questionnaire-unitValueSet` | ✅ | Canonical URL for selectable UCUM units |
| `questionnaire-unitOption` | ✅ | 0..* explicit selectable units |
| `questionnaire-referenceResource` | ✅ | Locks `reference` type to one resource type |
| `questionnaire-referenceFilter` | ✅ | FHIRPath filter for valid reference targets |
| `questionnaire-referenceProfile` | ✅ | Canonical profile URLs for reference items |
| `questionnaire-minOccurs` | ✅ | Min repeat rows |
| `questionnaire-maxOccurs` | ✅ | Max repeat rows; enforced in preview |
| `minValue` | ✅ | Numeric min; enforced in preview |
| `maxValue` | ✅ | Numeric max; enforced in preview |
| `maxDecimalPlaces` | ✅ | Max decimal digits |
| `minLength` | ✅ | Min character count |
| `maxSize` | ✅ | Max file size in MB (attachment) |
| `mimeType` | ✅ | Allowed MIME types (attachment) |
| `regex` | ✅ | Regex validation pattern |
| `questionnaire-sliderStepValue` | ✅ | Step value; renders integer/decimal as slider |
| `questionnaire-choiceOrientation` | ✅ | vertical / horizontal layout for radio groups |
| `questionnaire-displayCategory` | ✅ | instructions / security / help; group items only in R4 |
| `questionnaire-supportLink` | ✅ | 🔗 help URIs per item/group |
| `questionnaire-signatureRequired` | ✅ | 0..* signature type codings |
| `questionnaire-constraint` | ✅ | FHIRPath validation rules; enforced in preview |
| `questionnaire-usageMode` | ✅ | capture / display / display-non-empty / … |
| `questionnaire-hidden` | ✅ | R4 alias for `sdc-questionnaire-hidden`; both read on import |
| `entryFormat` | ✅ | R4 alias for `sdc-questionnaire-entryFormat`; both read on import |
| `designNote` | ✅ | Author-internal note (not shown to patients) |
| `questionnaire-baseType` | ✅ | Base FHIR type (editable via Props) |
| `questionnaire-fhirType` | ✅ | Specific FHIR type (editable via Props) |
| `questionnaire-itemControl: gtable` | ✅ | Group table layout — children become columns, repeat instances become rows. Non-repeating groups render a single data row. Nested groups inside cells render using their own `_itemControl` (stacked default or nested gtable). GTABLE badge shown in builder. Sample: `sampledata/gtable-demo.fhir.json`. |
| `questionnaire-itemControl: atable` | ❌ | Answer table (Likert matrix) — group children become rows, their shared `answerOption[]` values become columns; each cell is a radio button. Widely used in clinical scales (PHQ-9, AUDIT, GAD-7). Round-tripped verbatim; falls back to stacked layout in preview. |

> Note: `title` is **not** a valid `questionnaire-item-control` code in FHIR R4 — the code system defines group controls (`list`, `table`, `htable`, `gtable`, `atable`, `header`, `footer`), text/display controls (`inline`, `prompt`, `unit`, `lower`, `upper`, `flyover`, `help`), and question controls only.

---

### SDC extensions (item-level)

| Extension | Status | Notes |
|---|---|---|
| `sdc-questionnaire-variable` | ✅ | Questionnaire-level and item-level; editable in Variables panel |
| `sdc-questionnaire-calculatedExpression` | ✅ | FHIRPath; evaluated in topological order |
| `sdc-questionnaire-initialExpression` | ✅ | FHIRPath; evaluated on load and Re-init |
| `sdc-questionnaire-enableWhenExpression` | ✅ | FHIRPath visibility condition |
| `sdc-questionnaire-answerExpression` | ✅ | Dynamic answer options |
| `sdc-questionnaire-candidateExpression` | ✅ | Candidate/suggested answers |
| `sdc-questionnaire-hidden` | ✅ | Permanently hidden from patients |
| `sdc-questionnaire-entryFormat` | ✅ | Placeholder hint text |
| `sdc-questionnaire-collapsible` | ✅ | default-closed / default-open groups |
| `sdc-questionnaire-openLabel` | ✅ | Custom open-choice placeholder label |
| `sdc-questionnaire-isSubject` | ✅ | Marks QR subject item |
| `sdc-questionnaire-columnCount` | ✅ | Multi-column choice layout |
| `sdc-questionnaire-choiceColumn` | ✅ | Multi-column dropdown definition |
| `sdc-questionnaire-itemMedia` | ✅ | Image/audio/video inline before the control |
| `sdc-questionnaire-answerMedia` | ✅ | Media attached to individual answer options (round-trip; rendered in preview) |
| `sdc-questionnaire-shortText` | ✅ | Abbreviated label for summary views |
| `sdc-questionnaire-preferredTerminologyServer` | ✅ | Per-item terminology server override |
| `sdc-questionnaire-observationExtract` | ✅ | Observation-based extraction flag; extraction runs client-side |
| `sdc-questionnaire-itemContext` | 🔄 | FHIRPath context for server-side population; round-tripped |
| `sdc-questionnaire-itemPopulationContext` | 🔄 | Server-side population context expression; round-tripped |
| `sdc-questionnaire-itemExtractionContext` | 🔄 | Extraction context; round-tripped |
| `sdc-questionnaire-subQuestionnaire` | 🔄 | Inline sub-questionnaire reference; round-tripped; not resolved (requires server assembly) |

---

### SDC extensions (questionnaire root-level)

| Extension | Status | Notes |
|---|---|---|
| `sdc-questionnaire-variable` | ✅ | Editable in Variables panel |
| `sdc-questionnaire-launchContext` | ✅ | Full editing UI in Properties → Launch Context |
| `sdc-questionnaire-preferredTerminologyServer` | ✅ | Editable in Properties → Terminology Server |
| `sdc-questionnaire-definitionExtract` | 🔧 | Client-side extraction via Save ▾ → Definition Extract; `itemExtractionContext` and StructureMap paths not evaluated |
| `sdc-questionnaire-assembleExpectation` | 🔄 | Assembly flag; round-tripped via `_rawQuestExtensions` |
| `sdc-questionnaire-endpoint` | 🔄 | QR submission endpoint; round-tripped |
| `sdc-questionnaire-performerType` | 🔄 | Performer type restriction; round-tripped |
| `sdc-questionnaire-sourceQueries` / `contextExpression` | 🔄 | Server-side batch queries; round-tripped |
| `sdc-questionnaire-targetStructureMap` | 🔄 | QR→resource StructureMap; round-tripped; requires server engine to execute |
| `sdc-questionnaire-sourceStructureMap` | 🔄 | Pre-population StructureMap; round-tripped; requires server engine to execute |
| `sdc-questionnaire-lookupQuestionnaire` | 🔄 | Server-side lookup reference; round-tripped |
| `sdc-questionnaire-width` | 🔄 | Table column width hint; round-tripped; table layout not implemented |

---

### R5 fields (with R4 downgrade)

| Field | Status | Notes |
|---|---|---|
| `item.disabledDisplay` | 🔧 | R5 native; downgraded to builder-private extension on R4/R4B export; lossless round-trip |
| `item.answerConstraint` | 🔧 | R5 native; downgraded to builder-private extension on R4/R4B export; lossless round-trip |
| `versionAlgorithm[x]` | ✅ | R5 native field (string or Coding). Editable in Properties → Advanced (standard Version Algorithm code set, or a custom FHIRPath string). Native on R5 export; on R4/R4B export written as the official `artifact-versionAlgorithm` extension. Read from either form on import. Lossless round-trip on all versions. |
| `copyrightLabel` | ✅ | R5 native field. Editable in Properties → Advanced (Copyright Label). Native on R5 export; on R4/R4B export written as the official `artifact-copyrightLabel` extension. Read from either form on import. Lossless round-trip on all versions. |

---

### STU3 import

| Feature | Status | Notes |
|---|---|---|
| STU3 → R4 normalisation | ✅ | `item.option[]` → `answerOption[]`, `item.options` → `answerValueSet`, `hasAnswer` → `exists`, typed `initial<T>` → `initial[{value<T>}]` |
| STU3 export | ❌ | Export always produces R4/R4B/R5; no STU3 output |



---

## HAPI FHIR R4 Validator — Known Gaps & Limitations

Based on running all `sampledata/*.fhir.json` files against `https://hapi.fhir.org/baseR4/Questionnaire/$validate` (June 2026).

### R5-only features — downgraded to builder-private extensions on R4/R4B export

These fields are **native in R5 only**. On R4/R4B export the builder moves them into builder-private extensions (the official HL7 cross-version extension URLs are rejected by public HAPI) so the document stays schema-valid and round-trips losslessly on re-import. A validator may emit an informational "unknown extension" warning.

| Feature | Native property | Downgrade extension (R4/R4B) | Available natively in |
|---|---|---|---|
| `disabledDisplay` | `Questionnaire.item.disabledDisplay` | `.../StructureDefinition/item-disabledDisplay` | R5 |
| `answerConstraint` | `Questionnaire.item.answerConstraint` | `.../StructureDefinition/item-answerConstraint` | R5 |
| SDC extensions (`calculatedExpression`, `enableWhenExpression`, `collapsible`, `openLabel`, etc.) | Various `http://hl7.org/fhir/uv/sdc/...` URLs | SDC IG (any FHIR version) | HAPI R4 server doesn't load SDC IG definitions; validator flags them as unknown |
| SDC profile reference (`meta.profile`) | `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire` | SDC IG | HAPI R4 server does not host SDC profiles; flagged as unresolvable |

### Unavoidable HAPI R4 validator limitations

These warnings appear for well-formed, spec-compliant resources and cannot be avoided:

| Warning | Root cause | Disposition |
|---|---|---|
| `"A code with no system has no defined meaning"` | Previously, simple option lists stored `code`+`display` without `system`; now `system` is optional per-option via the Answer Type modal System column and `_optionSystems` map | Fixed for options with system set; accept for options intentionally without system (`system` is optional in FHIR `Coding`) |
| `"codeSystem 'http://loinc.org' version 'null' is not supported"` | HAPI public sandbox does not load LOINC (licensing); `code.system = LOINC` cannot be validated | Accept — well-formed FHIR; LOINC validation requires a licensed terminology server |
| `"Unable to resolve resource with reference 'Practitioner/...' "` | Demo data uses relative references to non-existent resources on public HAPI | Accept — demo-only; valid FHIR structure |
| SNOMED CT `not-present` / coded values | HAPI public sandbox does not load SNOMED | Accept — well-formed FHIR |

### SDC server operations — supported

See **[SDC Operations](#sdc-operations)** section above.


