# ROADMAP

**Audience:** Developers and FHIR integration engineers (Variant B).  
**Feature filter:** Does it support Scenario 1 (edit & round-trip), 2 (build from scratch), or 3 (logic testing)?  
See [docs/CONTEXT.md](docs/CONTEXT.md) for scenario definitions.

---

## Now

- [ ] **Multi-condition visual builder** — AND/OR between multiple enableWhen conditions in the Visibility panel; UI over the existing `visibilityRule` JS expression (removes the need to type JS manually for compound conditions)
- [ ] **JS rule error highlighting** — catch syntax/runtime errors in `visibilityRule` / `conditionRule` fields; show error message in the builder panel (currently fails silently)

## Next

- [ ] **Patient presets** — 3–4 quick-switch patient buttons (e.g. Child, Adult F, Obese M); replaces manual field-by-field editing for faster Scenario 3 testing
- [ ] **`open-choice` free-text rendering** — text input alongside `answerOption[]` suggestions in preview; currently silently rendered as plain `select`
- [ ] **`answerValueSet` warning** — show import warning when `answerValueSet` is used (currently silently dropped)
- [ ] **More sample data** — 2–3 additional questionnaires covering different complexity levels, with documented expected PASS/FAIL outcomes per patient profile

## Later

- [ ] Unit tests for `eval.js` and `fhir/import.js` (no DOM; plain Node.js runner)
- [x] `item.prefix` support (numbered questions, e.g. `"1.1"`)
- [ ] Repeating items (`item.repeats: true` / `maxOccurs`)
- [ ] SDC `variable` and `initialExpression` extension support
- [ ] FHIR STU3 import compatibility shim
- [ ] External validator integration (link to HL7 / Simplifier validator, or local FHIR validation API call)
