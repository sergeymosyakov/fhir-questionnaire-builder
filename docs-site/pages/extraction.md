# Extraction (definition & StructureMap)

**Extraction** is the step that turns a completed questionnaire into *other* FHIR
resources — for example creating `Observation`, `Condition` or `Patient` records
from the answers, rather than keeping them only as a `QuestionnaireResponse`. The
SDC guide defines a few ways to do this; the builder implements all three.

## Observation-based extraction

The simplest mechanism turns coded answers into `Observation` resources. You mark
the items you want extracted, and each coded question that has an answer becomes
one `Observation` (with status *final*). The builder inherits the extract flag
down the tree, so flagging a group opts in the questions beneath it; an explicit
"off" on a child overrides an inherited "on".

Produce the output from **Save ▾ → 🧪 Observations · FHIR JSON Bundle** — a
transaction `Bundle` of the extracted Observations. There is a dedicated how-to
for this: [Observation-based extraction](observation-extract.md).

*(Uses the SDC `observationExtract` flag and `questionnaire-unit` for numeric
units.)*

## Definition-based extraction

The second mechanism builds arbitrary resources by *mapping answers to resource
fields*. You annotate a group as producing one resource of a given type, and give
its child items an `item.definition` that names the target field. Each answer is
then written to that field on the new resource.

It supports common resource types — `Patient`, `Condition`, `Observation`,
`Encounter`, `Practitioner`, `Medication`, `MedicationRequest`, `Procedure`,
`AllergyIntolerance` and others — and handles both simple fields and nested paths
such as `name.family`.

Produce the output from **Save ▾ → 🧩 Definition Extract · FHIR JSON Bundle** — a
transaction `Bundle` of the mapped resources. There is a dedicated how-to for
this: [Definition-based extraction](definition-extract.md).

## StructureMap-based extraction

The SDC guide also defines a third, most powerful mechanism where a
**StructureMap** — its own FHIR resource describing a set of transform rules —
transforms the response into target resources. The builder runs this **in the
browser**, via a real, independent FHIR Mapping Language engine
([fhir-structuremap-js](https://github.com/sergeymosyakov/fhir-structuremap-js)),
no server required. The StructureMap must be added to the questionnaire's
Contained Resources (there's no server to fetch an external one from). There is
a dedicated how-to for this: [StructureMap-based extraction](structuremap-extract.md).

Only the extraction direction is executed today — *population* from a
`sourceStructureMap` (pre-filling a response from source resources) is still
round-tripped but not run; see [Roadmap & limitations](roadmap-limitations.md).

## Where extraction runs

All three extraction mechanisms are pure, in-browser transformations of the
current `Questionnaire` plus its live `QuestionnaireResponse` — no server
round-trip is needed. Fill in the form in the preview, then export the extracted
Bundle from the **Save** menu.

---

Next: [Preview, Patient View & FHIR JSON](preview-modes.md).
