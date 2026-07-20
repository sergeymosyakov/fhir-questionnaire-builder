# Extraction (definition & StructureMap)

**Extraction** is the step that turns a completed questionnaire into *other* FHIR
resources — for example creating `Observation`, `Condition` or `Patient` records
from the answers, rather than keeping them only as a `QuestionnaireResponse`. The
SDC guide defines a few ways to do this; the builder implements two of them and
is honest about the one it does not.

## Observation-based extraction

The simplest mechanism turns coded answers into `Observation` resources. You mark
the items you want extracted, and each coded question that has an answer becomes
one `Observation` (with status *final*). The builder inherits the extract flag
down the tree, so flagging a group opts in the questions beneath it; an explicit
"off" on a child overrides an inherited "on".

Produce the output from **Save ▾ → 🧪 Observations · FHIR JSON Bundle** — a
transaction `Bundle` of the extracted Observations.

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

## StructureMap-based extraction — not executed here

The SDC guide also defines a third, most powerful mechanism where a
**StructureMap** transforms the response into target resources. Running a
StructureMap requires a FHIR mapping-language engine, and the builder is a
dependency-free browser app with **no in-browser StructureMap engine**. So while
a questionnaire may *reference* a StructureMap, this tool does **not execute** that
transformation — you would run it on a FHIR server that supports the mapping
language. The two mechanisms above cover the common cases without a server.

## Where extraction runs

Both supported extractions are pure, in-browser transformations of the current
`Questionnaire` plus its live `QuestionnaireResponse` — no server round-trip is
needed. Fill in the form in the preview, then export the extracted Bundle from the
**Save** menu.

---

Next: [Preview, Patient View & FHIR JSON](preview-modes.md).
