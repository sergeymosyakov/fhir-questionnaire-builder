# Questionnaire & items

Everything you build is a single FHIR **`Questionnaire`** resource. A
questionnaire is a *tree of items* — each node in the builder's left panel is one
`item` in that tree.

## The three kinds of item

Every item falls into one of three roles:

| Role | FHIR `item.type` | What it is |
|---|---|---|
| **Group** | `group` | A container with no answer of its own. Holds child items and gives the form its section structure. |
| **Question** | `text`, `integer`, `choice`, … | Captures an answer from the user. Has an answer type (see below). |
| **Display** | `display` | Static text shown to the user — instructions, headings, help. Captures nothing. |

Groups can be nested to any depth, so a questionnaire is a proper tree: root
groups → sub-groups → questions and display items.

## linkId

Every item has a **`linkId`** — a stable identifier that is unique within the
questionnaire. It ties a question in the `Questionnaire` to its answer in the
generated `QuestionnaireResponse`, and it is what `enableWhen` rules and
FHIRPath expressions reference. The builder assigns one automatically; you can
edit it, but it must stay unique.

## Answer types

A question item's **answer type** maps directly to a FHIR `item.type`. The
builder exposes them through the **Answer Type** editor:

| Builder answer type | FHIR `item.type` |
|---|---|
| Text (single- or multi-line) | `string` / `text` |
| Integer | `integer` |
| Decimal | `decimal` |
| Quantity | `quantity` |
| Boolean (checkbox) | `boolean` |
| Choice — radio, drop-down or checkboxes | `choice` |
| Open choice (choice + free text) | `open-choice` |
| Date | `date` |
| Date & time | `dateTime` |
| Time | `time` |
| URL | `url` |
| Attachment | `attachment` |
| Reference | `reference` |

`choice` questions render as radio buttons, a drop-down or a checklist depending
on the display variant you pick — the underlying FHIR type stays `choice`. How
to define the options (inline, a contained ValueSet, or a dynamic expression) is
covered in [Answer types & value sets](answer-types.md).

## Item properties

Beyond type, each item can carry:

- **Text** — the question or section label shown to the user.
- **Prefix** — an optional number or code shown before the text (e.g. `1.`, `Q3`).
- **Required** / **Repeats** — whether an answer is mandatory and whether the
  item can occur more than once.
- **Read-only**, **initial value**, and other SDC behaviours configured in the
  item's editor.

## How the tree becomes FHIR

The left-panel tree *is* the `Questionnaire.item` array. Reordering, nesting and
renumbering items in the builder rewrites that structure directly, and the
right-hand preview re-renders the live form from it on every edit. Export at any
time via **Save ▾ → Questionnaire · FHIR JSON**.

---

Next: [enableWhen & conditional logic](enablewhen.md).
