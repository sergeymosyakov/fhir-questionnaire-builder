# ROADMAP

**Audience:** Developers and FHIR integration engineers (Variant B).  
**Feature filter:** Does it support Scenario 1 (edit & round-trip), 2 (build from scratch), or 3 (logic testing)?  
See [CONTEXT.md](CONTEXT.md) for scenario definitions.

---

## Next

### Client-side capability gaps (no server required)

These are the honest feature gaps vs. competitors (see [COMPETITORS.md](COMPETITORS.md)) that can be closed **entirely in the browser** — no backend, no our-server dependency. Profiles/StructureDefinitions are supplied by file upload or canonical fetch. Ordered by planned implementation.

1. [ ] **StructureMap execution** — _deferred._ Actually **execute** FHIR Mapping Language (`targetStructureMap` / `sourceStructureMap`) for extraction/population in-browser (currently round-tripped only, not executed). Largest single gap. **Research (Jul 2026):** no mature, permissively-licensed, browser-capable JS library exists — `fhirmapping` is abandoned (2019, version-conversion only), `fume-fhir-converter` is AGPL + server-oriented; reference engines are server-side (HAPI/matchbox in Java, Firely in .NET). Options when revisited: (A) build a bounded FML/StructureMap-JSON interpreter for a documented transform subset (copy/create/evaluate) using the bundled `fhirpath`; or (B) integrate an external `$transform`-capable server (mirrors the existing `$populate` flow, but requires a server). Kept as an honest open gap.
2. [ ] **`atable` itemControl renderer** — _deferred._ Render a group as an answer table (`itemControl = atable`): column headers, repeating rows. Unblocks the deferred "translate `atable` column headers" item below.

### Horizon 2 — SDC completeness (extraction & population)

Supports Scenario 1 (round-trip) and Scenario 3 (logic testing). This is where most industrial-grade SDC complexity lives.

## Near-term

- [ ] **Performance regression test** — automated test with 200–300 item questionnaire covering deep nesting (depth 6–8), heavy `enableWhen`, and multiple `calculatedExpression` chains; assert render time stays under threshold

## Technical Debt

### Translation feature — known gaps and planned improvements

The following translation improvements are still outstanding:

- [ ] **Configurable translation provider** — the endpoint **URL** is now configurable in Settings (**Translation API → Endpoint URL**, stored under `serverConfig` key `translateApiUrl`, falling back to Google `gtx`). Still deferred: a full **provider picker** to switch protocol/auth between `gtx` (free, no key), DeepL free tier (requires key), LibreTranslate (self-hosted), or OpenAI — currently only `gtx`-compatible endpoints (same query params/response shape) are supported, so a custom URL must speak the `gtx` protocol.
- [ ] **`atable` itemControl support for translated answer option labels** — the `atable` renderer (when implemented) needs to read `rc.translations[lang].opts` for column headers.

## Later

- [ ] **Sub-questionnaire / modular questionnaires** — SDC `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-subQuestionnaire`; requires FHIR server for resolution; out of scope until server integration exists

---
