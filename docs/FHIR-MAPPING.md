# FHIR R4 Mapping Specification

How the internal node model maps to and from FHIR R4 `Questionnaire` JSON.

---

## Internal Node Model

Every node in the tree is either a **group** or an **item**:

```js
// Group
{
  id:              string,          // FHIR linkId
  type:            'group',
  title:           string,          // FHIR item.text
  mandatory:       true|false|null, // null = not set (omit required from FHIR)
  visibilityRule:  string,          // JS expression, see "Show When" below
  conditionRule:   string,          // JS expression for applicability (N/A state)
  logicWithParent: 'AND'|'OR',      // FHIR enableBehavior
  children:        Node[]
}

// Item
{
  id:             string,
  type:           'item',
  title:          string,
  mandatory:      true|false|null,
  visibilityRule: string,
  conditionRule:  string,
  itemType:       'text'|'number'|'date'|'url'|'attachment'|'checkbox'|'select'|'radio'|'display',
  options:        string,           // comma-separated, used by select/radio
  successValue:   string,           // expected answer for pass/fail check
  _renderStyle:   string,           // inline CSS (from rendering-style extension)
  _calculatedExpr:string,           // FHIRPath expression (SDC calculatedExpression)
  _readOnly:      boolean,          // FHIR item.readOnly
  _enableWhenText:string            // human-readable condition label (UI only, not persisted)
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
| `logicWithParent: 'OR'` | `item.enableBehavior: 'any'` | |
| `logicWithParent: 'AND'` | `item.enableBehavior` absent | default |
| `children` | `item.item[]` | recursive |

### Item-specific

| Internal field | FHIR field / extension | Notes |
|---|---|---|
| `options` | `item.answerOption[]` | comma-split → `valueCoding.{code, display}` on export; reverse on import |
| `_renderStyle` | `item._text.extension[rendering-style]` | standard FHIR `rendering-style` extension |
| `_calculatedExpr` | SDC `sdc-questionnaire-calculatedExpression` extension (`valueExpression.expression`) | FHIRPath |
| `_readOnly` | `item.readOnly` | |
| `_prefix` | `item.prefix` | import only; displayed in preview before item title; not written back on export |

---

## Show When (visibilityRule)

Controls whether the item/group is **visible** in the preview.

### Export

Simple patterns (produced by the visual builder) are converted to standard FHIR `enableWhen[]`:

| JS pattern | FHIR enableWhen |
|---|---|
| `values['id'] == true` | `{ question:'id', operator:'=', answerBoolean:true }` |
| `values['id'] == false` | `{ question:'id', operator:'=', answerBoolean:false }` |
| `values['id'] == 'text'` | `{ question:'id', operator:'=', answerString:'text' }` |
| `values['id'] == 42` | `{ question:'id', operator:'=', answerInteger:42 }` |
| `values['id'] != ...` | operator `!=` |
| `values['id'] > / < / >= / <=` | numeric operators |

Complex / free-form JS that doesn't match the pattern → stored as custom extension:
```json
{
  "url": "http://logicbuilder.example.org/extension/visibilityRule",
  "valueString": "age > 18 && bmi > 35"
}
```

### Import

1. Custom extension `visibilityRule` → restored as-is
2. Standard `enableWhen[]` → converted to JS: `values['linkId'] == value`
3. `enableWhen` also generates `_enableWhenText` (human-readable label shown in preview UI)

---

## Applicability Rule (conditionRule)

Controls whether a group is **applicable** (shows as N/A when false). Not a FHIR standard field.

Always stored as custom extension:
```json
{
  "url": "http://logicbuilder.example.org/extension/conditionRule",
  "valueString": "proc === '43644'"
}
```

Round-trips cleanly. Not converted to `enableWhen`.

---

## Success Value (successValue)

Expected answer string for pass/fail evaluation of an item. Not a FHIR standard field.

Always stored as custom extension:
```json
{
  "url": "http://logicbuilder.example.org/extension/successValue",
  "valueString": "true"
}
```

---

## Extensions Summary

| Extension URL | Type | Field | Standard? |
|---|---|---|---|
| `http://logicbuilder.example.org/extension/visibilityRule` | custom | `visibilityRule` (complex JS) | No |
| `http://logicbuilder.example.org/extension/conditionRule` | custom | `conditionRule` | No |
| `http://logicbuilder.example.org/extension/successValue` | custom | `successValue` | No |
| `http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl` | standard | `itemType: 'radio'` | Yes |
| `http://hl7.org/fhir/StructureDefinition/rendering-style` | standard | `_renderStyle` | Yes |
| `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-calculatedExpression` | SDC | `_calculatedExpr` | Yes (SDC) |

---

## What Is Lost on Round-Trip

| Field | Lost? | Reason |
|---|---|---|
| `_enableWhenText` | Yes (intentional) | UI label, regenerated from `enableWhen` on import |
| `autoFilledIds` | Yes (intentional) | Runtime UI state only |
| Multiple `enableWhen` conditions | Partial | Imported as `&&`-joined JS; re-exported as single `enableWhen` entry if simple, else as extension |

---

## Not Supported (Out of Scope)

The following FHIR R4 / SDC features are currently not handled. Items marked ⚠️ produce silent data loss on import.

| Feature | FHIR field / extension | Status |
|---|---|---|
| Repeating items | `item.repeats: true`, `item.maxOccurs` | ⚠️ ignored on import |
| Answer value sets | `item.answerValueSet` | ⚠️ ignored; use `answerOption[]` |
| Initial values | `item.initial[]` | ⚠️ ignored on import |
| SDC variables | `sdc-questionnaire-variable` extension | ⚠️ ignored |
| SDC initial expression | `sdc-questionnaire-initialExpression` | ⚠️ ignored |
| Questionnaire constraints | `questionnaire-constraint` extension | ⚠️ ignored |
| Item prefix | `item.prefix` (e.g. `"1.1"`) | ⚠️ ignored on export |
| Item codes | `item.code[]` | ⚠️ ignored |
| `contained` resources | `Questionnaire.contained[]` | ⚠️ ignored |
| Multiple `enableWhen` on items with `enableBehavior` | `item.enableBehavior` | Partial: imported as `&&`-joined JS; re-exported as extension |
| Resource reference resolution | `type: 'reference'` | ⚠️ dropdown + id text field; no live resource search against a FHIR server |
| FHIR versions other than R4 | STU3, R5 | Not tested; may partially work |
