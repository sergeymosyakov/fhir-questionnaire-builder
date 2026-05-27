# ROADMAP

**Audience:** Developers and FHIR integration engineers (Variant B).  
**Feature filter:** Does it support Scenario 1 (edit & round-trip), 2 (build from scratch), or 3 (logic testing)?  
See [CONTEXT.md](CONTEXT.md) for scenario definitions.

---

## Next

- [x] **Supabase + GitHub OAuth** — GitHub login via Supabase Auth; per-user questionnaire storage in Supabase (`questionnaires` table with RLS); Save dropdown: ☁ Cloud (logged-in + tree non-empty) / Questionnaire JSON / QuestionnaireResponse JSON; From Cloud… in Questionnaires menu; user avatar+name dropdown in top panel; sign out with unsaved work prompts confirmation
- [ ] **More sample data** — 2–3 additional questionnaires covering different complexity levels, with documented expected PASS/FAIL outcomes per patient profile
- [ ] **tx.fhir.org ValueSet expansion** — call HL7's public terminology server directly from the browser (`$expand` operation); user pastes an external ValueSet URL and gets live answer options without any backend; biggest UX gap vs. commercial tools
- [ ] **Copy / paste nodes** — duplicate a question or an entire group (with children) anywhere in the tree

## Later

- [ ] **tx.fhir.org ValueSet expansion** — call HL7's public terminology server directly from the browser (`$expand` operation); user pastes an external ValueSet URL and gets live answer options without any backend; biggest UX gap vs. commercial tools
- [ ] **More sample data** — 2–3 additional questionnaires covering different complexity levels, with documented expected PASS/FAIL outcomes per patient profile
- [ ] **External validator integration** — link to HL7 / Simplifier validator or call a local FHIR validation API; surface results as item-level badges

---

## Completed

- [x] **`sdc-questionnaire-answerExpression`** — dynamic answer options for `choice`/`radio`/`open-choice` items derived from FHIRPath evaluated at render time; editable in Answer Type modal (Expression source); `answerOption[]` suppressed on export; falls back to static options on error; sample questionnaire `answer-expression-demo.fhir.json`
- [x] **View Options menu** — consolidated linkId, prefix, badges, and hidden item toggles into a single dropdown menu next to Preview button; menu stays open when clicking checkboxes; CSS modifier classes (`.preview--no-linkid`, `.preview--no-prefix`, `.preview--no-badges`, `.preview--no-hidden`) control visibility; comprehensive e2e test coverage (12 tests)
- [x] **Undo / redo** — Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z; debounced 400ms snapshots via `js/ui/history.js`; buttons in left-panel-header; max 50 entries; resets on load/clear
- [x] **Load confirm dialog** — `_askBeforeLoad()` in `app-load.js`; shown when tree non-empty before any load operation; Cancel/Escape keeps current tree
- [x] **Per-questionnaire autosave slots** — each questionnaire saves to its own key (`url` or auto-generated UUID identifier) instead of a single slot; prevents accidental overwrite
- [x] **Storage abstraction layer** — `js/storage/storage.js` adapter interface; `LocalStorageAdapter` in `js/storage/local-storage.js`; all modules (`autosave`, `tooltip`, `app`, `app-load`) read/write through `StorageAdapter`; enables swapping to Supabase/IndexedDB with zero caller changes
- [x] **FHIR STU3 import compatibility shim** — `js/fhir/stu3-shim.js` normalises STU3 fields to R4 on load: `option[]`→`answerOption[]`, `options`→`answerValueSet`, `enableWhen.hasAnswer`→`operator:exists`, `initial<Type>`→`initial[{value<Type>}]`; export always produces R4
- [x] **Migrate all modals to the Section pattern** — `appearance-modal.js`, `states-modal.js`, `repeatable-modal.js`, `expression-modal.js`, `initial-modal.js` each reduced to ~38 lines (lifecycle wrapper only). Each section owns `initPending(node)`, `build(pending)`, `commit(pending, node)`. `makeCollapsible` + `applyTip` live in `section.js` as the single canonical source. `StatesSection` adds `isVisible(node)` for node-type-specific rows. `expression-sections/` handles both single and dual-field modes. `constraint-modal.js` intentionally left as a list renderer (Section pattern does not fit).
- [x] **Reorganize all modal code into `js/ui/modals/`** — all `*-modal.js`, `modal-base.js`, `modal-registry.js`, `section.js` and all section subdirectories moved under `js/ui/modals/`. Non-modal UI utilities (`custom-select`, `date-picker`, `toast`, etc.) remain in `js/ui/` as they are used by `nodes/` and `builder/` too.
