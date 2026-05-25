# ROADMAP

**Audience:** Developers and FHIR integration engineers (Variant B).  
**Feature filter:** Does it support Scenario 1 (edit & round-trip), 2 (build from scratch), or 3 (logic testing)?  
See [CONTEXT.md](CONTEXT.md) for scenario definitions.

---

## Next

- [ ] **Supabase + GitHub OAuth** — user accounts (GitHub login); per-user questionnaire storage in Supabase (save / load / list); user settings (default FHIR server URL); no anonymous data; enables sharing questionnaires via URL slug. Unblocks the tool from being a REPL-only prototype into a real product.
- [ ] **More sample data** — 2–3 additional questionnaires covering different complexity levels, with documented expected PASS/FAIL outcomes per patient profile
- [ ] **`sdc-questionnaire-answerExpression`** — dynamic answer options derived from FHIRPath over current form values (no server required); SDC extension
- [ ] **tx.fhir.org ValueSet expansion** — call HL7's public terminology server directly from the browser (`$expand` operation); user pastes an external ValueSet URL and gets live answer options without any backend; biggest UX gap vs. commercial tools
- [ ] **Undo / redo** — Ctrl+Z / Ctrl+Y over the node tree; store snapshots in a fixed-size history stack
- [ ] **Copy / paste nodes** — duplicate a question or an entire group (with children) anywhere in the tree

## Later

- [x] **FHIR STU3 import compatibility shim** — `js/fhir/stu3-shim.js` normalises STU3 fields to R4 on load: `option[]`→`answerOption[]`, `options`→`answerValueSet`, `enableWhen.hasAnswer`→`operator:exists`, `initial<Type>`→`initial[{value<Type>}]`; export always produces R4
- [ ] **External validator integration** — link to HL7 / Simplifier validator or call a local FHIR validation API; surface results as item-level badges

---

## Technical Debt

### `Object.setPrototypeOf` in `answer-type-modal.js`

`answer-type-modal.js` mutates `node.itemType` and then patches the prototype with `Object.setPrototypeOf`. The proper fix is to replace the node in the reactive tree entirely (preserving `id`, `title`, `mandatory`, `enableWhen`, etc.) — but that requires reworking the tree-replacement helpers and all builder code that holds references to nodes. Lower priority; current solution is correct and tested.
