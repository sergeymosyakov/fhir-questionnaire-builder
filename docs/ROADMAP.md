# ROADMAP

**Audience:** Developers and FHIR integration engineers (Variant B).  
**Feature filter:** Does it support Scenario 1 (edit & round-trip), 2 (build from scratch), or 3 (logic testing)?  
See [CONTEXT.md](CONTEXT.md) for scenario definitions.

---

## Next

### Client-side capability gaps (no server required)

These are the honest feature gaps vs. competitors (see [COMPETITORS.md](COMPETITORS.md)) that can be closed **entirely in the browser** — no backend, no our-server dependency. Profiles/StructureDefinitions are supplied by file upload or canonical fetch. Ordered by planned implementation.

1. [ ] **StructureMap execution** — _deferred._ Actually **execute** FHIR Mapping Language (`targetStructureMap` / `sourceStructureMap`) for extraction/population in-browser (currently round-tripped only, not executed). Largest single gap. **Research (Jul 2026):** no mature, permissively-licensed, browser-capable JS library exists — `fhirmapping` is abandoned (2019, version-conversion only), `fume-fhir-converter` is AGPL + server-oriented; reference engines are server-side (HAPI/matchbox in Java, Firely in .NET). Options when revisited: (A) build a bounded FML/StructureMap-JSON interpreter for a documented transform subset (copy/create/evaluate) using the bundled `fhirpath`; or (B) integrate an external `$transform`-capable server (mirrors the existing `$populate` flow, but requires a server). Covers data-structure transforms only — CQL logic is a separate gap (see item 2). Kept as an honest open gap.
2. [ ] **CQL execution** — _deferred._ Actually **execute** Clinical Quality Language used by SDC via `text/cql-identifier` expressions (`initialExpression` / `calculatedExpression`) backed by a `cqf-library`. Currently round-tripped only, not executed — so forms whose inputs are CQL-populated (e.g. WHO SMART Guidelines EmCare/IMCI) render with **all conditional items hidden**: the FHIRPath `enableWhen` we *do* evaluate reads answers that only CQL would populate (`AgeInMonths`, `load-*` danger-sign booleans). Distinct from StructureMap execution — CQL computes clinical **values**, not data-structure transforms. **Blockers:** the logic isn't in the questionnaire (only a canonical `Library` URL, e.g. `.../Library/emcaretreatment|0.0.142`); CQL→ELM compilation is Java-only (no mature browser path); JS `cql-execution` runs **ELM**, not CQL source, and still needs a wired FHIR data provider + terminology provider + patient context. Options when revisited: (A) integrate an external `$cql` / `$evaluate`-capable server (mirrors the `$populate` / `$validate` flow, needs a server); or (B) consume precompiled ELM from the referenced `Library` and embed a JS ELM engine (`cql-execution` + `cql-exec-fhir`) with an in-memory data bundle. In the meantime a CQL-driven form can be revived without an engine by supplying the input values directly (a QuestionnaireResponse, static `item.initial`, or by un-hiding the inputs). Kept as an honest open gap.
3. [ ] **`atable` itemControl renderer** — _deferred._ Render a group as an answer table (`itemControl = atable`): column headers, repeating rows. Unblocks the deferred "translate `atable` column headers" item below.

### Horizon 2 — SDC completeness (extraction & population)

Supports Scenario 1 (round-trip) and Scenario 3 (logic testing). This is where most industrial-grade SDC complexity lives.

## Near-term


## Technical Debt

### Translation feature — known gaps and planned improvements

The following translation improvements are still outstanding:

- [ ] **Configurable translation provider** — the endpoint **URL** is now configurable in Settings (**Translation API → Endpoint URL**, stored under `serverConfig` key `translateApiUrl`, falling back to Google `gtx`). Still deferred: a full **provider picker** to switch protocol/auth between `gtx` (free, no key), DeepL free tier (requires key), LibreTranslate (self-hosted), or OpenAI — currently only `gtx`-compatible endpoints (same query params/response shape) are supported, so a custom URL must speak the `gtx` protocol.
- [ ] **`atable` itemControl support for translated answer option labels** — the `atable` renderer (when implemented) needs to read `rc.translations[lang].opts` for column headers.

### Visual Expression Builder — follow-ups

- [ ] **"Build…" launcher in the FHIRPath tester** — the dev console (`js/ui/fhirpath-console.js`, ⚙ Settings) shares `evalFhirpath` with the builder but has no visual builder button. Add a **🧩 Build…** launcher (resultKind `auto`/chooser) whose `onInsert` drops the assembled expression into the console input (scratch eval, not written to a node).
- [ ] **Undo for expression-field edits** — editing `enableWhenExpression` / `calculatedExpression` (via the textarea *or* the visual builder) dispatches `CALC_RECALC_REQUESTED` but not `RESPONSE_CHANGED`/`REINIT_FORM`, so `history.js` takes no snapshot — these edits aren't individually undoable. Pre-existing (affects the manual textarea too); the builder is consistent with it. Wire a history snapshot for expression edits without forcing a full `REINIT_FORM` rebuild.

## Later

- [ ] **Sub-questionnaire / modular questionnaires** — SDC `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-subQuestionnaire`; requires FHIR server for resolution; out of scope until server integration exists

---
