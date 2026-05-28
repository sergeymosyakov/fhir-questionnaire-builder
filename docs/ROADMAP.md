# ROADMAP

**Audience:** Developers and FHIR integration engineers (Variant B).  
**Feature filter:** Does it support Scenario 1 (edit & round-trip), 2 (build from scratch), or 3 (logic testing)?  
See [CONTEXT.md](CONTEXT.md) for scenario definitions.

---

## Next

- [ ] **More sample data** — 2–3 additional questionnaires covering different complexity levels, with documented expected PASS/FAIL outcomes per patient profile
- [ ] **Copy / paste nodes** — duplicate a question or an entire group (with children) anywhere in the tree

## Technical Debt

*(none currently)*

## Later

- [ ] **External validator integration** — link to HL7 / Simplifier validator or call a local FHIR validation API; surface results as item-level badges

---

## Completed

- [x] **`sdc-questionnaire-answerExpression`** — dynamic answer options for `choice`/`radio`/`open-choice` items derived from FHIRPath evaluated at render time; editable in Answer Type modal (Expression source); `answerOption[]` suppressed on export; falls back to static options on error; sample questionnaire `answer-expression-demo.fhir.json`
- [x] **View Options menu** — consolidated linkId, prefix, badges, and hidden item toggles into a single dropdown menu next to Preview button; menu stays open when clicking checkboxes; CSS modifier classes (`.preview--no-linkid`, `.preview--no-prefix`, `.preview--no-badges`, `.preview--no-hidden`) control visibility; comprehensive e2e test coverage (12 tests)
- [x] **Undo / redo** — Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z; debounced 400ms snapshots via `js/ui/history.js`; buttons in left-panel-header; max 50 entries; resets on load/clear
- [x] **Load confirm dialog** — shown when tree non-empty before any load operation; Cancel/Escape keeps current tree (now in `QuestionnaireLoader`)
- [x] **Per-questionnaire autosave slots** — each questionnaire saves to its own key (`url` or auto-generated UUID identifier) instead of a single slot; prevents accidental overwrite
- [x] **Storage abstraction layer** — `js/storage/storage.js` adapter interface; `LocalStorageAdapter` in `js/storage/local-storage.js`; all modules (`autosave`, `tooltip`, `app`) read/write through `StorageAdapter`; enables swapping to Supabase/IndexedDB with zero caller changes
- [x] **FHIR STU3 import compatibility shim** — `js/fhir/stu3-shim.js` normalises STU3 fields to R4 on load: `option[]`→`answerOption[]`, `options`→`answerValueSet`, `enableWhen.hasAnswer`→`operator:exists`, `initial<Type>`→`initial[{value<Type>}]`; export always produces R4
- [x] **Migrate all modals to the Section pattern** — `appearance-modal.js`, `states-modal.js`, `repeatable-modal.js`, `expression-modal.js`, `initial-modal.js` each reduced to ~38 lines (lifecycle wrapper only). Each section owns `initPending(node)`, `build(pending)`, `commit(pending, node)`. `makeCollapsible` + `applyTip` live in `section.js` as the single canonical source. `StatesSection` adds `isVisible(node)` for node-type-specific rows. `expression-sections/` handles both single and dual-field modes. `constraint-modal.js` intentionally left as a list renderer (Section pattern does not fit).
- [x] **Reorganize all modal code into `js/ui/modals/`** — all `*-modal.js`, `modal-base.js`, `modal-registry.js`, `section.js` and all section subdirectories moved under `js/ui/modals/`. Non-modal UI utilities (`custom-select`, `date-picker`, `toast`, etc.) remain in `js/ui/` as they are used by `nodes/` and `builder/` too.
- [x] **Supabase + GitHub OAuth** — GitHub login via Supabase Auth; per-user questionnaire storage in Supabase (`questionnaires` table with RLS); Save dropdown: ☁ Cloud (logged-in + tree non-empty) / Questionnaire JSON / QuestionnaireResponse JSON; From Cloud… in Questionnaires menu; user avatar+name dropdown in top panel; sign out with unsaved work prompts confirmation
- [x] **tx.fhir.org ValueSet expansion** — `terminologyService.expandAll()` expands all `answerValueSet` URLs on questionnaire load (sequential queue, avoids CORS proxy 503s); Answer Type modal has external URL input + "Test expansion" button with live code count; CORS proxy at `fhir-cors-proxy.sergeymosyakov.workers.dev`
- [x] **Header menus OOP refactor** — all toolbar buttons extracted into `DropdownMenu` subclasses (`QuestionnairesMenu`, `AnswersMenu`, `SaveMenu`, `PreviewModeMenu`, `ViewOptionsMenu`, `ToolsMenu`); `ToolsMenu` adds Validate / Expand all / Collapse all; mounted via `header-actions.js`
- [x] **`maxDecimalPlaces` extension** — `http://hl7.org/fhir/StructureDefinition/maxDecimalPlaces` (valueInteger); import/export round-trip; editable in Answer Type modal ("Decimal places" field, decimal items only); preview enforces limit with error badge + red ✗ status icon; `calcFormOk` validates decimal precision; E2E + unit test coverage; sample data in `sdc-variables-demo.fhir.json`
- [x] **Patient menu clipping fix** — `PatientPresetMenu` dropdown switched to `position: fixed` with `getBoundingClientRect()` positioning to escape `overflow-x: auto` clipping on `.top-panel`
- [x] **expandAll/collapseAll → events** — removed direct function exports from `builder/index.js`; callers dispatch `BUILDER_EXPAND_ALL` / `BUILDER_COLLAPSE_ALL` events; builder listens and reacts internally
- [x] **`questionnaire-itemControl` full support** — 7 codes: `check-box` → `checklist` item type (multi-select checkboxes, comma-separated state, QR multi-answer round-trip); `radio-button` → `radio` (existing); `autocomplete` → searchable dropdown with filter input; `drop-down` / `text-box` → preserved on round-trip; `text-area` → multi-line textarea for string; `spinner` → preserved on round-trip. Builder UI: checklist type in Answer Type modal, autocomplete checkbox for select, multi-line checkbox for text. E2E (11 tests) + unit tests (21 new tests, 774 total). Sample data: `item-control-demo.fhir.json`
- [x] **OOP decoupling + file cleanup** — `js/app-load.js` and `js/render-preview.js` deleted and absorbed into `QuestionnaireLoader` + `PreviewForm` class; `AuthPanel` cloud handlers now event-driven (`CLOUD_SAVE_REQUESTED` / `CLOUD_LOAD_REQUESTED`) removing circular `import('../app.js')`; `QuestionnaireLoader` receives `reinitForm` callback via constructor DI; `PreviewForm.reinitForm({ silent })` suppresses progress bar for background re-evals; rAF fallback in `BaseNode._initPreviewNavListener` for scroll race fix; display node `_helpOpen` state persists across reactive re-renders; all E2E selectors migrated from `#id` to `data-testid`; Playwright switched to `--headless=new` mode for timing consistency
