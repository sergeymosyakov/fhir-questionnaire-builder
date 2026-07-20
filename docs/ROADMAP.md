# ROADMAP

**Audience:** Developers and FHIR integration engineers (Variant B).  
**Feature filter:** Does it support Scenario 1 (edit & round-trip), 2 (build from scratch), or 3 (logic testing)?  
See [CONTEXT.md](CONTEXT.md) for scenario definitions.

---

## Next

### Client-side capability gaps (no server required)

These are the honest feature gaps vs. competitors (see [COMPETITORS.md](COMPETITORS.md)) that can be closed **entirely in the browser** — no backend, no our-server dependency. Profiles/StructureDefinitions are supplied by file upload or canonical fetch. Ordered by planned implementation.

1. [x] **`item.definition` resolution** — resolve `item.definition` (canonical URL to a profile element) against a StructureDefinition to auto-fill `text`, `type`, and value constraints (cardinality, binding). Implemented client-side in `js/fhir/definition-resolver.js`; Item Properties → Definition → **Resolve from profile…** loads an uploaded StructureDefinition (JSON) and fills the item — no server required.
2. [x] **Reference profile validation** — for `reference` items, the answer's resource type is validated client-side against the item's allowed type (`referenceResource`): a wrong-type reference fails preview validation (`calcFormOk`) and shows an inline "Expected {Type}" error. **Resolve from profile** derives the allowed type from the element's Reference `targetProfile` (base FHIR profiles). Initial `valueReference` values now round-trip (import/export). Instance-level profile conformance still needs the target resource (server) — out of scope.
3. [x] **Definition-based extraction — general engine** — generalized the client-side `definitionExtract`: repeating field values now promote to arrays (e.g. multiple `name.given` → `given: [...]`), and repeating extract groups yield one resource per QR instance (scoped answers, unique ids) for imported QRs. Note: the app's own `buildQR` produces repeating *items* (array values), not repeating *groups*, so group-instance extraction applies to externally-supplied QRs. Full profile-typed value coercion (element-driven casting) still deferred.
4. [ ] **Renderer maturity + accessibility audit** — ARIA roles/labels, label↔input association, keyboard navigation, focus management in modals, screen-reader error states; automated `axe-core` checks in e2e. Incremental, per node type + modal.
5. [ ] **StructureMap execution** — actually **execute** FHIR Mapping Language (`targetStructureMap` / `sourceStructureMap`) for extraction/population in-browser (currently round-tripped only, not executed). Largest single gap; needs an in-browser FML engine or a bounded FML interpreter.
6. [ ] **`atable` itemControl renderer** — render a group as an answer table (`itemControl = atable`): column headers, repeating rows. Unblocks the deferred "translate `atable` column headers" item below.

### Horizon 2 — SDC completeness (extraction & population)

Supports Scenario 1 (round-trip) and Scenario 3 (logic testing). This is where most industrial-grade SDC complexity lives.

## Near-term

- [ ] **Performance regression test** — automated test with 200–300 item questionnaire covering deep nesting (depth 6–8), heavy `enableWhen`, and multiple `calculatedExpression` chains; assert render time stays under threshold

## Technical Debt

### Translation feature — known gaps and planned improvements

The initial translation implementation (v1) covers the MVP flow: auto-translate via Google Translate → review table → FHIR `_text.extension[translation]` round-trip. The following improvements are deferred:

- [x] **Translation of `rendering-xhtml` / `rendering-markdown`** — XHTML and Markdown translations stored per-language in `questDoc.translations[lang].xhtml` / `.markdown` and in custom FHIR extensions. Google Translate preserves HTML tags and Markdown syntax. `_applyLabelContent` checks `xhtml[linkId]` first, then `markdown[linkId]` (via `marked + DOMPurify`), then plain `items[linkId]`.
- [ ] **Configurable translation provider** — the endpoint **URL** is now configurable in Settings (**Translation API → Endpoint URL**, stored under `serverConfig` key `translateApiUrl`, falling back to Google `gtx`). Still deferred: a full **provider picker** to switch protocol/auth between `gtx` (free, no key), DeepL free tier (requires key), LibreTranslate (self-hosted), or OpenAI — currently only `gtx`-compatible endpoints (same query params/response shape) are supported, so a custom URL must speak the `gtx` protocol.
- [x] **`_renderStyle` inheritance in translated view** — verified non-issue: `applyRenderStyle` is called after `_applyLabelContent` in `_buildRowContent`, so CSS styles are applied to the label element regardless of translation state.
- [x] **Partial translation badge / Edit existing** — already handled: "Edit existing" in the Translate modal shows all items, new/untranslated ones appear with empty fields making it clear what's missing.
- [x] **Edit existing translations outside the translate modal** — implemented: "Edit existing" button in the Translate modal picker pre-fills the review table from stored translations without calling the API.
- [ ] **`atable` itemControl support for translated answer option labels** — the `atable` renderer (when implemented) needs to read `rc.translations[lang].opts` for column headers.

## Later

- [ ] **Sub-questionnaire / modular questionnaires** — SDC `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-subQuestionnaire`; requires FHIR server for resolution; out of scope until server integration exists

---
