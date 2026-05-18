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
  children:            Node[]
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
  itemType:            'text'|'integer'|'decimal'|'date'|'url'|'attachment'|'checkbox'|'select'|'radio'|'open-choice'|'quantity'|'reference'|'display', // 'number' legacy alias
  options:             string,           // comma-separated, used by select/radio/open-choice
  repeats:             boolean,          // FHIR item.repeats — multi-row input in preview
  _renderStyle:        string,           // inline CSS (from rendering-style extension)
  _calculatedExpr:     string,           // FHIRPath expression (SDC calculatedExpression)
  _initialExpr:        string,           // FHIRPath expression (SDC initialExpression) — evaluated once on import + Re-init
  _readOnly:           boolean,          // FHIR item.readOnly
  _enableWhenText:     string,           // human-readable condition label (UI only, not persisted)
  _initialValue:       any,              // FHIR item.initial[0] value; pre-fills values[] on import
  _maxLength:          integer,          // FHIR item.maxLength
  _minOccurs:          integer,          // questionnaire-minOccurs extension (when repeats: true)
  _maxOccurs:          integer,          // questionnaire-maxOccurs extension (when repeats: true; enforced in preview)
  _answerValueSet:     string            // FHIR item.answerValueSet URL — preserved round-trip; not resolved to options
}
```

---

## Item Type Mapping

### Import: `item.type` → `itemType`

| FHIR `item.type` | `itemType` | Notes |
|---|---|---|
| `boolean` | `checkbox` | |
| `integer` | `integer` | Stored as `valueInteger` in QR; use `.answer.valueInteger` in FHIRPath constraints |
| `decimal` | `decimal` | Stored as `valueDecimal` in QR; use `.answer.valueDecimal` in FHIRPath constraints |
| `quantity` | `quantity` | UCUM unit dropdown; `questionnaire-unit` extension read/written |
| `string`, `text` | `text` | |
| `reference` | `reference` | dropdown (resource type) + id input; `questionnaire-referenceResource` extension locks dropdown to one type |
| `choice` | `select` | unless `questionnaire-itemControl: radio-button` → `radio` |
| `choice` + itemControl `radio-button` | `radio` | see Extensions section |
| `open-choice` | `open-choice` | text input + `<datalist>` suggestions from `answerOption[]`; free-text allowed |
| `display` | `display` | label only, no control, no pass/fail |
| `date`, `dateTime`, `time` | `date` | all three map to native date-picker |
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

### Item-specific

| Internal field | FHIR field / extension | Notes |
|---|---|---|
| `options` | `item.answerOption[]` | comma-split → `valueCoding.{code, display}` on export; reverse on import |
| `_renderStyle` | `item._text.extension[rendering-style]` | standard FHIR `rendering-style` extension |
| `_calculatedExpr` | SDC `sdc-questionnaire-calculatedExpression` extension (`valueExpression.expression`) | FHIRPath |
| `_initialExpr` | SDC `sdc-questionnaire-initialExpression` extension (`valueExpression.expression`) | FHIRPath; evaluated once on import and on Re-init; result pre-fills `values[]` |
| `_readOnly` | `item.readOnly` | |
| `_prefix` | `item.prefix` | imported and exported; displayed as amber badge in preview; editable in builder meta-row |
| `_codes` | `item.code[]` | imported and exported unchanged (round-trip safe); not displayed in UI |
| `_maxLength` | `item.maxLength` | imported → `node._maxLength`; exported back when set; not enforced in UI |
| `_minOccurs` | `questionnaire-minOccurs` ext (`valueInteger`) | imported/exported when `node.repeats === true` |
| `_maxOccurs` | `questionnaire-maxOccurs` ext (`valueInteger`) | imported/exported when `node.repeats === true`; enforced in preview — add button disabled at limit |
| `_answerValueSet` | `item.answerValueSet` | imported → `node._answerValueSet`; exported back unchanged; URL not resolved — items show no selectable options in the builder |
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
| `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-calculatedExpression` | SDC | `_calculatedExpr` | Yes (SDC) |
| `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-initialExpression` | SDC | `_initialExpr` | Yes (SDC) |
| `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-variable` | SDC | `questVariables[]` on root | Yes (SDC) |
| `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-enableWhenExpression` | SDC | `enableWhenExpression` | Yes (SDC) |
| `http://hl7.org/fhir/StructureDefinition/questionnaire-constraint` | standard | `constraint[]` | Yes |
| `http://hl7.org/fhir/StructureDefinition/questionnaire-unit` | standard | `quantityUnit` (quantity default unit) | Yes |
| `http://hl7.org/fhir/StructureDefinition/questionnaire-referenceResource` | standard | `referenceResource` (reference type lock) | Yes |
| `http://hl7.org/fhir/StructureDefinition/questionnaire-minOccurs` | standard | `_minOccurs` (min repeat rows required) | Yes |
| `http://hl7.org/fhir/StructureDefinition/questionnaire-maxOccurs` | standard | `_maxOccurs` (max repeat rows; enforced in preview) | Yes |

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

---

## Not Supported / Partial Support

Items marked ⚠️ produce silent data loss on import.

| Feature | FHIR field / extension | Status |
|---|---|---|
| Answer value sets | `item.answerValueSet` | ⚠️ URL preserved round-trip; not resolved — items using `answerValueSet` have no answer options in the builder |
| `contained` resources | `Questionnaire.contained[]` | ⚠️ Resources preserved round-trip; viewable as JSON in the Contained card; not otherwise processed |
| Resource reference resolution | `type: 'reference'` | ⚠️ partial — dropdown (resource type) + id text input; no live search against a FHIR server |
| FHIR versions other than R4 | STU3, R5 | Not tested; may partially work |
