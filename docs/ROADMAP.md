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

## Technical Debt

### Translation feature — known gaps and planned improvements

The following translation improvements are still outstanding:

- [ ] **`atable` itemControl support for translated answer option labels** — the `atable` renderer (`js/nodes/choice-helpers.js`'s `_buildAtableControl`) reads plain `display` text for column headers; it doesn't yet consult `rc.translations[lang].opts` when a non-source language is active.

### Visual Expression Builder — follow-ups

- [ ] **"Build…" launcher in the FHIRPath tester** — the dev console (`js/ui/fhirpath-console.js`, ⚙ Settings) shares `evalFhirpath` with the builder but has no visual builder button. Add a **🧩 Build…** launcher (resultKind `auto`/chooser) whose `onInsert` drops the assembled expression into the console input (scratch eval, not written to a node).
- [ ] **Undo for expression-field edits** — editing `enableWhenExpression` / `calculatedExpression` (via the textarea *or* the visual builder) dispatches `CALC_RECALC_REQUESTED` but not `RESPONSE_CHANGED`/`REINIT_FORM`, so `history.js` takes no snapshot — these edits aren't individually undoable. Pre-existing (affects the manual textarea too); the builder is consistent with it. Wire a history snapshot for expression edits without forcing a full `REINIT_FORM` rebuild.
- [ ] **Deeper grouping / more math wrap functions** — the value editor's "Group" operand supports exactly one level of parenthesized nesting, and the final-result wrapper covers only `round`/`abs`/`ceiling`/`floor`/`truncate`. Expressions needing two+ levels of nesting or other FHIRPath math functions (`sqrt`, `ln`, `log`, `exp`, `power`) still fall back to raw text — a deliberate scope boundary, not a bug.

## Later

- [ ] **Sub-questionnaire / modular questionnaires** — SDC `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-subQuestionnaire`; requires FHIR server for resolution; out of scope until server integration exists

---
