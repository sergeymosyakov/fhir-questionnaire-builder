# How it compares

This page is an honest positioning of the builder against other FHIR
Questionnaire / SDC tools — written to set expectations, not to market.

## What this tool is

A **zero-backend, single-page browser app** served as static files. It combines a
visual questionnaire builder with a **live SDC runtime** (FHIRPath, `enableWhen`,
calculations, a real `QuestionnaireResponse`), plus import/export, extraction,
translation and REDCap conversion — all in the browser, with no install and no
server required.

## Fair comparisons

The apples-to-apples peers are other **browser-based questionnaire authoring
tools with a renderer**, such as NLM's LHC-Forms Form Builder and CSIRO's Smart
Forms.

Full healthcare **platforms** — Aidbox, Medplum, the Firely ecosystem — are a
different category. They bring a FHIR store, authentication and server-side
operations. This tool deliberately does **not** compete on that axis: there is no
backend to compare. When those platforms come up, only their authoring/runtime
slice is a meaningful comparison.

## Where it's strong

- Nothing to install or host — open a URL and build.
- The preview is a genuine SDC runtime, so logic behaves like a real client.
- Broad FHIR R4/R4B/R5 + SDC support with faithful round-tripping.
- Extras that many builders lack: Observation and definition-based extraction,
  machine translation, and REDCap ↔ FHIR conversion.

## Where it's not the right tool

- It is **not a platform**: no built-in FHIR server, no multi-user backend, no
  server-side storage beyond optional personal cloud save.
- Some server-dependent SDC operations (like `$populate`) require you to point it
  at an external server.
- StructureMap-based transformation is not executed in the browser — see
  [Roadmap & limitations](roadmap-limitations.md).

If you need a hosted, multi-user clinical data platform, use one of the platforms
above. If you need to author, test and round-trip FHIR questionnaires quickly in a
browser, this tool is built for exactly that.

---

Next: [Roadmap & limitations](roadmap-limitations.md).
