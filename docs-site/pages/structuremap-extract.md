# StructureMap-based extraction

StructureMap-based extraction runs a real [FHIR Mapping Language](https://hl7.org/fhir/mapping-language.html)
transform against the current answers, entirely in the browser — no server
required. This is the how-to; for the concept and how it compares to the other
extraction mechanisms, see [Extraction](extraction.md).

## What a StructureMap is (plain language)

A `StructureMap` is its own small FHIR resource that describes a transform as a
set of rules — "take this field from the response, put it here on the output
resource". It's more powerful than definition-based extraction (it can compute,
rename, and restructure data, not just copy one field to one field), but it has
to be written as its own resource rather than a few extensions on the
questionnaire items.

The builder executes StructureMaps using
[fhir-structuremap-js](https://github.com/sergeymosyakov/fhir-structuremap-js), a
real, independent mapping-language engine — not a stub or approximation.

## How to set it up

1. **Get or write a `StructureMap` resource** (JSON) that transforms a
   `QuestionnaireResponse` into the resource(s) you want (e.g. a `Patient`). You
   can hand-write one, generate it from FHIR Mapping Language (FML) text with a
   tool of your choice, or reuse an existing one from an implementation guide.
2. **Add it to this questionnaire** via the **Contained Resources** panel
   (left side, below the tree) → **+ Add** → paste the StructureMap JSON. Give it
   an `id` you'll recognize, e.g. `"id": "qr-to-patient"`.
3. **Point the questionnaire at it**: open **Properties** (the ⓘ / gear button
   on the questionnaire header) → **Target StructureMap** → enter `#` followed by
   the StructureMap's `id`, e.g. `#qr-to-patient`.

Only a `#id` reference to a StructureMap you've added via Contained Resources can
be resolved — the builder has no server to fetch an external canonical URL from,
so a plain `https://...` reference in Target StructureMap can't be run here (it
will still round-trip correctly if you import/export a questionnaire that has
one).

## Running it

1. Fill in the form in the preview (or load a `QuestionnaireResponse`).
2. Open **Save ▾ → 🗺️ StructureMap Extract · FHIR JSON Bundle**.
3. The builder resolves the contained StructureMap, runs it against the current
   answers, and shows the resulting resource(s). Any problem (missing extension,
   StructureMap not found, a rule that fails) is shown as a plain-language
   warning instead of a silent empty result.
4. **Download Bundle** saves the output resources as a transaction `Bundle`.

## Current scope

- Only the **extraction** direction (`targetStructureMap`, response → resources)
  is set up above. See **Population** below for the reverse direction.
- Auto-created target resources are untyped unless your StructureMap rules set
  `resourceType` explicitly (there's no injected profile resolver) — the sample
  below shows the pattern.

## Population (pre-filling a response from a source resource)

The reverse direction — using a StructureMap to **pre-fill** answers from an
existing resource, instead of extracting resources from the answers — runs the
same way, entirely in the browser:

1. **Get or write a `StructureMap`** that transforms a source resource (e.g.
   `Patient`) into a `QuestionnaireResponse`.
2. **Add it to this questionnaire** via **Contained Resources**, same as for
   extraction.
3. **Point the questionnaire at it**: open **Properties** → **Source
   StructureMap** → enter `#` followed by the StructureMap's `id`, e.g.
   `#patient-to-qr`. Like Target StructureMap, only a contained `#id` reference
   can be resolved — there's no server to fetch an external canonical URL from.
4. **Run it**: **Answers ▾ → 🗺️ Fill via StructureMap…** opens a dialog to
   search for a patient by name (against your configured FHIR Base Server); the
   StructureMap then runs in-browser against that patient record to pre-fill the
   form's answers. No server-side `$populate` support is required — this is a
   client-side alternative to [`$populate`](populate.md) for questionnaires that
   already have a source StructureMap.

## Example

`sampledata/structuremap-extract-demo.fhir.json` in the sample library has a
working example: three simple text/date items, a contained StructureMap that
maps them onto a `Patient`, and `Target StructureMap` already set. Load it,
fill in the fields, and run **Save ▾ → StructureMap Extract** to see it end to
end.

---

Next: [CQL execution](cql-execution.md).
