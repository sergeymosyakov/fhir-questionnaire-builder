# What is this?

The **FHIR Questionnaire Builder** is a free, browser-based tool for **authoring, importing, testing, and exporting** HL7® FHIR® R4 `Questionnaire` resources — including the dynamic behaviour defined by the [Structured Data Capture (SDC)](https://hl7.org/fhir/uv/sdc/) implementation guide.

It runs entirely in your browser. There is **no backend, no account required, and nothing is uploaded** to a server unless you explicitly choose to (for example, cloud save or validating against an external FHIR server). It is served as static files from GitHub Pages.

## What it does

- **Build** a `Questionnaire` visually — groups, items, answer types, answer options, and value-set bindings.
- **Import & round-trip** existing FHIR `Questionnaire` JSON (R4, with STU3 normalised on import and R5-only fields preserved), with a documented, transparent mapping.
- **Test the logic live** — `enableWhen` / `enableWhenExpression` visibility, `calculatedExpression` / `initialExpression` chains, and FHIRPath constraints are evaluated in the browser against a patient context you choose.
- **Extract data** — definition-based extraction turns questionnaire answers into FHIR resources (a transaction `Bundle`).
- **Translate** a questionnaire into other languages and preview it per language.
- **Validate** — a built-in validator plus optional external FHIR `$validate`.
- **Export** clean FHIR JSON, or convert to/from a REDCap data dictionary.

## What it is *not*

Being honest about the boundaries matters more than marketing:

- It is **not** a FHIR server or a data store. It has no server-side API.
- It is **not** an industrial SDC engine — it does **not** execute StructureMap-based extraction/population (those are round-tripped but not run), and it does not resolve profiles against a terminology server for licensed code systems.
- It is **not** designed for direct use by clinicians without FHIR knowledge. It deliberately surfaces FHIR concepts (linkId, extensions, FHIRPath) rather than hiding them — see [Who it's for](who-its-for.md).

## Why use it

- **Trustworthy round-trip.** Every import ↔ export mapping is documented, and silent data loss is explicitly flagged.
- **A real logic runtime.** You can actually *see* how `enableWhen` and calculated expressions behave, driven by patient presets — not just author fields blindly.
- **Zero friction.** Open a URL, load a sample, start building. No install, no sign-up.

## Next steps

- [Who it's for](who-its-for.md) — is this the right tool for you?
- [Quick tour](quick-tour.md) — build and test a questionnaire in five minutes.
- [Core Concepts](questionnaire-items.md) — the FHIR ideas the builder is built around.
