# Definition-based extraction

Definition-based extraction builds real FHIR resources — a `Patient`, a
`Condition`, an `Observation`, and so on — by mapping a questionnaire's answers to
the fields of those resources. This is the how-to; for the concept and how it
compares to the other mechanisms, see [Extraction](extraction.md).

## How the mapping works

Two pieces drive it:

1. **Mark a group as producing a resource.** A group annotated with the
   definition-extract extension becomes one resource instance. Its resource type
   comes from the definition on the group (or its children).
2. **Point each answer at a field.** Give the child items an `item.definition`
   that names the target element — a URL of the form
   `.../StructureDefinition/{Type}#{path}`. The answer to that item is written to
   that field on the new resource.

Nested paths such as `name.family` are supported and set as deep properties.

## Supported resource types

The engine can build common resources — `Patient`, `Condition`, `Observation`,
`Encounter`, `Practitioner`, `Medication`, `MedicationRequest`, `Procedure`,
`AllergyIntolerance` and other types with straightforward element paths.

## Running it

1. Fill in the form in the preview (or load a `QuestionnaireResponse`).
2. Open **Save ▾ → 🧩 Definition Extract · FHIR JSON Bundle**.
3. The builder produces a transaction `Bundle` containing one resource per
   annotated group, each populated from the mapped answers.

Everything runs in the browser — no server is required.

## When to use it vs. Observation extraction

Use **definition-based** extraction when you need to populate specific fields of
specific resource types (e.g. build a `Patient` and a `Condition`). Use
**Observation-based** extraction when you simply want each coded answer to become
an `Observation`. Both are described in [Extraction](extraction.md).

---

Next: [Resolve from profile](resolve-profile.md).
