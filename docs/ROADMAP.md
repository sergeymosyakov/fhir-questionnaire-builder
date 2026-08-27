# ROADMAP

**Audience:** Developers and FHIR integration engineers (Variant B).  
**Feature filter:** Does it support Scenario 1 (edit & round-trip), 2 (build from scratch), or 3 (logic testing)?  
See [CONTEXT.md](CONTEXT.md) for scenario definitions.

---

## Next

### Client-side capability gaps (no server required)

These are the honest feature gaps vs. competitors (see [COMPETITORS.md](COMPETITORS.md)) that can be closed **entirely in the browser** — no backend, no our-server dependency. Profiles/StructureDefinitions are supplied by file upload or canonical fetch. Ordered by planned implementation.

1. [ ] **CQL execution — external Library resolution & terminology.** Self-contained CQL execution now works (`text/cql-identifier` initialExpression backed by a `cqf-library`) for a `#id` contained `Library` carrying embedded precompiled ELM — see [FHIR-MAPPING.md](FHIR-MAPPING.md) "CQL execution". Not yet supported: (a) resolving an **external absolute canonical** `Library` URL from a live FHIR server (e.g. the real WHO SMART Guidelines EmCare/IMCI `Library`, `.../Library/emcaretreatment|0.0.142`, referenced by `sampledata/who-emcare-treatment.fhir.json`) — needs canonical+version fetch, CORS, and is unproven against a library that large/complex; (b) terminology/VSAC-backed CQL (`cql-exec-vsac`) for `define`s that do real ValueSet membership checks; (c) `calculatedExpression` with CQL (scoped out — no observed real-world usage, and it would need the calc pass to become async). Kept as an honest open gap.

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
