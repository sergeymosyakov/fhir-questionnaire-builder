# Who it's for

This builder is **Variant B**: it surfaces FHIR concepts directly — `linkId`, `enableWhen`, extensions, FHIRPath — rather than hiding them behind a simplified UX. That framing decides who gets the most out of it.

## Primary audience

Developers and FHIR integration engineers who **build, inspect, or maintain logic-heavy questionnaires** in FHIR R4. If you work with FHIR `Questionnaire` resources — authoring them, debugging their logic, or checking how they round-trip — this tool is built for you.

It is **not** designed for direct use by clinicians or end users without FHIR training. Filling in a form for real patients is the job of a production *renderer*, not this authoring/testing tool.

## Simple vs Advanced view

The builder has two view modes, switched from the **⋯** menu in the builder header:

- **Simple** — hides the advanced per-item controls (States, Show When, Answer Type, Expression, etc.), leaving only *Add group/item*, rename, and delete. Good for laying out structure quickly.
- **Advanced** — shows every per-item control (all modal action links) on the builder tree.

Even in Simple view the tool still assumes familiarity with FHIR `Questionnaire` structure — it lowers the surface area, not the prerequisite knowledge.

## The Patient View is for testing, not data capture

The builder can preview a questionnaire in a clean **Patient View**, but this is a **testing surface** — it lets you drive `enableWhen`, calculated values, and validation against a chosen patient context to see how the form behaves. It is not intended as a production form-filling or data-collection UI.

## Helpful prerequisites

- **FHIR `Questionnaire` basics** — items, `linkId`, types, answer options.
- **For logic** — a working understanding of `enableWhen` and FHIRPath (`calculatedExpression`, `enableWhenExpression`).
- **For extraction / advanced SDC** — familiarity with the [SDC implementation guide](https://hl7.org/fhir/uv/sdc/).

New to these? Start with the [Quick tour](quick-tour.md), then the [Core Concepts](questionnaire-items.md).
