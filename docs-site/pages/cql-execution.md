# CQL execution

The builder can execute [Clinical Quality Language](https://cql.hl7.org/) (CQL)
that a Questionnaire references for `initialExpression` — entirely in the
browser, no server required. This is the how-to; for the concept, see
[Extensions & SDC](extensions-sdc.md).

## What this is (plain language)

Some real-world questionnaires (e.g. WHO SMART Guidelines forms) don't compute a
value with a FHIRPath formula — they name a `define` from a separate CQL
**Library** instead (`language: text/cql-identifier`, e.g. `AgeInMonths`). The
Library is referenced from the questionnaire via a `cqf-library` extension. The
builder resolves that reference and actually runs the CQL, using
[cql-execution](https://github.com/cqframework/cql-execution) +
[cql-exec-fhir](https://github.com/cqframework/cql-exec-fhir) — the same engine
used by other CQL tooling in the FHIR ecosystem, not a stub.

## How to set it up

CQL can't be authored in the builder UI (the Expression modal only writes
FHIRPath) — a CQL-driven field arrives via import or sample data:

1. **Add a `Library` resource** to the questionnaire's **Contained Resources**
   panel. It must carry its logic as **precompiled ELM**, base64-encoded in
   `content[]` with `contentType: "application/elm+json"` (CQL text itself can
   also be included as a second `content[]` entry with `contentType: "text/cql"`,
   for reference — it isn't executed). CQL→ELM compilation happens outside the
   browser (e.g. the official `cql-to-elm` compiler); the builder only runs
   already-compiled ELM.
2. **Point the questionnaire at it**: set the root `cqf-library` extension to
   `#` followed by the Library's `id`.
3. **Set the item's Initial Expression language to `text/cql-identifier`**, with
   `expression` equal to the CQL `define` name to evaluate (e.g. `AgeInMonths`).

## Running it

There's no separate "run CQL" action — it's evaluated automatically wherever
`initialExpression` normally runs: once when the questionnaire loads, and again
whenever you click **↺ Re-init** in the Variables panel. Since the builder has
no real "current patient" resource, the CQL library is run against a `Patient`
synthesized from the Patient panel's **%age** value — apply a preset or a custom
age (Patient ▾ → preset, or Custom…) and re-init to see the computed value
change.

## Current scope

- Only a **`#id` contained `Library`** with embedded `application/elm+json`
  content is resolvable — there's no server to fetch an external canonical
  `Library` URL from, and no in-browser CQL→ELM compiler (that's a Java-only
  toolchain industry-wide). A `cqf-library` pointing at an external URL still
  round-trips correctly, it just won't execute.
- Only **`initialExpression`** is supported, not `calculatedExpression`.
- Terminology/ValueSet-membership CQL (VSAC-backed `define`s) isn't wired up.

See [Roadmap & limitations](roadmap-limitations.md) for the open follow-up.

## Example

`sampledata/cql-execution-demo.fhir.json` in the sample library has a working,
fully self-contained example: a contained `Library` with a real compiled ELM
library, an `AgeInMonths` initial expression, and a second item whose visibility
depends on the computed value. Load it, apply a young-enough custom age (Patient
▾ → Custom… → Age), and click **↺ Re-init** to see it compute live.

---

Next: [Resolve from profile](resolve-profile.md).
