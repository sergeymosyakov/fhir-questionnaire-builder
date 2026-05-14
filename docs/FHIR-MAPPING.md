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
  itemType:            'text'|'number'|'date'|'url'|'attachment'|'checkbox'|'select'|'radio'|'open-choice'|'quantity'|'reference'|'display',
  options:             string,           // comma-separated, used by select/radio/open-choice
  _renderStyle:        string,           // inline CSS (from rendering-style extension)
  _calculatedExpr:     string,           // FHIRPath expression (SDC calculatedExpression)
  _readOnly:           boolean,          // FHIR item.readOnly
  _enableWhenText:     string            // human-readable condition label (UI only, not persisted)
  _initialValue:       any               // FHIR item.initial[0] value; pre-fills values[] on import
}
```

---

## Item Type Mapping

### Import: `item.type` → `itemType`

| FHIR `item.type` | `itemType` | Notes |
|---|---|---|
| `boolean` | `checkbox` | |
| `integer`, `decimal` | `number` | |
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
| `number` | `decimal` | |
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
| `logicWithParent: 'OR'` | AND/OR preview badge | UI only; not exported |
| `logicWithParent: 'AND'` | *(default, not exported)* | UI only |
| `children` | `item.item[]` | recursive |

### Item-specific

| Internal field | FHIR field / extension | Notes |
|---|---|---|
| `options` | `item.answerOption[]` | comma-split → `valueCoding.{code, display}` on export; reverse on import |
| `_renderStyle` | `item._text.extension[rendering-style]` | standard FHIR `rendering-style` extension |
| `_calculatedExpr` | SDC `sdc-questionnaire-calculatedExpression` extension (`valueExpression.expression`) | FHIRPath |
| `_readOnly` | `item.readOnly` | |
| `_prefix` | `item.prefix` | imported and exported; displayed as amber badge in preview; editable in builder meta-row |
| `_codes` | `item.code[]` | imported and exported unchanged (round-trip safe); not displayed in UI |
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
| `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-variable` | SDC | `questVariables[]` on root | Yes (SDC) |
| `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-enableWhenExpression` | SDC | `enableWhenExpression` | Yes (SDC) |
| `http://hl7.org/fhir/StructureDefinition/questionnaire-constraint` | standard | `constraint[]` | Yes |
| `http://hl7.org/fhir/StructureDefinition/questionnaire-unit` | standard | `quantityUnit` (quantity default unit) | Yes |
| `http://hl7.org/fhir/StructureDefinition/questionnaire-referenceResource` | standard | `referenceResource` (reference type lock) | Yes |

---

## What Is Lost on Round-Trip

| Field | Lost? | Reason |
|---|---|---|
| `_enableWhenText` | Yes (intentional) | UI label, regenerated from `enableWhen` on import |
| Multiple `enableWhen` conditions | ✅ Preserved | Stored and exported as-is (`enableWhen[]` shallow copy) |

---

## Not Supported (Out of Scope)

The following FHIR R4 / SDC features are currently not handled. Items marked ⚠️ produce silent data loss on import.

| Feature | FHIR field / extension | Status |
|---|---|---|
| Repeating items | `item.repeats: true`, `item.maxOccurs` | ⚠️ ignored on import |
| Answer value sets | `item.answerValueSet` | ⚠️ ignored; use `answerOption[]` |
| Initial values | `item.initial[]` | ✅ `initial[0]` imported → `_initialValue`; pre-fills the form on load; editable via **Default** panel in builder; exported back as `initial[{value...}]` |
| SDC variables | `sdc-questionnaire-variable` extension | ✅ round-trip safe; collapsible card in left panel; editable via modal; evaluated as `%varName` in FHIRPath calculatedExpression |
| SDC initial expression | `sdc-questionnaire-initialExpression` | ⚠️ ignored |
| `questionnaire-constraint` extension | `questionnaire-constraint` extension | ✅ imported → `constraint[]`; exported back; **evaluated in preview** — amber ⚠️ or red ✘ badge per node; `error`+fail blocks Final Result |
| Multiple `enableWhen` on items with `enableBehavior` | `item.enableBehavior` | ✅ full round-trip via `enableWhen[]` + `enableBehavior` |
| Item prefix | `item.prefix` (e.g. `"1.1"`) | ✅ round-trip safe; amber badge in preview; editable in builder |
| Item codes | `item.code[]` (coding array) | ✅ round-trip safe; stored as `_codes`, not displayed in UI |
| `contained` resources | `Questionnaire.contained[]` | ⚠️ ignored |
| Resource reference resolution | `type: 'reference'` | ⚠️ dropdown + id text field; no live resource search against a FHIR server |
| FHIR versions other than R4 | STU3, R5 | Not tested; may partially work |
