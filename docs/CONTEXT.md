# QuestionaryPrototype — Build Context

> Internal architecture and codebase notes. See [README.md](../README.md) for quick-start and sample data; [FHIR-MAPPING.md](FHIR-MAPPING.md) for FHIR field coverage; [ROADMAP.md](ROADMAP.md) for the feature backlog.

> **⚠️ Critical workflow rules:** See [`.github/copilot-instructions.md`](../.github/copilot-instructions.md) for THE MUST and WORKFLOW RULES (git push policy, testing checklist, modularity, English-only, etc.).

---

## What It Is

A prototype **Logic Builder** for medical questionnaires (FHIR R4 Questionnaire).  
Allows visually building questionnaire logic, testing it against patient data, and importing/exporting FHIR R4 JSON.

---

## Product Direction

**Target audience:** Developers and FHIR integration engineers who build, inspect, or maintain logic-heavy questionnaires in FHIR R4 format.

This is a **Variant B** tool — it surfaces FHIR concepts directly (linkId, enableWhen, extensions, FHIRPath) rather than hiding them behind simplified UX. It is not designed for direct use by clinicians without training.

### Key Scenarios

These three scenarios act as a feature filter: new functionality is considered only if it directly supports at least one of them.

**Scenario 1 — Edit & round-trip**  
Import an existing FHIR R4 `Questionnaire`, adjust visibility/applicability logic using the visual builder, then export the modified questionnaire back to FHIR JSON. Primary workflow for integration projects.

**Scenario 2 — Build from scratch**  
Assemble a new questionnaire (e.g., bariatric surgery pre-authorization) from scratch using the builder, test it against patient profiles, and export validated FHIR JSON.

**Scenario 3 — Logic testing**  
Load any FHIR questionnaire and simulate different patient profiles in the patient-data panel. Instantly see which items are visible, which are N/A, and whether the questionnaire resolves to PASS or FAIL.

---

## Files

| File | Purpose |
|---|---|
| `index.html` | Entry point — markup, script imports |
| `favicon.svg` | Browser tab icon |
| `start.ps1` | Local dev server: `npx serve .` |
| `css/styles.css` | All styles and CSS design tokens (`--c-hover`, `--c-text-1`, `--c-accent`, etc.); `.top-panel-github-icon { vertical-align: -1px }` (GitHub SVG in header) |
| `css/modals.css` | Shared modal system (`.modal-backdrop`, `.modal-box`, `.modal-header`, `.modal-close`, `.modal-body`, `.modal-footer`, `.modal-btn`) + per-modal z-index/size overrides via `#id` selectors |
| `js/app.js` | Entry point — wires all modules at startup; registers `LocalStorageAdapter`; wires undo/redo buttons + Ctrl+Z/Y/Shift+Z keyboard shortcuts; creates `PreviewForm`, `QuestionnaireLoader`; calls `configure()` on all services; calls `questLoader.configureResetFlow(...)` to inject UI callbacks for confirm/export/clearDraft; listens for `QUESTIONNAIRE_CLEAR_REQUESTED` → `questLoader.confirmAndReset()`, `QUESTIONNAIRE_RESET` → `questLoader.reset()`, `CLOUD_SAVE_REQUESTED` / `CLOUD_LOAD_REQUESTED` events |
| `js/state.js` | Domain data only — tree, answer values, FHIR metadata, data factories, business logic, `evalConstraints`; exports `questMeta` plain object (id, url, version, name, title, status, language, publisher, description, date, subjectType, purpose, copyright, approvalDate, lastReviewDate, effectivePeriodStart, effectivePeriodEnd, experimental, _rawContact, _rawUseContext, _rawJurisdiction, _rawCode); `resetQuestMeta()` resets all questMeta fields to defaults (status → 'draft', arrays → [], strings → ''); `CHECKABLE_TYPES` and `NONEMPTY_TYPES` include `time` and `dateTime` (mandatory items of these types participate in PASS/FAIL validation) |
| `js/preview-form.js` | Right panel — `PreviewForm` class; preview driven by `AppEvents` listeners (`RESPONSE_CHANGED`, `REINIT_FORM`, etc.); `reinitForm({ silent? })` rebuilds form (progress bar suppressed when `silent:true` — used for background ValueSet expansion re-evals); exports `getLastCtx()` compat shim |
| `js/utils.js` | Pure utility functions (`escAttr`, `findAndRemove`, `isDescendant`, `findAncestorGroupIds`, `parseOption`, `parseOptions`); `destroyTree(nodes)` — calls `n.destroy?.()` on each node then splices the array (used by import and reset paths) |
| `js/eval.js` | Tree evaluation — `enableWhen[]` visibility, `enableWhenExpression` FHIRPath, `evalConstraints`; `evaluateNode(node, ctx, results, _insideHidden)` — hidden nodes (`node._hidden` or `_insideHidden=true`) are marked `{hidden:true, hiddenRoot:bool}` and excluded from normal enableWhen evaluation; all descendants recursed with `_insideHidden=true` |
| `js/render-builder.js` | Left panel — 3-line re-export shim → `js/builder/` |
| `js/builder/ctx.js` | `BuilderCtx` JSDoc typedef (no runtime exports) |
| `js/builder/index.js` | Builder orchestrator — public API (`renderTree`, `collapseAll`, `renumberAll`, `addRootGroup`, `renderTreeAsync`) |
| `js/builder/_shared.js` | Shared utilities; injected deps via `init(deps)`; `getAllItems`, `triggerCalcRecalc`, `confirmDelete`; `setRenumberGetter(fn)` / `formatSeg()` — renumber format injected from `app.js` (avoids direct DOM reads in shared module) |
| `js/builder/dnd.js` | Self-contained drag & drop; all state via `init(onDrop, tree, formTick)` |
| `js/builder/panels.js` | Action panel builders: `addPanel`, `buildVisPanel` (enableWhen), `buildTypePanel` (type+options — dead code; only used as a reference), `buildStylePanel` (appearance for groups). Dead functions `buildMandPanel` / `buildInitialPanel` / `buildConstraintPanel` / `buildSupportLinkPanel` removed — those actions moved to dedicated modals |
| `js/ui/modal-registry.js` | Singleton `MODAL_REGISTRY: Map<string, module>` — zero deps; each modal calls `MODAL_REGISTRY.set(key, {open, …})` at import time; node classes call `MODAL_REGISTRY.get(key).open(…)` without importing modals directly (avoids circular deps) |

| `js/preview/render-ctx.js` | `_rc` — dependency injection hub; populated by `preview-form.js` at startup; breaks circular deps between node class files and `state.js`; fields: `ctx`, `resultMap`, `cEnv`, `visible`, `groupIconMap`, `previewMode`, `viewPrefs`, `renderNode`, `updateGroupIcons`, `isMandatory`, `calcFormOk`, `evalConstraints`, `getValue`, `CHECKABLE_TYPES`, `buildControl`, `buildRepeatControls`, `scrollToBuilder`, `collapsedGroups` |
| `js/preview/render-node.js` | Thin dispatcher (35 lines) — `renderPreviewNode(res, container)` dispatches to `GroupNode.prototype.renderPreview` or the appropriate `NODE_REGISTRY` class; `updateGroupIcons()` iterates `_rc.groupIconMap` and calls `GroupNode.prototype.refreshIcon`; sets `_rc.renderNode` and `_rc.updateGroupIcons` at module load |
| `js/nodes/base-node.js` | Base class for all preview nodes — `BaseNode`; owns `renderPreview(res, container, rc)` entry point, shared DOM scaffold (`_createBaseRow`, `_buildLabel`, `_buildSupportLinks`, `_buildVisHint`, `_buildRowContent`, `_appendRow`), dimmed/disabled renderers, `_evalCondition` (base stub), `applyRenderStyle()` and `createWrap()` helpers exported for reuse; constructor creates `this._ac = new AbortController()`; all `document.addEventListener` calls in subclasses pass `{ signal: this._ac.signal }` for leak-free cleanup; `destroy()` calls `this._ac.abort()` |
| `js/nodes/item-node.js` | `ItemNode extends BaseNode` — all non-group, non-display item types; overrides `_evalCondition`, `_buildLabel`, `_buildRowContent`, `_buildConstraintBadge`, `_buildCalcBadge`, `_appendRow`; **`buildBuilder(ctx)`** — renders the builder-panel row for this item (DnD, action links, modals via `MODAL_REGISTRY`); all builder deps injected through `ctx`; **`supportsRepeat() → true`** — overridden by `CheckboxNode` and `DisplayNode` to return `false`; `buildBuilder` uses `!node.supportsRepeat()` to hide the repeat action link |
| `js/nodes/builder-helpers.js` | Builder-panel + DnD helpers extracted from `base-node.js` — `buildBuilderPanel`, `addDndHandlers`, `buildActionLinks`, etc. as standalone functions taking `node` as first param; imported only by `base-node.js` and `group-node.js` |
| `js/nodes/group-node.js` | `GroupNode extends BaseNode` — group nodes; overrides `_evalCondition`, `_buildLabel`, `_buildRowContent`, `_renderChildren`, `_renderDimmedChildren`, `_renderDisabledChildren`; **`refreshIcon(rc)`** — updates pass/fail icon; **`buildBuilder(ctx)`** — renders the builder-panel row for this group (collapse toggle, child list, ⊕ Add dropdown, DnD, action links, style panel, modals via `MODAL_REGISTRY`); `destroy()` overrides `super.destroy()` and recursively calls `c.destroy()` on all children |
| `js/nodes/display-node.js` | `DisplayNode extends ItemNode` — `itemType:'display'`; `buildControl()` returns empty `createWrap()`; `_initRowClass` adds `.lform-item--{_displayCategory}`; `_buildLabel` renders help toggle (cat `'help'`) — toggle state stored in `this._helpOpen` (survives full re-renders) or plain label; `_buildRowContent` shows category icon (instructions/security), no interactive control |
| `js/nodes/index.js` | `NODE_REGISTRY` — `Map<itemType → class>`; all node classes registered; re-exports `GroupNode`, `ItemNode`, `BaseNode`, `DisplayNode` and all concrete item classes |
| `js/fhir/import.js` | FHIR R4 → internal model; calls `normaliseSTU3()` first (no-op for R4); reads `item.repeats`, `item.maxLength` (→ `_maxLength`), `sdc-questionnaire-entryFormat` extension (→ `_entryFormat`), `questionnaire-choiceOrientation` extension (→ `_choiceOrientation`), `questionnaire-displayCategory` extension (→ `_displayCategory` for display items and groups), `item.answerValueSet` (→ `_answerValueSet`), `Questionnaire.contained[]` (→ `questContained`), `questionnaire-minOccurs`/`questionnaire-maxOccurs` extensions, `questionnaire-minValue`/`questionnaire-maxValue` extensions (→ `_minValue`/`_maxValue`), `maxDecimalPlaces` extension (→ `_maxDecimalPlaces`), `ordinalValue` extension on `answerOption.extension` (primary) or `answerOption.valueCoding.extension` (fallback) → `_optionOrdinals`, `questionnaire-sliderStepValue` extension (→ `_sliderStep`), `item.disabledDisplay` field + R4 backport extension (→ `_disabledDisplay`), `questionnaire-supportLink` extension 0..* (→ `_supportLinks` string[]; on both items and groups), `sdc-questionnaire-hidden` extension (→ `_hidden = true`; on both items and groups), `maxSize` extension (→ `_maxFileSizeMB` for attachment items), `mimeType` extensions 0..* (→ `_mimeTypes` string[] for attachment items), `questionnaire-optionPrefix` extension on `answerOption[].extension` (→ `_optionPrefixes` map of code→prefix string); populates `questMeta` (id, url, version, name, title, status, **language**, publisher, description, date, subjectType, purpose, copyright, approvalDate, lastReviewDate, effectivePeriodStart, effectivePeriodEnd, **experimental**) on import; stores `contact[]`, `useContext[]`, `jurisdiction[]`, `code[]` as pass-through fields (`_rawContact`, `_rawUseContext`, `_rawJurisdiction`, `_rawCode`); `answerOption[].initialSelected` → `node._initialSelected` (round-trip); `item.initial[]` multi-value for repeating items → `node._initialValues[]` + `node._initialValue` (first value); `applyInitialValues` maps first value to base id, subsequent values to `$$1..$$N`, and sets `$$n = length - 1` (extra row count); exports `resolveContainedValueSet(contained, ref)`; `questionnaire-itemControl` extension → `check-box`→`itemType:'checklist'`, `radio-button`→`'radio'`, `autocomplete`/`drop-down`/`text-area`/`text-box`/`spinner`/`slider`/`lookup`→`node._itemControl` |
| `js/fhir/stu3-shim.js` | STU3 → R4 normalisation shim — `normaliseSTU3(fhirJson)` returns R4-compatible copy (deep-cloned) or original unchanged if already R4; `isSTU3(fhirJson)` detects by `meta.fhirVersion` 3.x/1.x or STU3-only item fields; converts: `item.option[]`→`item.answerOption[]`, `item.options`(Reference)→`item.answerValueSet`, `enableWhen.hasAnswer`→`operator:exists+answerBoolean`, STU3 implicit equality→`operator:'='`, `item.initial<Type>`→`item.initial:[{value<Type>}]`; works recursively; no side effects |
| `js/fhir/export.js` | Internal model → FHIR R4; delegates file download to `downloadJSON` from `download.js`; writes `maxLength`, `sdc-questionnaire-entryFormat` extension (from `_entryFormat`), `questionnaire-choiceOrientation` extension (from `_choiceOrientation`), `questionnaire-displayCategory` extension (from `_displayCategory`), `item.answerValueSet` (from `_answerValueSet`), `Questionnaire.contained[]` (from `questContained`), `questionnaire-minOccurs`/`questionnaire-maxOccurs` when `node.repeats`, `questionnaire-minValue`/`questionnaire-maxValue` from `_minValue`/`_maxValue`, `maxDecimalPlaces` extension from `_maxDecimalPlaces`, `ordinalValue` extension on `answerOption.extension` (from `_optionOrdinals`), `questionnaire-sliderStepValue` extension from `_sliderStep` (`valueInteger` always; decimal steps rounded; R4 constraint), `item.disabledDisplay` from `_disabledDisplay`, `questionnaire-supportLink` extension entries from `_supportLinks[]` (one `valueUri` per entry; on both items and groups), `sdc-questionnaire-hidden` extension (`valueBoolean: true`) when `node._hidden` (on both items and groups), `maxSize` extension (`valueDecimal`) from `_maxFileSizeMB` for attachment items, `mimeType` extensions (one `valueCode` per entry) from `_mimeTypes[]` for attachment items, `questionnaire-optionPrefix` extension on each `answerOption.extension` (one `valueString` per option) from `_optionPrefixes` map; emitted alongside `ordinalValue` when both are present; uses all `questMeta` fields (id, url, version, name, title, status, **language** (omitted when empty), **experimental** (omitted when null), publisher, description, date, subjectType, purpose, copyright, approvalDate, lastReviewDate) for root-level Questionnaire properties; `subjectType` comes from `questMeta.subjectType` (comma-separated string → array, default `['Patient']`); `date` preserved from import or falls back to today; writes `effectivePeriod` from `effectivePeriodStart`/`effectivePeriodEnd` when non-empty; writes back `_rawContact`, `_rawUseContext`, `_rawJurisdiction`, `_rawCode` pass-through arrays unchanged; marks `answerOption[].initialSelected` from `node._initialSelected`; exports `item.initial[]` as multi-value array for repeating items with `_initialValues`; skips writing `answerOption` when `_answerValueSet` is set; `questionnaire-itemControl` extension: `radio`→`radio-button`, `checklist`→`check-box`+`repeats:true`, `_itemControl` string→corresponding code (`autocomplete`, `drop-down`, `text-area`, `text-box`, `spinner`, `slider`, `lookup`) |
| `js/fhir/download.js` | DOM side-effect helper — `downloadJSON(data, fileName)`: creates Blob + anchor, triggers download, revokes URL; imported by `export.js` and `qr-export.js` to keep FHIR modules DOM-free |
| `js/fhir/qr-export.js` | `exportQR(fileName)` — builds QR from current tree + answers, delegates download to `downloadJSON` from `download.js` |
| `js/fhir/qr-builder.js` | `buildQR(fhirJson, values)` / `buildQRItem(fhirItem, values)` — builds a FHIR R4 QuestionnaireResponse; `choice`/`open-choice` → `valueCoding` (with `system`, `display`, `ordinalValue`); `quantity` → `valueQuantity {value, unit}`; `url` → `valueUri`; `reference` → `valueReference`; used by qr-export and FHIRPath calculatedExpression evaluation |
| `js/fhir/qr-import.js` | `importQRAnswers(qrJson, values, tree)` — flattens QR answers; handles `valueTime`, `valueReference` (→ `{reference}`), `valueQuantity` (→ `{value, unit}`), `valueUri`; multi-answer items write `id$$1`…`id$$N` + `id$$n` (repeat row restoration); reports unmatched linkIds; returns `{ok, loaded, unmatched, questionnaire}` |
| `js/ui/variables-panel.js` | SDC Variables card + `VariablesModal extends Modal` — `configure({questVariables})`, `refresh()`; `VariablesModal.open()` copies draft, `_apply()` validates + commits, `_cancel()` discards; `%name` chip rich tooltips |
| `js/ui/metadata-modal.js` | Questionnaire Properties modal — `init(elements)`, `open()`; draft pattern; renders all fields via `renderMetaSections(container, pending)` from `metadata-sections/index.js` — iterates `META_SECTIONS` registry |
| `js/ui/metadata-sections/index.js` | Barrel — re-exports `META_SECTIONS` from `registry.js`; side-effect imports of all 11 section files trigger self-registration; exports `renderMetaSections(container, pending)` |
| `js/ui/metadata-sections/registry.js` | `META_SECTIONS = []` — sections push themselves here on module load |
| `js/ui/metadata-sections/data.js` | Constants: `STATUSES`, `LANGUAGES`, `EXPERIMENTALS`, `TELECOM_SYSTEMS`, `ID_USES`, `ID_USE_LABELS` |
| `js/ui/metadata-sections/helpers.js` | `applyTip(el, tip)`, `makeRow(...)`, `makeSelectRow(...)`, `makeCollapsible({testid, tip, label, countFn, initialOpen, liveUpdate, buildBody})` — generic collapsible shell; `buildBody({el, setLabel, expand})` |
| `js/ui/metadata-sections/hint.js` | `HintSection` — intro `panel-hint` div |
| `js/ui/metadata-sections/core-fields.js` | `CoreFieldsSection` — id, url, version, name, title, status dropdown, language dropdown, publisher, description |
| `js/ui/metadata-sections/advanced.js` | `AdvancedSection` — collapsible: experimental, date, subjectType, effectivePeriod, approvalDate, lastReviewDate, purpose, copyright |
| `js/ui/metadata-sections/narrative.js` | `NarrativeSection` — read-only narrative status + div preview |
| `js/ui/metadata-sections/derived-from.js` | `DerivedFromSection` — collapsible canonical URL list for `Questionnaire.derivedFrom` |
| `js/ui/metadata-sections/replaces.js` | `ReplacesSection` — collapsible canonical URL list for the replaces extension |
| `js/ui/metadata-sections/identifiers.js` | `IdentifiersSection` — collapsible identifier rows: use select + system url + value text + × remove |
| `js/ui/metadata-sections/contact.js` | `ContactSection` — collapsible contacts with nested telecom rows |
| `js/ui/metadata-sections/jurisdiction.js` | `JurisdictionSection` — collapsible jurisdiction coding rows (system/code/display) |
| `js/ui/metadata-sections/resource-meta.js` | `ResourceMetaSection` — collapsible: versionId + Generate UUID, source, lastUpdated read-only, profile[] URL list, tag[] and security[] via `renderCodesEditor` |
| `js/ui/metadata-sections/codes.js` | `CodesSection` — collapsible `Questionnaire.code[]` editor via `renderCodesEditor` |
| `js/ui/modals/codes-modal.js` | **Item / Group Properties** modal — `open(node, link, setActive)`; draft pattern; four collapsible sections: **Definition URL**, **Codes** (`node._codes[]`), **Support Links** (`node._supportLinks[]`), **Extensions** (`node._unknownExtensions[]`); Apply commits all four fields via `ITEM_SECTIONS`; Cancel discards; link active when any field is non-empty; shared `renderCodesEditor` exported for reuse; **"Copy to…"** button in footer: `_buildPayload()` merges all section patches, opens `nodePickerModal`, on confirm dispatches `AppEvents.COPY_TO_NODES` |
| `js/ui/json-viewer.js` | Shared read-only FHIR JSON viewer modal — `init(elements)`, `show(title, data)`, `close()`; Esc / backdrop / × close |
| `js/ui/contained-panel.js` | Collapsible read-only card for `Questionnaire.contained[]` — `init(elements, containedArray, showJsonFn)`, `refresh()`; each chip opens JSON viewer |
| `js/ui/answer-valueset-panel.js` | Collapsible read-only card for items using `answerValueSet` — `init(elements, treeRef, showJsonFn)`, `refresh()`; collects unique URLs; each chip shows URL + `usedByItems` |
| `js/ui/modals/modal-base.js` | `Modal` base class — `constructor({cancelLabel, applyLabel, maxWidth, bodyClass})` builds and appends modal DOM to `document.body`; exposes `this.body`, `this.title`; `open()` shows backdrop, `close()` hides it; subclass overrides `open()`, `_apply()`, `_cancel()`; single shared Escape handler closes topmost open modal; `static _svc` holds injected services; `static configure(services)` called once at startup. Never monkey-patch `_modal._apply = fn` — always use `extends Modal`. |
| `js/ui/modals/note-modal.js` | Design Note modal — `open(node, noteLink, setActive)`; draft pattern; free-text textarea (`design-note-input`); Apply commits `_designNote` via `applyPatch()`; **"Copy to…"** button in footer: `_buildPayload()` → `{ _designNote }`, opens `nodePickerModal` with `allowedType=null` (notes apply to both items and groups), on confirm dispatches `AppEvents.COPY_TO_NODES` |
| `js/ui/constraint-modal.js` | Constraint edit modal — draft pattern; `node.constraint[]` deep-cloned on open; Apply commits + calls `triggerCalcRecalc()` + updates button state; Cancel discards; expression field is a resizable `.expr-textarea`; each card has an **Explain** button (uses `window.fhirpath` directly) |
| `js/ui/modals/expression-modal.js` | FHIRPath expression modal — two modes: `open(cfg)` single-field (groups: calculatedExpression only); `openDual(node, link, setActive, cb)` dual-field (items: calc + init in one modal with `.expr-section-hdr` visual section headers separated by `.expr-modal-sep`); draft pattern; auto-resize `.expr-textarea`; live expr icon via debounced `refreshExprIcons`; **"Copy to…"** button in footer: builds patch via `_buildPayload()` → `EXPR_SECTIONS.map(s => s.buildPatch())`, opens `nodePickerModal`, on confirm dispatches `AppEvents.COPY_TO_NODES`; Escape / backdrop close |
| `js/ui/modals/initial-modal.js` | Default Value edit modal — `open(node, initLink, setActive)`; draft pattern; renders context-aware control per `itemType`; Apply commits `node._initialValue` + `values[node.id]` + calls `triggerCalcRecalc()`; **"Copy to…"** button in footer: `_buildPayload()` → `{ _initialValue }`, opens `nodePickerModal`, on confirm dispatches `AppEvents.COPY_TO_NODES` |
| `js/ui/modals/appearance-modal.js` | Appearance (rendering-style + rendering-xhtml + rendering-markdown) edit modal — `open(node, styleLink, setActive)`; Style / XHTML / Markdown sections (under `js/ui/modals/appearance-sections/`); each section exposes `buildPatch(pending, node)` — `_buildPayload()` merges them; **Apply** calls `node.applyPatch(patch)` (sets `_renderStyle`, `_renderXhtml`, `_renderMarkdown`); **"Copy to…"** button in footer opens `nodePickerModal` → on confirm dispatches `AppEvents.COPY_TO_NODES {ids, patch}` handled by `BaseNode` listeners via `applyPatch()`; link active when any render field set |
| `js/ui/modals/node-picker-modal.js` | Reusable Node Picker modal — `nodePickerModal.open(excludeId, onConfirm, allowedType?)`; `allowedType` (`'group'`\|`'item'`\|`null`) — nodes of a different type render as non-selectable headers (no checkbox); renders questionnaire tree as checkboxes; search input filters by title/linkId (`_filterTree` keeps matching leaves + all ancestors); confirm button shows count `Copy to selected (N)`, disabled until selection; `onConfirm(ids: string[])` called on Apply; stacks on top of any open modal |
| `js/ui/modals/states-modal.js` | **States** modal — `open(node, statesLink, setActive)`; draft pattern; 4 controls: Required select (null/true/false), Read-only checkbox (items only), Hidden checkbox, Usage mode dropdown; Apply commits all + `triggerCalcRecalc()`; link active when `mandatory===true \|\| _readOnly \|\| _hidden \|\| _usageMode`; **"Copy to…"** button in footer: `_buildPayload()` merges all section patches, opens `nodePickerModal`, on confirm dispatches `AppEvents.COPY_TO_NODES` |
| `js/ui/modals/states-sections/index.js` | Barrel — side-effect imports of all section files triggering self-registration |
| `js/ui/modals/states-sections/base-section.js` | `StatesSection` base class + `STATES_SECTION_REGISTRY` array |
| `js/ui/modals/states-sections/registry.js` | Re-exports `STATES_SECTION_REGISTRY` |
| `js/ui/modals/states-sections/helpers.js` | Shared DOM helpers for states sections |
| `js/ui/modals/states-sections/collapsible.js` | `CollapsibleSection` — collapsible section wrapper |
| `js/ui/modals/states-sections/required.js` | `RequiredSection` — required tristate select |
| `js/ui/modals/states-sections/read-only.js` | `ReadOnlySection` — read-only checkbox (items only) |
| `js/ui/modals/states-sections/hidden.js` | `HiddenSection` — hidden checkbox |
| `js/ui/modals/states-sections/usage-mode.js` | `UsageModeSection` — questionnaire-usageMode dropdown (6 FHIR codes); `commit()` writes `node._usageMode` |
| `js/ui/modals/states-sections/signature.js` | `SignatureSection` — questionnaire-signatureRequired chip selector (24 Signature Type Codes); `commit()` writes `node._signatureRequired` |
| `js/ui/answer-type/modal.js` | Answer Type edit modal — `init(elements)`, `open(node, typeLink, setActive)`; draft pattern; renders type dropdown + iterates `SECTION_REGISTRY` for conditional sections; `_apply()` delegates all node-field commits to `SECTION_REGISTRY.forEach(s => s.commit(pending, node))` — no type-specific if-chains in modal |
| `js/ui/section.js` | Generic `Section` base class — `build(pending)→Node`; extended by both `AnswerTypeSection` and all `MetaSection` subclasses, making the registry pattern reusable across all modals |
| `js/ui/answer-type/base-section.js` | `AnswerTypeSection extends Section` + `SECTION_REGISTRY` array; declares four additional methods (all no-ops): `isVisible(type)`, `initDraft(node)→object`, `onTypeChange(type)`, `commit(pending, node)`; subclasses override all five; `open()` in modal.js builds `_pending` via `Object.assign({node,typeLink,setActive,draftType}, ...SECTION_REGISTRY.map(s => s.initDraft(node)))` |
| `js/ui/answer-type/sections.js` | Barrel — re-exports `SECTION_REGISTRY` from `base-section.js`; side-effect imports of all 8 section files trigger self-registration |
| `js/ui/answer-type/data.js` | Pure constants: `CHOICE_TYPES`, `ENTRY_FORMAT_TYPES`, `NUMERIC_TYPES`, `ITEM_TYPES`, `FHIR_R4_TYPES`, `BUILDER_UNITS` |
| `js/ui/answer-type/sections/choice.js` | `ChoiceSection` — choice/radio/open-choice: answer-source toggle (options list / ValueSet / answerExpression), openLabel; uses `createOptionsEditor` (with `showType` when `_rawAnswerOptions` present) for the unified Code+Label+Score+Prefix+Type row editor; `commit()` writes `_answerValueSet`, `options`, `_rawAnswerOptions`, `_optionOrdinals`, `_optionPrefixes`, `_openLabel`, `_answerExpression`; uses `fhirOptsToStr` from `import-helpers.js` to sync `node.options` after raw rebuild |
| `js/ui/answer-options-editor.js` | `createOptionsEditor({rows, onchange, testidPrefix, showType})` — reusable dynamic row editor: columns [Type \|] Code \| Label \| Score \| Prefix \| Weight \| Excl \| ✕; Type column (custom select: Coding/String/Integer/Date/Time/Reference) shown only when `showType=true`; rows carry `valueType` field; tooltips on headers; `getRows()` / `setRows()` API |
| `js/ui/answer-type/sections/reference.js` | `ReferenceSection` — resource type dropdown; `commit()` writes `referenceResource` |
| `js/ui/answer-type/sections/unit.js` | `UnitSection` — UCUM unit dropdown; `commit()` writes `quantityUnit` |
| `js/ui/answer-type/sections/numeric.js` | `NumericSection` — min/max inputs + slider toggle+step + decimal places (decimal only); `commit()` writes `_minValue`, `_maxValue`, `_sliderStep`, `_maxDecimalPlaces` |
| `js/ui/answer-type/sections/placeholder.js` | `PlaceholderSection` — entryFormat input; `commit()` writes `_entryFormat` |
| `js/ui/answer-type/sections/orientation.js` | `OrientationSection` — choiceOrientation dropdown (radio only); `commit()` writes `_choiceOrientation` |
| `js/ui/answer-type/sections/choice-columns.js` | `ChoiceColumnsSection` — editable list of choiceColumn rows (path, label, width, forDisplay); visible for choice/open-choice types; `commit()` writes `_choiceColumns` |
| `js/ui/answer-type/sections/display-cat.js` | `DisplayCatSection` — display category dropdown (display items only); `commit()` writes `_displayCategory` |
| `js/ui/answer-type/sections/attach.js` | `AttachSection` — max file size + MIME types inputs (attachment only); `commit()` writes `_maxFileSizeMB`, `_mimeTypes` |
| `js/ui/answer-type/sections/item-media.js` | `ItemMediaSection` — URL + content-type inputs for sdc-questionnaire-itemMedia; visible for all types; `commit()` writes `_itemMedia` |
| `js/ui/repeatable-modal.js` | Repeatable edit modal — `init(elements)`, `open(node, repeatLink, setActive)`; draft pattern; toggle for `node.repeats` + cardinality card (`_minOccurs` / `_maxOccurs` integer inputs); Apply trims excess rows when maxOccurs reduced; calls `triggerCalcRecalc()` |
| `js/ui/patient-ctx.js` | Patient presets dropdown + `PatientModal extends Modal` — 5 built-in profiles + Custom…; `configure({tree, questVariables})`; `PatientModal.open()` builds input rows, `_apply()` commits values + fires `REINIT_FORM` + `PATIENT_CTX_APPLIED`; auto-applies on preset selection; `presetMenu = new PatientPresetMenu(PATIENT_PRESETS)` mounted by replacing `#patientPresetWrap` |
| `js/ui/progress.js` | Global progress bar — `init(elements)`, `show/update/hide` |
| `js/ui/search.js` | Preview search — `init(elements)`, `refresh()`; highlight + up/down/Enter navigation |
| `js/ui/dropdown-menu.js` | Abstract base class for all header dropdown menus — constructor builds `.load-wrap`+button+`.load-menu`; `_item(id,html,testid)`, `_sep()`, `_checkItem(inputId,label,testid)` helpers; `_onOpen` hook; `close/show/hide`; listens to `close-dropdowns` CustomEvent |
| `js/ui/header-actions.js` | Mounts all 6 header menu instances into `#headerActions` span; exports `questionnairesMenu`, `answersMenu`, `saveMenu`, `previewModeMenu`, `viewOptionsMenu`, `settingsMenu`, `prefs` |
| `js/ui/menus/questionnaires-menu.js` | `QuestionnairesMenu extends DropdownMenu` — Load/Library/Cloud/Recent-draft items; `_onOpen` syncs recent-draft item; hidden file input (`data-testid="fhir-file-input"`) for file picker; click handlers dispatch `CLOUD_LOAD_REQUESTED` event |
| `js/ui/menus/answers-menu.js` | `AnswersMenu extends DropdownMenu` — Load QR file / Load from Library; hidden file input (`data-testid="qr-file-input"`); initially hidden, shown when tree has nodes |
| `js/ui/menus/save-menu.js` | `SaveMenu extends DropdownMenu` — Cloud Save / Questionnaire JSON / QR JSON; `configure({fileNameDisplay, tree, values})` from `app.js`; export always runs `validateModal.show('export')` — modal auto-skips UI if 0 issues; Cloud Save click dispatches `CLOUD_SAVE_REQUESTED` event |
| `js/ui/menus/preview-mode-menu.js` | `PreviewModeMenu extends DropdownMenu` — Preview / Patient / JSON; `_applyMode(mode)` dispatches `preview-mode-change`, updates button label and checked state |
| `js/ui/menus/view-options-menu.js` | `ViewOptionsMenu extends DropdownMenu` — 4 checkboxes (linkId/prefix/badges/hidden); each dispatches `view-pref-change`; stopPropagation prevents close on checkbox click |
| `js/ui/menus/settings-menu.js` | `SettingsMenu extends DropdownMenu` — Preferences toggles (Tips, Autosave, Local validation, Server validation) + tool actions (Validate, Expand all, Collapse all); `setHandlers({initialTips, initialAutosave, onTipsToggle, onAutosaveToggle, onValidate, onExpand, onCollapse})` wired in `app.js`; validator toggles dispatch `AppEvents.VALIDATOR_TOGGLE {id, enabled}` — validators listen and self-update; right-aligned dropdown; hidden until tree has nodes |
| `js/ui/prefs.js` | `Prefs` — pure `localStorage` wrapper; namespace `fhirqb.*`; keys: `validate` (local validation on export/import, default `true`), `validateExternal` (server validation, default `false`), `tips` (default `true`), `autosave` (default `true`); `get(key)`, `set(key, value)`, `toggle(key)` |
| `js/fhir/validators/base.js` | Abstract `Validator` base class — `get id()`, `get name()`, `get type()` (`'local'|'external'`); `this.enabled` (default `true`); listens to `AppEvents.VALIDATOR_TOGGLE {id, enabled}` and self-updates; `run()` returns `[]` immediately when disabled; subclasses override `_run()` |
| `js/fhir/validators/local.js` | `LocalValidator extends Validator` — `id='local'`; wraps synchronous `validateTree()`; `enabled=true` by default |
| `js/fhir/validators/external.js` | `ExternalValidator extends Validator` — `id='external'`; `enabled=false` by default; POSTs to HAPI FHIR `$validate` endpoint; retries configurable; maps OperationOutcome issues to `{ severity, nodeId: '(external)', message }` |
| `js/fhir/validators/registry.js` | `ValidatorRegistry` singleton — `register(v)`, `getAll()`, `runAll(questJson, tree, values)`; never rejects; exported as `validatorRegistry` |
| `js/fhir/validators/init.js` | Reads `./config.json` (relative path — works on GitHub Pages subdirectory) and registers validators into `validatorRegistry`; accepts `{ localEnabled, externalEnabled }` from prefs so validators start in correct state; called once at startup from `app.js` |
| `js/ui/tooltip.js` | Rich tooltip system — delegated `mouseover` on `[data-tip-title]`/`[data-tip-body]`; positions card below/above target; supports `data-tip-fhir` + `data-tip-spec` footer; enabled-state persisted via `StorageAdapter` (read in `init()`, written on toggle) |
| `js/ui/toast.js` | Toast notification system — `showToast(msg, type, duration)`, `showError(msg)`, `showWarn(msg)`, `showInfo(msg)`; self-contained; appends `.toast-container` to `document.body` on first call; `error`/`warn`/`info` variants; CSS transition fade-in/fade-out; styled by `css/toast.css` |
| `js/fhir/explain.js` | FHIRPath boolean expression tree parser — `parseExprTree(expr)` + `evaluateExprTree(node, fp, resource, env)` with AND/OR/NOT/LEAF nodes |
| `js/ui/explain-modal.js` | Expression Explain modal — `show(expr, fp, resource, env)`; renders AND/OR/NOT/LEAF tree with ✓/✗ icons; FHIRPath strip at bottom |
| `js/storage/storage.js` | **StorageAdapter API layer** — thin abstraction over persistence; `register(adapter)` called once at startup in `app.js`; exports `getItem/setItem/removeItem/keys`; throws if adapter not registered; all modules use this instead of `localStorage` directly, enabling backend swap (Supabase etc.) with zero caller changes |
| `js/storage/local-storage.js` | `LocalStorageAdapter` — wraps `window.localStorage`; all 4 methods async (return `Promise.resolve`); registered at startup in `app.js` |
| `js/storage/supabase-adapter.js` | `SupabaseAdapter extends LocalStorageAdapter` — constructor takes Supabase JS client; delegates sync-compatible methods to `localStorage`; adds cloud CRUD: `cloudSave(fhirJson)` (SELECT then INSERT/UPDATE by `(user_id, url)`), `cloudUpdate(id, fhirJson)`, `cloudList()`, `cloudLoad(id)`, `cloudDelete(id)` |
| `js/auth/supabase-client.js` | Singleton Supabase JS v2 client — `export const supabase = window.supabase.createClient(URL, KEY)` (loaded from CDN UMD before ES modules) |
| `js/auth/auth.js` | Auth API — `signInWithGitHub()` (OAuth redirect), `signOut()`, `getUser()`, `onAuthChange(cb)` — cleans URL hash on `SIGNED_IN` via `history.replaceState` |
| `js/events.js` | `AppEvents` — central registry of all custom event name constants: `QUESTIONNAIRE_LOADED`, `QUESTIONNAIRE_CLEARED`, `QUESTIONNAIRE_NEW`, `QUESTIONNAIRE_CLEAR_REQUESTED`, `QUESTIONNAIRE_RESET`, `QUESTIONNAIRE_META_CHANGED`, `BUILDER_RERENDER`, `BUILDER_NAVIGATE`, `BUILDER_NAVIGATE_TO`, `BUILDER_EXPAND_ALL`, `BUILDER_COLLAPSE_ALL`, `PREVIEW_NAVIGATE_TO`, `REINIT_FORM`, `SHOW_JSON`, `VIEW_PREF_CHANGE`, `PREVIEW_MODE_CHANGE`, `RESPONSE_CHANGED`, `PATIENT_CTX_APPLIED`, `QR_LOADED`, `CLOUD_SAVE_REQUESTED`, `CLOUD_LOAD_REQUESTED`, `CLOSE_DROPDOWNS`, `REFRESH_EXPR_ICONS`, `REFRESH_CALC_BADGES`, `COLLAPSE_ALL_PREVIEW`, `EXPAND_ALL_PREVIEW`, `RENUMBER_PROGRESS`, `RENUMBER_DONE`, `COPY_TO_NODES` (detail: `{ ids: string[], patch: object, nodeType?: 'group'|'item' }` — dispatched by modals; `BaseNode` listeners skip nodes whose `type` doesn't match `nodeType`) |
| `js/ui/auth-panel.js` | Auth panel — sign-in button + user avatar dropdown; listens for `CLOUD_SAVE_REQUESTED` / `CLOUD_LOAD_REQUESTED` events (dispatched by Save ▾ / Questionnaires ▾ menus) to decouple menus from auth state; no circular import of `app.js`; user menu uses `.auth-user-menu` class |
| `js/fhir/questionnaire-loader.js` | `QuestionnaireLoader` — import pipeline + reset flow owner; constructor receives `{ tree, values, questMeta, rawFhir, reinitForm }`; `load(data, fileName)` runs FHIR import + validate + render + `await reinitForm()`; `_expandValueSets()` calls `reinitForm({ silent: true })` to suppress progress bar; `configureResetFlow({ confirmOpen, promptExport, showValidateExport, clearDraft })` injects UI callbacks; `reset()` destroys tree + clears state + dispatches `QUESTIONNAIRE_CLEARED`; `confirmAndReset()` opens confirm dialog → optionally validates/exports then calls `reset()` |
| `js/ui/modals/cloud-modal.js` | `CloudModal extends Modal` — lists cloud questionnaires; rows have Load and Delete buttons; `_relTime(isoStr)` formats relative timestamps; singleton `export const open = onSelect => _modal.open(onSelect)` |
| `css/auth.css` | Auth UI styles: `.auth-signin-btn`, `.auth-user-btn`, `.auth-user-avatar`, `.auth-user-name`; `.auth-user-menu { position: fixed; left: auto }` override so dropdown escapes `overflow:auto` top-panel clipping; `.cloud-list-*` for CloudModal |
| `js/ui/autosave.js` | Background autosave — 15 s interval; per-questionnaire slot keyed by `Questionnaire.url` or auto-generated `identifier[fhir-qb.app/editor].value`; public API: `init({buildFn,questMeta,onSaved})`, `isEnabled`, `setEnabled`, `getMostRecentDraft()→{meta,key}\|null`, `getDraftData(key)`, `clearDraft`; reads/writes through `StorageAdapter` (no direct `localStorage` calls) |
| `js/ui/history.js` | Undo/redo — debounced 400 ms + `requestIdleCallback`; max 50 snapshots (JSON strings); `init({buildFn,importFn,renderFn,onChange})`, `undo()`, `redo()`, `canUndo()`, `canRedo()`; stack resets on `questionnaire-loaded` / `questionnaire-cleared`; initial snapshot taken in `init()` so first change is undoable |
| `js/ui/library-modal.js` | **Load from Library** modal — `init(elements)`, `open(focusGroupId, onSelect, typeFilter)`; fetches and caches `sampledata/library.json`; renders collapsible group tree filtered by `typeFilter` (`'questionnaire'` \| `'qr'` \| undefined for all); clicking an item calls `onSelect(item)` and closes the modal; opened from the `Questionnaires ▾` dropdown (filter: questionnaire) and `Answers ▾` dropdown (filter: qr) |
| `js/ui/status-badge.js` | PASS/FAIL pill badge in preview header — `update({anyVisible, hasCriteria, finalOk, failingItems})`; dark dropdown with numbered issues + ↗ navigate links |
| `js/fhir/validate.js` | `validateTree(tree, values, questMeta?)` → `{severity,nodeId,message}[]`; enforces all FHIR R4 invariants que-0–que-13 (error or warning per rule); FHIRPath syntax check for `_calculatedExpr`, `_answerExpression`, `enableWhenExpression`, constraint expressions; empty titles, missing options; cross-field semantic warnings: `required+hidden`, `calculatedExpression` without `readOnly`, `answerExpression+answerOption[]`, `enableWhen+enableWhenExpression`, `repeats` mismatch with `_initialValues`, sliderStep decimal, displayCategory on display item |
| `js/fhir/terminology-service.js` | Singleton `terminologyService` — `getServer(node, questMeta)` (fallback chain: per-item → questionnaire → `https://tx.fhir.org/r4`); `expandValueSet(vsUrl, serverUrl)` fetches `ValueSet/$expand`; `testServer(serverUrl)` pings `/metadata`; `expandAll(tree, questMeta)` walks tree **sequentially** (one request at a time to avoid 503s from CORS proxy), stores options in `node._vsCache`, returns failures array |
| `js/ui/modals/validate-modal.js` | Async validation modal — `show(title, mode, { questJson, tree, values, onExport?, extraIssues? })`; `mode`: `'export'` runs all validators first (disabled ones return `[]` automatically), skips modal entirely if 0 issues, otherwise opens pre-filled (no spinners); `'validate'|'import'` opens immediately with spinners, only enabled validators shown; footer: `'export'` → Fix first + Export/Export anyway; `'validate'|'import'` → OK/Great! + "— All good" title suffix when clean |
| `sampledata/library.json` | Library index — flat JSON array of group objects `{id, label, items[]}` where each item is `{label, file, type, note?}`; `type` is `'questionnaire'` or `'qr'`; consumed by `library-modal.js` to populate the Load from Library modal |
| `sampledata/example-bariatric.fhir.json` | FHIR R4 example (bariatric pre-authorization). Contains `contained[]` with 2 ValueSets (`vs-comorbidities`, `vs-vitamin-deficiencies`); two items use `answerValueSet`. Constraints: `diet-min-months` (error, integer ≥ 3), `phq9-severity` (warning, score < 15), `bmi-eligibility` (error, readOnly calc ≥ 35) |
| `sampledata/annual-health-check.fhir.json` | **Annual Health Check** — covers all FHIR features: `version`/`publisher`, `prefix`, `item.code[]` (LOINC), `minValue`/`maxValue`, `rendering-style` (bold section headers + blue italic label), `sliderStepValue`, `repeats`+`minOccurs`/`maxOccurs` (medications is `required:true` to satisfy R4 context invariant), `ordinalValue` (PHQ-9 mood), `enableWhen`, `initial[]`, `maxLength`, `calculatedExpression` (BMI), `questionnaire-constraint` (warning when referral set but no notes — expression stored as `valueString` per R4 spec), `sdc-questionnaire-shortText` (6 items: Mood, Pain level, Pain site, Exercise days, Referral, Clinical notes) |
| `sampledata/valueset-demo.fhir.json` | **Lifestyle & Social History Assessment** — 3 contained ValueSets (SNOMED, LOINC, example.org); 4 items with `code[]` and prefix: 3 using local `#vs-id` refs, 1 using external URL (`q-occupation` with per-item `preferredTerminologyServer = https://r4.ontoserver.csiro.au/fhir`); questionnaire-level `preferredTerminologyServer = https://tx.fhir.org/r4`; `rendering-style` on group header |
| `sampledata/sdc-variables-demo.fhir.json` | **BMI & Body Composition Assessment** — SDC questionnaire-level variables (`%weightKg`, `%heightM`, `%bmiCalc`) + `calculatedExpression`; LOINC `code[]` + `minValue`/`maxValue` on height/weight; `maxDecimalPlaces: 1` on weight and height |
| `sampledata/slider-disabled-demo.fhir.json` | **Pain & Symptom Assessment** — numeric sliders, `disabledDisplay` (hidden/protected), `ordinalValue` on radio options, `rendering-style` on section headers, LOINC `code[]`, conditional sections via `enableWhen` |
| `sampledata/reference-example.fhir.json` | **Care Referral Request** — `reference` item type (Patient, Practitioner, Encounter) with `questionnaire-referenceResource`; urgency choice with SNOMED code; reason/history text items; `rendering-style` on group headers; `version`/`publisher` |
| `sampledata/1776102565767-...json` | Real-world questionnaire for testing |
| `sampledata/patient-scenario-eligibility.fhir.json` | Scenario: Bariatric Surgery Eligibility — `initialExpression` + `enableWhenExpression` pathways |
| `sampledata/patient-scenario-risk.fhir.json` | Scenario: Pre-op Risk Assessment — readOnly `initialExpression` fields |
| `sampledata/patient-scenario-calc-chain.fhir.json` | Scenario: Risk Score Calc Chain — `initialExpression` → `calculatedExpression` → `enableWhenExpression` pipeline; LOW/MODERATE/HIGH per preset |
| `sampledata/patient-scenario-medication.fhir.json` | Scenario: Medication Review & Allergy Screen — repeating groups (medications, allergy details, OTC supplements), standard `enableWhen` on boolean gates, `required` fields, medication adherence |
| `sampledata/patient-scenario-pediatric.fhir.json` | Scenario: Pediatric Well-Child Visit — `calculatedExpression` (BMI from height/weight), four age-conditional milestone sections via `enableWhenExpression` (infant/toddler/preschool/school-age), `subjectType: Patient` |
| `sampledata/patient-scenario-diabetes.fhir.json` | Scenario: Diabetes Self-Management Check-in — full SDC variable chain: `%hba1c` → `%hba1cRisk` / `%hba1cRiskScore` → `calculatedExpression` risk score → `enableWhenExpression` risk-tier notes; insulin vs oral-meds section switching on `%onInsulin` |
| `sampledata/bariatric-extended.fhir.json` | Synthetic bariatric pre-auth — 87 items, 32 enableWhen, all types |
| `sampledata/ussg-fht.fhir.json` | US Surgeon General Family Health History (49 items, depth 5) |
| `sampledata/prowl-ss.fhir.json` | PROWL-SS post-op pain assessment (44 items) |
| `sampledata/ahrq-medication-safety.fhir.json` | **AHRQ Medication or Other Substance** (HL7 SDC IG example) — 30+ clinical items, 11 contained ValueSets with LOINC codes, `itemControl` (header/footer/gtable), `enableWhen`/`enableBehavior`, `minLength`, `questionnaire-hidden`, `rendering-xhtml`, `rendering-style`, repeating groups, `questionnaire-maxOccurs` |
| `sampledata/prapare-sdoh.fhir.json` | **PRAPARE Social Health Screening** (HL7 SDOH ClinicalCare IG) — 5 clinical groups, all LOINC-coded, `questionnaire-itemControl: drop-down`, `questionnaire-unit`, `questionnaire-optionPrefix`, `itemWeight`, `repeats: true`, `sdc-questionnaire-targetStructureMap` extraction extension |
| `sampledata/phq-9.fhir.json` | PHQ-9 depression screening (11 items) |
| `sampledata/phq-9.stu3.fhir.json` | PHQ-9 in **FHIR STU3** format (`meta.fhirVersion: "3.0.2"`); uses `item.option[]`, `enableWhen.hasAnswer`, `initialInteger`; normalised to R4 automatically on import via `stu3-shim.js`; frozen copy also in `tests/fixtures/` |
| `sampledata/phq-9-response.qr.json` | Sample QuestionnaireResponse for PHQ-9 (mild depression, score 7) — 10 answered items with `valueCoding` (LOINC codes) |
| `sampledata/example-bariatric-response.qr.json` | Sample QuestionnaireResponse for example-bariatric (eligible male patient, BMI 41.5) — groups + nested items |
| `sampledata/1776102565767-…json` | Real-world questionnaire snapshot for regression testing |
| `sampledata/item-control-demo.fhir.json` | **Item Control Demo** — `questionnaire-itemControl` codes: `check-box` (checklist), `autocomplete` (searchable dropdown), `text-area` (multi-line string), `spinner` (integer), `drop-down` (explicit default), `slider` (integer range slider), `lookup` (choice live-search against FHIR terminology server); also demos `questionnaire-usageMode` (display-only item), `sdc-questionnaire-itemMedia` (image on choice), `sdc-questionnaire-itemWeight` (weighted scoring on options) |
| `sampledata/choice-column-demo.fhir.json` | **Choice Column Demo** — `sdc-questionnaire-choiceColumn`: multi-column dropdown display for choice items; medication selector (3 columns: code/display/system with widths) and condition selector (2 columns: ICD-10 code/description) |
| `docs/ROADMAP.md` | Prioritized feature backlog |
| `docs/FHIR-MAPPING.md` | Full FHIR ↔ internal model mapping + not-supported list |
| `package.json` | Node dev tooling — Vitest (`npm test`) + Playwright (`npm run test:e2e`); `serve` devDep used by Playwright webServer |
| `vitest.config.js` | Vitest config — node environment, `tests/**/*.test.js` |
| `playwright.config.js` | Playwright config — Chromium only with `--headless=new` (new headless mode, consistent with headed timing), `testDir: tests/e2e`, `retries: 2` on CI, auto-starts local `serve` (via `node node_modules/.bin/serve`); reporters: `html` (open:never) + `list` |
| `tests/e2e/builder.spec.js` | E2E tests (24) — load/clear form, collapse/expand group, FHIR export, group title edit, delete item/group (cascade), type changes (checkbox/display), bidirectional navigation flash (builder↔preview), node count match on import, answer state persistence, enableWhen (Show When modal), patient preset section visibility, Re-init / initialExpression population; all selectors via `data-testid`; fixtures from `tests/fixtures/` |
| `tests/e2e/contained-panel.spec.js` | E2E tests (17) — Contained Resources card + Answer ValueSet card; chip rendering, JSON viewer modal (open/close via ×/footer/Esc/backdrop), toggle collapse/expand, cards hidden on clear; fixture `tests/fixtures/contained-valueset.fhir.json` |
| `tests/e2e/fhir-features.spec.js` | E2E tests (27) — readOnly enforcement, maxLength counter, minValue/maxValue error display and round-trip, ordinalValue badges in radio/select, ordinalValue round-trip export, minLength error enforcement and round-trip, maxDecimalPlaces error enforcement and round-trip; fixture `tests/fixtures/fhir-features.fhir.json` |
| `tests/e2e/attachment-constraints.spec.js` | E2E tests (19) — `maxSize` and `mimeType` extensions for attachment items: Answer Type modal shows correct values on import, preview hints visible, `accept` attribute set from mimeTypes, file-too-large error tag, round-trip export round-trip for both extensions; fixture `tests/fixtures/attachment-constraints.fhir.json` |
| `tests/e2e/slider-disabled.spec.js` | E2E tests (15) — slider rendering (range input, min/max/step attrs, label update, round-trip), disabledDisplay (hidden absent from DOM, protected dimmed, toggle on condition change, round-trip), builder UI (Answer Type modal numeric section, Show When modal disabledDisplay select, applying changes); fixture `tests/fixtures/slider-disabled.fhir.json` |
| `tests/e2e/metadata-modal.spec.js` | E2E tests (84) — questMetaCard visibility, status badge, modal open/close, fields pre-populated, Advanced section, round-trip export, Apply/Cancel, reset on clear, effectivePeriod, Codes section (toggle + badge + add/remove/edit + round-trip), Resource Meta section (versionId/Generate, source, lastUpdated, profile[], tag[], security[], badge count), **Identifiers section** (toggle, auto-expand, badge count, imported row values, add/remove, system/value/use round-trip, Cancel discards); fixture `tests/fixtures/meta-test.fhir.json` |
| `tests/e2e/support-link.spec.js` | E2E tests — `questionnaire-supportLink` feature: 🔗 icons in builder preview (single / multiple), "More info ↗" buttons in patient view, Props modal editing (open via `action-codes`, expand Support Links section, add/remove URL inputs, Apply updates preview), active-state on Props button; fixture `tests/fixtures/support-link.fhir.json` |
| `tests/e2e/required-modal.spec.js` | E2E tests for Required flag within the States modal — updated from old required-modal; uses `action-states` + `#statesModal` + `states-required-sel` testids; covers open/close, 3-option select, draft pattern (Cancel/Apply), active state, re-open reflects saved value |  
| `tests/e2e/states-modal.spec.js` | E2E tests for the combined States modal — open/close (item + group), item layout (Required select + Read-only + Hidden checkboxes), group layout (no Read-only row), Read-only toggle draft pattern + setActive, Hidden toggle draft pattern + setActive + preview class, combined states active/inactive |  
| `tests/e2e/codes-ordinal.spec.js` | E2E tests (11) — Codes action button active state (with/without codes), modal open/close (Apply/Cancel/×), add/remove/edit code rows, Apply commits + deactivates when all removed, Cancel discards, export round-trip preserving `item.code[]`; fixture `tests/fixtures/codes-ordinal.fhir.json` |
| `tests/e2e/history.spec.js` | E2E tests (13) — undo/redo buttons disabled on fresh start; enabled after adding a group (debounce+ric); undo removes group; redo restores; Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z keyboard shortcuts; history reset after form clear |
| `tests/e2e/autosave.spec.js` | E2E tests (13) — autosave draft "Recent" hidden/visible/loads; autosave toggle persist across reload; tooltip toggle persist across reload; panel width restore from storage; load-confirm dialog: no dialog on empty tree, shown with items, Cancel/Escape keeps tree, proceed opens library |
| `tests/e2e/item-control.spec.js` | E2E tests (7) — `questionnaire-itemControl` builder UI: slider toggle (Answer Type modal numeric section, preview renders range input, round-trip), lookup checkbox (Answer Type modal choice section, preview renders search input, round-trip export); fixtures `tests/fixtures/item-control.fhir.json` |
| `tests/e2e/short-text.spec.js` | E2E tests (6) — `sdc-questionnaire-shortText`: blue badge visible in builder preview for items and groups, hidden in patient view, no badge for items without shortText, export round-trip preserves extension; fixture `tests/fixtures/short-text.fhir.json` |
| `tests/e2e/appearance-copy-to.spec.js` | E2E tests (14) — Appearance modal "Copy to…" feature: button visible in footer, opens Node Picker modal on top, current node excluded, search filters list, confirm disabled until selection, copies CSS style to selected node, source unaffected, target shows copied style on re-open, clearing style + copying removes it on target; no fixture (builds tree via UI) |
| `tests/e2e/expression-copy-to.spec.js` | E2E tests (14) — Expression modal "Copy to…" feature: button visible in footer, opens Node Picker modal on top, current node excluded, search filters list, confirm disabled until selection, copies calc expression to target, source unaffected, target shows copied calc+init on re-open, clearing + copying removes expression on target; no fixture (builds tree via UI) |
| `tests/e2e/initial-copy-to.spec.js` | E2E tests (13) — Default Value modal "Copy to…" feature: button visible in footer, opens Node Picker modal on top, current node excluded, search filters list, confirm disabled until selection, copies default value to target (action link active), target shows copied value on re-open, source unaffected, clearing + copying removes value, multi-node copy, allowedType filtering (groups non-selectable); no fixture (builds tree via UI) |
| `tests/e2e/states-copy-to.spec.js` | E2E tests (12) — States modal "Copy to…" feature: button visible, Node Picker opens on top, current node excluded, search filters, confirm disabled until selection, copies hidden state to target (link active), target shows copied state on re-open, source unaffected, clearing + copying removes state, allowedType filtering; no fixture |
| `tests/e2e/codes-copy-to.spec.js` | E2E tests (12) — Item Properties modal "Copy to…" feature: button visible, Node Picker opens on top, current node excluded, search filters, confirm disabled until selection, copies short-text to target (link active), target shows copied short-text on re-open, source unaffected, clearing + copying removes short-text, allowedType filtering; no fixture |
| `tests/e2e/note-copy-to.spec.js` | E2E tests (13) — Design Note modal "Copy to…" feature: button visible, Node Picker opens on top, current node excluded, search filters, confirm disabled until selection, copies note text to target (link active), target shows copied note on re-open, source unaffected, clearing + copying removes note, cross-type copy (item→group both selectable, allowedType=null); no fixture |
| `tests/fixtures/` | Frozen FHIR samples for e2e tests — do not edit. `example-bariatric.fhir.json`, `patient-scenario-eligibility.fhir.json`, `all-types-repeatable.fhir.json`, `contained-valueset.fhir.json`, `fhir-features.fhir.json`, `slider-disabled.fhir.json`, `meta-test.fhir.json`, `codes-ordinal.fhir.json`, `attachment-constraints.fhir.json`, `item-control.fhir.json`, `short-text.fhir.json` |
| `tests/utils.test.js` | Unit tests for `js/utils.js` (38 tests) |
| `tests/eval.test.js` | Unit tests for `js/eval.js` — `evaluateNode`, `markAllDisabled`, `enableWhen` AND/OR logic, `_hidden`/`hiddenRoot` marking (32 tests) |
| `tests/calc.test.js` | Unit tests for `js/fhir/calc.js` — `buildVarEnv`, `evalCalcNodes` (23 tests) |
| `tests/validate.test.js` | Unit tests for `js/fhir/validate.js` — `validateTree`, linkId uniqueness, FHIRPath syntax (calculatedExpr + answerExpression), constraint key checks, fhirpath-unavailable path, all cross-field semantic rules, all R4 invariants que-0–que-13 |
| `tests/explain.test.js` | Unit tests for `js/fhir/explain.js` — `parseExprTree`, `evaluateExprTree`, AND/OR/NOT/LEAF nodes, nested expressions, unmatched parens (40 tests) |
| `tests/export.test.js` | Unit tests for `js/fhir/export.js` — core: structure, type mapping, required, repeats, enableWhen, constraints, answerOption, rawAnswerOptions, groups, SDC variables, OR constraints, renderStyle, contained, answerValueSet (66 tests) |
| `tests/export-meta.test.js` | Unit tests for `js/fhir/export.js` — questMeta, Narrative, codes, effectivePeriod, rawCode, initialSelected, multi-initial, entryFormat, choiceOrientation, choiceColumn, displayCategory (78 tests) |
| `tests/export-extensions.test.js` | Unit tests for `js/fhir/export.js` — item extensions: renderXhtml, supportLinks, hidden, minLength, slider, maxDecimalPlaces, contained, resource meta, min/maxValue, occurs, ordinals, prefixes, reference/quantity/expr, exportFHIR, unknown extensions, attachment, replaces, collapsible, openLabel, designNote, answerExpression, regex, optionExclusives (80 tests) |
| `tests/import.test.js` | Unit tests for `js/fhir/import.js` — pure helpers (fhirTypeToItemType, fhirOptsToStr, hasNonCodingOpts, humanEnableWhen, applyVisibility) and main importFHIR block: core fields, enableWhen, constraints, contained, answerValueSet, questMeta, codes, effectivePeriod, supportLinks, hidden, attachment, nested groups (193 tests) |
| `tests/import-extensions.test.js` | Unit tests for `js/fhir/import.js` — extension suites: group items, unknown extensions, replaces, collapsible, openLabel, designNote, answerExpression, regex, optionExclusives (37 tests) |
| `tests/qr-builder.test.js` | Unit tests for `js/fhir/qr-builder.js` — `buildQR`, `buildQRItem`, all answer types incl. `quantity`→`valueQuantity`, `url`→`valueUri`, `reference`→`valueReference`, ordinalValue extension, fallback branches (integer/decimal/quantity/reference 0-defaults, non-group with children, questionnaire empty-string fallback) (47 tests) |
| `tests/qr-import.test.js` | Unit tests for `js/fhir/qr-import.js` — input validation, all value types incl. `valueTime`/`valueReference`/`valueQuantity`/`valueUri`, unrecognised answer type, unmatched linkIds, nested groups, repeat rows, empty/missing answers, values mutation (48 tests) |
| `tests/qr-export.test.js` | Unit tests for `js/fhir/qr-export.js` — `exportQR` download trigger, filename prompt, QR structure; `document`/`Blob`/`URL` globals mocked via `vi.stubGlobal` (17 tests) |
| `tests/stu3-shim.test.js` | Unit tests for `js/fhir/stu3-shim.js` — `isSTU3`, `normaliseSTU3`, `option[]`→`answerOption[]`, `hasAnswer`→`operator:exists`, all `initial<Type>`→`initial[]` conversions (incl. Attachment/Reference), STU3 detection heuristics, immutability (35 tests) |
| `tests/state.test.js` | Unit tests for `evalConstraints` in `js/state.js` — severity filtering, empty/false/throw results, varEnv passing (21 tests) |
| `tests/integration.test.js` | Integration tests for `buildQR` + `evalConstraints` pipeline — decimal/integer pass/fail, wrong key regression, warning-only, nested groups (7 tests) |
| `.github/workflows/test.yml` | GitHub Actions CI — `test` job: Vitest; `e2e` job: Playwright (uploads `playwright-report/` artifact); `deploy` job: bundles app + report into `_site/`, deploys to GitHub Pages (`/playwright-report/` = latest test report); both `test`/`e2e` triggered on every push/PR to main |

---

## Tech Stack

- **ES Modules** — `import/export` between files; requires HTTP server (`npx serve .` or GitHub Pages)
- **Vanilla JS DOM** — left panel (builder) constructed imperatively
- **Event-driven rendering** — cross-module communication via `AppEvents` custom events; preview re-renders on `RESPONSE_CHANGED`, `REINIT_FORM`, etc.
- **FHIRPath** — `window.fhirpath` (global, `lib/fhirpath.min.js`); used in `enableWhenExpression`, `calculatedExpression`, `evalConstraints`, and `buildVarEnv`
- **Playwright** — E2E test suite; **604 tests** across 48 spec files (Chromium); CI via GitHub Actions (`npx playwright test`)
- **Dependency injection** — `dnd.js` and `_shared.js` receive all state via `init()`, no module-level singletons
- **`ctx` object** — `{ renderTree, renderNode, tree, collapsed }` passed down to renderers and panels
- **Vitest** — unit test suite for pure-function modules; **1064 tests** across 20 files; CI via GitHub Actions (`npm test`)
- **GitHub Pages** — https://sergeymosyakov.github.io/fhir-questionnaire-builder/

---

## Architecture

### Node Class Hierarchy (OOP Rendering)

Each node type owns its own DOM rendering via the `renderPreview(res, container, rc)` method:

```
BaseNode            — js/nodes/base-node.js       shared scaffold, dimmed/disabled rows
  ├─ GroupNode      — js/nodes/group-node.js       group rows, AND/OR logic, collapse, refreshIcon()
  └─ ItemNode       — js/nodes/item-node.js        all item types, badges, controls
       ├─ DisplayNode   — js/nodes/display-node.js   display items, category icons, help toggle
       └─ ChecklistNode — js/nodes/choice-node.js    multi-select checkboxes (check-box itemControl)
```

- **`NODE_REGISTRY`** (`js/nodes/index.js`) — `Map<itemType → class>`; dispatch: `NODE_REGISTRY.get(node.itemType)?.prototype.renderPreview.call(node, …)`
- **`_rc`** (`js/preview/render-ctx.js`) — dependency injection hub; node classes read stable refs (`buildControl`, `isMandatory`, etc.) from `_rc` instead of importing `state.js` directly (avoids circular deps)
- **Circular dep rule**: `state.js → nodes/index.js` — node class files **must not** import `state.js`. Inject via `_rc` instead.
- **`js/controls/{type}.js`** — per-type interactive control factories (date picker, select, checkbox, etc.); called via `rc.buildControl(node, ctx)`. Control files do **not** own row rendering.

### State

```js
// Patient context — stored as FHIRPath literal expressions in questVariables (js/ui/patient-ctx.js)
// Seeded as: { name:'age', expression:'30' }, { name:'gender', expression:"'male'" }, etc.
// Accessible in FHIRPath as %age, %gender, %bmi, %pregnant, %smoker, %proc, %comorb

tree              // plain array — questionnaire node tree
values            // plain object — form answers (not reactive; avoids re-render on every keystroke)
questVariables    // plain array — SDC variable entries; patient ctx seeded here
questContained    // plain array — Questionnaire.contained[] raw FHIR resources (round-trip)
questMeta         // plain object — questionnaire-level metadata: id, url, version, title, status, publisher, description
rawFhir           // { value: null } — original FHIR JSON after import
```

### Node Data Model

```js
// Group
{ id, type:'group', title, mandatory,
  enableWhen: [], enableBehavior: 'all'|'any', enableWhenExpression: '',
  constraint: [],
  logicWithParent:'AND'|'OR', children:[] }

// Item
{ id, type:'item', title, mandatory,
  itemType:'text'|'integer'|'decimal'|'checkbox'|'select'|'display'|...,  // 'number' accepted as legacy alias
  enableWhen: [], enableBehavior: 'all'|'any', enableWhenExpression: '',
  constraint: [], options }

// FHIR-imported nodes also carry:
_enableWhenText  // human-readable enableWhen label (e.g. "«Q» = Yes AND «Q2» = No")
_renderStyle     // raw CSS string from FHIR _text.extension[rendering-style]
_renderXhtml     // raw XHTML string from FHIR _text.extension[rendering-xhtml] (round-trip only, not rendered)
_calculatedExpr  // FHIRPath string (SDC calculatedExpression)
_initialExpr     // FHIRPath string (SDC initialExpression) — evaluated once on import + Re-init
_readOnly        // boolean — FHIR item.readOnly
_initialValue    // any — FHIR item.initial[0] value (pre-fills values[] on import)
_prefix          // string — FHIR item.prefix (amber badge; editable in builder)
_codes           // object[] — FHIR item.code[] (preserved round-trip; not displayed)
_maxLength       // integer — FHIR item.maxLength (imported/exported; character counter + maxlength attr enforced in preview)
_minLength       // integer — SDC minLength ext (imported/exported; minlength HTML attr + inline error on blur when non-empty value is too short)
_minOccurs       // integer — questionnaire-minOccurs ext (imported/exported when repeats:true)
_maxOccurs       // integer — questionnaire-maxOccurs ext; enforced in preview — add button disabled at limit
_answerValueSet  // string — FHIR item.answerValueSet URL; round-trip preserved; local #vs-id refs resolved into node.options during import so preview renders real options
_minValue        // number — questionnaire-minValue ext; error badge shown in preview + blocks PASS when violated
_maxValue        // number — questionnaire-maxValue ext; error badge shown in preview + blocks PASS when violated
_optionOrdinals  // object — map of option code → numeric ordinalValue; shown as (N) badge on radio/select options; round-trip safe
_sliderStep      // number — questionnaire-sliderStepValue ext; when set, integer/decimal renders as <input type="range"> slider; editable in Answer Type modal
_disabledDisplay // 'hidden'|'protected' — when not visible: 'hidden' removes item from DOM entirely, 'protected' shows grayed row (default); editable in Show When modal
_choiceOrientation // 'vertical'|'horizontal' — questionnaire-choiceOrientation ext; controls layout of radio button groups (vertical: stacked column, horizontal: inline row); editable in Answer Type modal for radio items
_displayCategory   // 'instructions'|'security'|'help' — questionnaire-displayCategory ext; applies colored bg + left border + icon (instructions/security) or collapsible help toggle (help) to group items in preview; R4: only exported for group items (suppressed on display items with validator warning); editable in Answer Type modal for group items
_shortText         // string — sdc-questionnaire-shortText ext; abbreviated label for summary views; shown as a small blue badge in builder preview row (not in patient view); round-trip safe; not editable in builder UI
```

---

## Evaluation Logic

### enableWhen
- `node.enableWhen[]` checked against `values[ew.question]` using `checkOneEnableWhen(ew)`
- `node.enableBehavior === 'all'` (default) → all conditions must pass (AND)
- `node.enableBehavior === 'any'` → any one condition passes (OR)
- If `enableWhenExpression` is set, evaluated via `fhirpath.evaluate()` as override/fallback
- Node hidden if conditions not met; `showDimmed` set if any enableWhen is defined

### constraint[]
- Each `node.constraint[]` entry: `{ key, severity, human, expression }` (mirrors FHIR `questionnaire-constraint` extension)
- Evaluated via FHIRPath against the QuestionnaireResponse in `evalConstraints(node, qr, envVars)` in `state.js`
- Empty FHIRPath result (`[]`) or `false` → constraint **fails**; `true` → passes
- `severity: 'error'` fail is counted as a failing item in Final Result; `severity: 'warning'` shows badge only

### Final Result
- **PASS** — all visible, mandatory items satisfied and no `error`-severity constraints fail
- **FAIL** — at least one mandatory item not satisfied, or at least one `error`-severity constraint fails

---

## Preview Rendering (renderPreviewNode)

1. `!visible && showDimmed` → gray row with 🔒 + `_enableWhenText`; if the node is a group, its children are also rendered as disabled (N/A) rows so every builder node has a corresponding preview row
2. `disabled` → gray row with `—` icon, pointer-events:none
3. `type:'group'` with no children → italic gray text (informational display, no controls, no logic badge)
4. Normal → row with ✔/✘ icon, control, linkId prefix, AND/OR badge (groups)
- `_renderStyle` applied as inline `style` on the label span in all row types

### Informational badges (per row)
- **Calc badge** — blue pill with current computed value; refreshed in-place by `refreshCalcBadges()` without full DOM rebuild; tooltip shows FHIRPath expression + SDC spec footer
- **Constraint badge** — amber ⚠️ (warning) or red ✘ (error) when `node.constraint[]` non-empty; tooltip shows key/human/expression; error + fail blocks Final Result
- **Read-only badge** — grey 🔒 `read-only` pill when `_readOnly === true` and no `_calculatedExpr`; `.preview-meta-badge` in `css/preview.css`
- **Default badge** — purple ↺ `default` pill when `_initialValue` is defined; `.preview-meta-badge--init` in `css/preview.css`

---

## FHIR Item Type Support

| FHIR R4 type | `itemType` | Control | Validation | Notes |
|---|---|---|---|---|
| `boolean` | `checkbox` | ✅ | — | |
| `integer`, `decimal` | `number` | ✅ | ✅ `minValue`/`maxValue` validation | `questionnaire-minValue` / `questionnaire-maxValue` extensions enforced; error badge shown; blocks PASS; if `_sliderStep` is set, renders as `<input type="range">` slider instead |
| `quantity` | `quantity` | ✅ number + unit dropdown (UCUM) | ✅ required = value+unit filled | `questionnaire-unit` extension read/written |
| `string`, `text` | `text` | ✅ | — | |
| `date` | `date` | ✅ custom calendar picker | — | |
| `dateTime` | `dateTime` | ✅ custom calendar + time inputs | — | Stored as `YYYY-MM-DDTHH:MM:SS`; QR → `valueDateTime` |
| `time` | `time` | ✅ native `<input type="time">` | — | Stored as `HH:MM:SS`; QR → `valueTime` |
| `url` | `url` | ✅ | ✅ `new URL()` | Invalid format → ✘ even if optional |
| `choice` | `select` / `radio` / `checklist` | ✅ | — | `questionnaire-itemControl: radio-button` → `radio`; `check-box` → `checklist` (multi-select checkboxes); `autocomplete` → searchable dropdown; `drop-down` preserved |
| `open-choice` | `open-choice` | ✅ text + datalist | — | Free-text allowed; datalist populated from `answerOption[]` |
| `display` | `display` | ✅ label | — | No control, no pass/fail |
| `group` | `group` | ✅ | — | |
| `group` (no children) | `group` | ✅ `[Info]` | — | |
| `attachment` | `attachment` | ✅ file input | ✅ required = file chosen | |
| `reference` | `reference` | ✅ dropdown (resource type) + id input | ✅ required = type+id filled | `questionnaire-referenceResource` extension locks dropdown; no live FHIR server search |

---

## FHIR Import (`importFHIR`)

- `enableWhen[]` + `enableBehavior` → `node.enableWhen[]`, `node.enableBehavior`, `node._enableWhenText`
- `sdc-questionnaire-enableWhenExpression` → `node.enableWhenExpression`
- `questionnaire-constraint` extensions → `node.constraint[]`
- `type:group` → group node; `type:boolean` → `itemType:'checkbox'`; `type:choice` → `itemType:'select'` or `'radio'` (if `questionnaire-itemControl: radio-button`) or `'checklist'` (if `check-box`); `autocomplete`/`drop-down`/`text-area`/`text-box`/`spinner`/`slider`/`lookup` → stored as `node._itemControl`
- `_text.extension[rendering-style]` → `_renderStyle` (applied as inline CSS in preview)
- `_text.extension[rendering-xhtml]` → `_renderXhtml` (rendered via `DOMPurify.sanitize()` + `innerHTML` in preview; editable in Appearance modal)
- `item.prefix` → `node._prefix` (amber badge in preview; editable in builder; exported back)
- `item.code[]` → `node._codes` (preserved as-is; exported back unchanged)
- `item.repeats` → `node.repeats` (multi-row input; not for checkbox/display)
- `item.maxLength` → `node._maxLength` (character counter + `maxlength` HTML attribute enforced in preview)
- `minLength` SDC extension → `node._minLength` (inline error shown on blur when non-empty value is shorter than limit)
- `questionnaire-minOccurs` ext → `node._minOccurs` (imported/exported when repeats:true)
- `questionnaire-maxOccurs` ext → `node._maxOccurs` (enforced in preview)
- `questionnaire-minValue` ext (`valueDecimal`/`valueInteger`) → `node._minValue` (enforced in preview — error badge + blocks PASS)
- `questionnaire-maxValue` ext (`valueDecimal`/`valueInteger`) → `node._maxValue` (enforced in preview — error badge + blocks PASS)
- `ordinalValue` extension on `answerOption[].extension` (primary, per FHIR R4 spec) or `answerOption[].valueCoding.extension` (fallback for older files) → `node._optionOrdinals` (map of code → score; shown as `(N)` badge in radio/select)
- `questionnaire-sliderStepValue` ext (`valueDecimal`/`valueInteger`) → `node._sliderStep` (renders integer/decimal as range slider in preview; editable in Answer Type modal)
- `item.disabledDisplay` (R4B native field) → `node._disabledDisplay`; R4 backport extension `extension-Questionnaire.item.disabledDisplay` also read
- `linkIdMap` built before parsing → used for human-readable condition text in `_enableWhenText`

## FHIR Export (`exportFHIR`)

- `node.enableWhen[]` → standard FHIR `item.enableWhen[]` (shallow-copied directly)
- `node.enableBehavior === 'any'` → `item.enableBehavior: 'any'`
- `node.enableWhenExpression` → SDC `sdc-questionnaire-enableWhenExpression` extension
- `node.constraint[]` → `questionnaire-constraint` extensions
- `node._maxLength` → `item.maxLength` (when set)
- `node._minLength` → `minLength` SDC extension with `valueInteger` (when set)
- `node._minOccurs` → `questionnaire-minOccurs` extension (when `node.repeats` **and** `node.required === true` — R4 context invariant `que-minoccurs-1`)
- `node._maxOccurs` → `questionnaire-maxOccurs` extension (when `node.repeats`)
- `node._minValue` → `questionnaire-minValue` extension (`valueInteger` when integer, `valueDecimal` otherwise)
- `node._maxValue` → `questionnaire-maxValue` extension (`valueInteger` when integer, `valueDecimal` otherwise)
- `node._optionOrdinals` → `ordinalValue` extension on each `answerOption[].extension` (at answerOption level, per FHIR R4 spec) that has an entry
- `node._sliderStep` → `questionnaire-sliderStepValue` extension (always `valueInteger`; decimal steps rounded; R4 constraint)
- `node._disabledDisplay` (when not `'protected'`) → `item.disabledDisplay` (omitted when `'protected'` as it is the default)
- `itemType:'radio'` → exports `type:'choice'` + standard `questionnaire-itemControl: radio-button` extension (round-trip safe)
- `itemType:'checklist'` → exports `type:'choice'` + `questionnaire-itemControl: check-box` extension + `repeats: true` (round-trip safe)
- `node._itemControl` → exports corresponding `questionnaire-itemControl` extension code (`autocomplete`, `drop-down`, `text-area`, `text-box`, `spinner`, `slider`, `lookup`)
- Downloads as `<name>.json` (user prompted for filename)

---

## Key UX Features

- **Bidirectional navigation** — `↗` icon on every active preview row (visible on hover; `data-testid="preview-nav-btn"`) → scroll+flash builder node (teal); click builder node header → scroll+flash preview row (blue); `↗` button on every builder node header provides explicit one-click navigation to the corresponding preview row; dimmed and disabled rows remain fully clickable (no interactive controls there)
- **Drag & drop reorder** — ⠿ handle on every node; drag to reorder, drop between nodes (blue line), drop into group (dashed zone), drop at root level; ancestor→descendant drop blocked
- **Copy / paste nodes** — ⧉ copy icon in each node title row serializes the node (and its full subtree) via `nodeToFHIRItem` → JSON; ↑⧉ / ↓⧉ paste icons (hidden until clipboard has content) call `CopyPaste.pasteBefore` / `CopyPaste.paste`; linkIds remapped automatically (`-copy`, `-copy-2`, …); `enableWhen[].question` rewritten for intra-subtree refs; post-paste warning modal (`PasteWarningModal`) lists broken external expression references and structural FHIRPath hits (`js/ui/copy-paste.js`, `js/ui/modals/paste-warning-modal.js`)
- **Appearance "Copy to…"** — **Copy to…** button in the Appearance modal footer opens the **Node Picker modal** with `allowedType = node.type`; only nodes of the same type (group or item) are selectable — others shown as non-selectable headers; on confirm dispatches `AppEvents.COPY_TO_NODES {ids, patch, nodeType}` — `BaseNode` skips type mismatches as a safety guard; propagates `_renderStyle` / `_renderXhtml` / `_renderMarkdown` (`js/ui/modals/node-picker-modal.js`)
- **Expression "Copy to…"** — identical "Copy to…" button in the Expression modal footer; same `allowedType` filtering; `_buildPayload()` merges `buildPatch()` from all `EXPR_SECTIONS` (dual mode: `_calculatedExpr` + `_initialExpr`; single mode: the one configured field); dispatches `AppEvents.COPY_TO_NODES` — matching nodes receive both expression fields at once
- **Collapse sections (preview)** — `▼/▶` toggle on each group row in the preview; SVG corner-arrow icon buttons in the preview toolbar collapse/expand all (appear when tree is non-empty, right-aligned via flex spacer)
- **Header actions order** — `Questionnaires ▾` | `Answers ▾` | `⬇ Save ▾` | `👁️ Preview ▾` | `⚙️ View ▾`; toolbar row (second line): 🔍 Search | [flex spacer] | Validate | badge | collapse | expand; Save dropdown: ☁ Cloud (when logged in) + separator + Questionnaire · JSON file + QuestionnaireResponse · JSON file
- **GitHub OAuth / cloud save** — Sign in button in top panel (shown when logged out); GitHub OAuth via Supabase redirects back to current page URL; on login: avatar+username button (`btn-fhir` style with `▾`) replaces sign-in button, opens dropdown with Sign out; cloud save: `☁ Cloud` item in Save ▾ dropdown (hidden when logged out or tree empty); `From Cloud…` in Questionnaires ▾ dropdown; cloud data stored in Supabase `questionnaires` table with RLS (`auth.uid() = user_id`); `_currentCloudId` tracks opened cloud row for in-place updates; sign out with non-empty tree prompts confirmation dialog
- **Boolean tristate** — all `boolean`/`checkbox` items render an indeterminate (gray-fill) checkbox when unanswered (`values[id] === undefined`); first click → `true`; subsequent clicks toggle `true ↔ false`; for `required` items `calcFormOk` passes only for `true`/`false` (not `undefined`) — FHIR: `required` means an answer must be given, not that the answer must be `true`
- **Editable linkId** — blue monospace input in the builder node header; directly edits `node.id`
- **item.prefix** — FHIR R4 `Questionnaire.item.prefix` imported into `node._prefix` and exported back (round-trip safe); amber pill badge in preview; editable in builder meta-row; **Renumber** assigns sequential prefixes (e.g. `1`, `1.1`) — writes `_prefix` only, never changes `node.id`
- **linkId / prefix toggles** — `id` (blue) and `prefix` (amber) buttons in preview toolbar toggle the corresponding pill badges; clicking a linkId badge copies the linkId to clipboard (✓ copied feedback); badge shows rich tooltip with visibility-rule usage, expected value type, item type
- **SDC Variables** — `sdc-questionnaire-variable` extensions on the root Questionnaire are imported into `questVariables[]`; a collapsible card above the tree shows `%name` chips (with rich tooltips showing expression + FHIR spec footer); Edit modal uses draft pattern — Apply commits, Cancel discards; variables passed as `%varName` env vars when evaluating `calculatedExpression`; round-trip safe on export
- **Default value (item.initial[])** — `item.initial[0]` imported → `node._initialValue`; pre-fills the preview on load; editable via **Default** action panel in builder; control adapts to itemType (select for checkbox/choice, date, number, text); `× clear` link updates preview instantly; exported back as `item.initial[]`
- **Constraint modal** — **Constraint** action button opens a centered modal (`js/ui/constraint-modal.js`) with draft pattern; editable cards per constraint (key, severity, human message, FHIRPath expression, remove) + **+ Add constraint**; Apply commits, Cancel discards; exported as `questionnaire-constraint` extensions
- **Constraint badge in preview** — per-node badge: amber ⚠️ `constraint` (warning or passing error), red ✘ `constraint` (failing error); tooltip; affects Final Result when `severity: 'error'` and expression fails or returns empty
- **Read-only enforcement** — `_readOnly: true` items show a styled `.preview-readonly-value` placeholder (value or `—`) instead of an input; input cannot be edited; 🔒 `read-only` badge shown; does not block PASS/FAIL
- **maxLength enforcement** — `node._maxLength` sets the `maxlength` HTML attribute on text/url inputs + renders a live character counter `(N/M)` below the input
- **minLength enforcement** — `node._minLength` (SDC extension) sets the `minlength` HTML attribute on text/url inputs; inline error `Min N chars` shown on blur when value is non-empty but shorter than the limit; clears when value reaches or exceeds the limit
- **minValue/maxValue enforcement** — `questionnaire-minValue` / `questionnaire-maxValue` extensions imported into `_minValue`/`_maxValue`; `min`/`max` HTML attributes set on number inputs; error badge shown inline when value is out of range; blocks PASS/FAIL
- **ordinalValue display** — `ordinalValue` extension on `answerOption.extension` (or `valueCoding.extension` fallback) imported into `_optionOrdinals`; shown as `(N)` badge on each radio option label and in the select trigger + dropdown items; exported back to `answerOption.extension` (FHIR R4 spec); editable in Answer Type modal — append `=score` to any option: `code=Label=0,code2=Label2=1`
- **Slider input** — `questionnaire-sliderStepValue` extension imported into `_sliderStep`; when set, integer/decimal item renders as `<input type="range">` with a live value label; `min`/`max` attrs from `_minValue`/`_maxValue` (default 0/100); step from `_sliderStep`; exported back as `questionnaire-sliderStepValue` (`valueInteger` always; decimal steps are rounded on export; R4 constraint); editable in Answer Type modal — Min / Max / Slider step fields shown for integer/decimal types
- **disabledDisplay** — `item.disabledDisplay` (R4B native field, also R4 backport extension) imported into `_disabledDisplay`; `'hidden'` removes the item row entirely from the DOM when condition is not met (vs `'protected'` default which grays it out); exported back; editable in Show When modal — dropdown `When not visible: Show grayed (protected) / Remove from view (hidden)`
- **Read-only badge** — grey 🔒 `read-only` pill when `_readOnly === true` and no `_calculatedExpr`
- **Default badge** — purple ↺ `default` pill when `_initialValue` is defined
- **Real-time calc badge** — `refreshCalcBadges()` patches calc-badge in-place via `data-calc-id` — no DOM rebuild on answer change
- **Calc-badge tooltip** — shows FHIRPath expression + SDC spec footer
- **Show When modal** — "Show When" action button opens a centered modal (`js/ui/showwhen-modal.js`); draft pattern — `enableWhen[]`, `enableBehavior`, `enableWhenExpression` deep-cloned on open; Apply commits to node + calls `triggerCalcRecalc()`; Cancel discards; action button indicator only changes on Apply (no-op `setActive` passed during editing)
- **Searchable question picker** — enableWhen condition rows have a sticky search input filtering by `id` and title; dropdown rendered as a portal (`document.body`) with `position: fixed` + `getBoundingClientRect()` — escapes `overflow` clipping in any ancestor; auto-flips upward if needed; z-index 10200
- **QR Export** — **⬇ Response** button in toolbar; downloads current answers as FHIR R4 `QuestionnaireResponse` JSON; **QR Export modal** (#qrExportModal) exposes: filename, status, subject, author, resource id, language, meta.versionId (+ Generate UUID), meta.source, meta.profile[] (add/remove list). Fields are pre-populated from the last loaded QR response. `meta.lastUpdated` is always written to current UTC time on export.
- **QR Import (Load Answers)** — **Load Answers…** at bottom of Load dropdown; reads a QR JSON file; loads matched answers into `values[]`; shows warning modal for URL mismatch or unknown linkIds
- **Repeatable items** — `Repeatable` action link opens `js/ui/repeatable-modal.js`; modal: toggle for `node.repeats` + optional **Min** / **Max** cardinality inputs (`questionnaire-minOccurs` / `questionnaire-maxOccurs`); preview renders `.repeat-wrap` with `×` remove + `+ Add another`; `_maxOccurs` enforced — add button disabled at limit; QR export collects all rows into `answer[]`; QR import restores rows; `item.maxLength` imported/exported as `node._maxLength`
- **Shared modal system** — all dialogs (Variables, Show When, Constraints, Patient Context, Validate, Expression Explain) use `.modal-backdrop / .modal-box / .modal-header / .modal-close / .modal-body / .modal-footer / .modal-btn` from `css/modals.css`; per-modal z-index and width via `#id` selectors; tokens `--c-hover` and `--c-text-1` added to `css/styles.css`; title pattern: `.modal-title-label` (bold) + `.modal-title-subject` (muted)
- **Rich tooltips on action buttons** — all builder action buttons (Answer Type, Required, Show When, Applicability, Expression, Default, Appearance), toolbar buttons (Load, Export, Add Root Group, Renumber, prefix format select, id/prefix/collapse/expand), and the Variables card title carry `data-tip-*` attributes with FHIR field path and spec reference (R4 / SDC) in the footer; implemented via delegated `mouseover` in `js/ui/tooltip.js`
- **Tooltip toggle** — `tips` button in the preview toolbar; green = enabled (default), orange = disabled; persisted in `localStorage` (`tooltips-enabled`); **tooltips off** label shown next to Logic Builder heading when disabled
- **Radio answer options in builder** — Answer Type panel shows the Options (comma-separated) editor for `radio` items (bug fix: was shown only for `select` and `open-choice`)
- **Validate button** — standalone **Validate** button in the fhir-toolbar (second header row); runs `validateTree()`; shows green ✅ "All good" when no issues; only visible when questionnaire is loaded
- **Esc closes modals** — Validate modal and Variables modal both close on Escape key
- **Ctrl+F** — intercepts browser find and focuses preview search input (when visible)
- **Auto calculatedExpression** — `_calculatedExpr`/`_readOnly` nodes evaluated via FHIRPath automatically on every render cycle (patient input, answer, or tree change); `buildVarEnv` resolves `questVariables` as `%varName`; no manual Test button
- **Expression Explain modal** — clicking a checkbox `calc-badge` or `👁️`/`🔒` condition-hint badge opens a shared modal; expression parsed into AND/OR/NOT/LEAF tree with ✓/✗ icons; FHIRPath strip at body bottom; single Close button; tooltip says "Click to explain."
- **Live eval icons in builder panels** — `✓`/`✗` icon (`.expr-live-icon`) right of label in `calculatedExpression`, `initialExpression`, `enableWhenExpression` panels; refreshed on panel open + after every recalc; typing lag eliminated: `oninput` → data + debounced icon (400ms); full recalc only on `onblur`
- **Empty-state placeholder** — right panel shows hint text when tree is empty; Validate, Export hidden until questionnaire is loaded
- **Variables card visibility** — controlled by `QUESTIONNAIRE_LOADED` / `QUESTIONNAIRE_CLEARED` / `QUESTIONNAIRE_NEW` events in `app.js`; `refresh()` only updates chips/count
- **PASS/FAIL status badge** — replaces the full-width status bar; a small pill badge (`✓ PASS` / `✗ FAIL · N issues`) in the preview header right of the filename; click opens a dark dropdown listing numbered failing items with ↗ links to navigate directly to the problem field; dropdown has scroll, closes on outside click; implemented in `js/ui/status-badge.js` + `css/status-badge.css`
- **Collapse-safe navigation** — `navigateToPreview(id)` in `render-preview.js` finds collapsed ancestors via `findAncestorGroupIds`, expands them, then scrolls; used by ↗ builder buttons and status-badge dropdown
- **Autosave toggle** — `autosave` button in Logic Builder header (green = on, grey = off); when enabled label shows last save time `autosave · HH:MM`; state persisted in `localStorage` (`autosave-enabled`); rich tooltip explains the feature
- **Variables modal Apply/Cancel** — modal uses a draft pattern: edits are buffered until Apply; Cancel discards the draft (no changes); Apply validates (blocks if name missing), commits to `questVariables`, calls `reinitForm()`; Escape or backdrop = Cancel
- **Variable chip tooltips** — `%varName` chips carry rich tooltips with expression + `Questionnaire.extension[sdc-questionnaire-variable]` FHIR path + SDC spec footer
- **Copyright + GitHub in top panel** — copyright text and GitHub link moved to the top (patient data) panel, right-aligned; order: GitHub icon → copyright text
- **Expandable title** — node title shown as a read-only span; click → expands to a full-width textarea (auto-height), collapses on blur
- **Style editor** — `Style` panel on every node: Bold / Italic checkboxes, color picker, raw CSS field. Syncs with `_renderStyle`; applied live in preview. XHTML section for `_renderXhtml` (sanitized via DOMPurify; rendered as `innerHTML` in preview)
- **Auto-scroll on add** — `+ Group`, `+ Item`, `Add Root Group` scroll to and flash the new node; parent group auto-expands
- **Visual condition builder** — "Show When" action panel uses FHIR `enableWhen[]` directly: AND/ANY toggle, per-condition rows (question picker + operator + type-aware value input), "+ Add condition", FHIRPath `enableWhenExpression` for advanced expressions
- **Patient Context popup** — "Patient Context" button in toolbar opens modal; sets `%age`, `%gender`, `%bmi`, `%pregnant`, `%smoker`, `%proc`, `%comorb` as FHIRPath literal expressions in `questVariables`; button disabled when no questionnaire is loaded; Apply fires `REINIT_FORM` + `PATIENT_CTX_APPLIED` events → immediate preview re-eval; `variablesPanel.refresh()` updates chips
- **AND/OR badges** — on group headers: `ALL items ✓` / `ANY item ✓`
- **Logic separators** — `— AND —` / `— OR —` between sibling items inside a group
- **Dimmed rows** — conditional items shown grayed (🔒) when condition not met; groups also show their children as disabled (N/A) rows; animate to active when met
- **Informational rows** — `type:'group'` nodes with no children rendered as plain italic text; labeled `[Info]` in builder
- **required text/number** — `required:true` on text/number items means non-empty; shows ✔/✘ icon and affects PASS/FAIL
- **select / radio controls** — no longer auto-fill the first option on render; mandatory fields start empty (`— select —` placeholder for select, no pre-check for radio) so PASS/FAIL is accurate on initial load
- **text / number / date / url / attachment / quantity / reference controls** — `oninput` calls `_reCalc()` (calc badge updates live) without triggering a full preview rebuild; `onchange`/blur dispatches `RESPONSE_CHANGED` event (re-evaluates enableWhen + constraints on discrete commit)
- **Entry format hint (entryFormat)** — `sdc-questionnaire-entryFormat` SDC extension imported/exported via `js/fhir/import.js` / `js/fhir/export.js`; stored as `node._entryFormat`; applied as `placeholder` on text, url, number and quantity input controls; editable in **Answer Type** modal via "Placeholder hint" field (shown only for input-bearing types); label carries a rich tooltip with FHIR path + SDC spec footer; `z-index` of rich tooltip raised to `10500` to appear above all modals
- **Usage mode (questionnaire-usageMode)** — R4 extension controlling item visibility by context; 6 codes: `capture-display`, `capture`, `display`, `display-non-empty`, `display-when-answered`, `hidden`; imported into `node._usageMode`; editable in States modal; preview: `display`/`display-non-empty` items hidden in patient view, badge shown; exported as `questionnaire-usageMode` extension
- **Item media (sdc-questionnaire-itemMedia)** — SDC extension; `valueAttachment` (url + contentType) imported into `node._itemMedia`; rendered inline in preview (img/audio/video); editable in Answer Type modal "Item Media" section; round-trip safe on export
- **Item weight (sdc-questionnaire-itemWeight)** — SDC extension on `answerOption`; `valueDecimal` imported into `node._optionWeights` map; displayed as `[w:N]` badge on choice/radio option labels in preview; editable in Answer Type modal options editor (Weight column); exported back to answerOption extensions
- **Answer media (sdc-questionnaire-answerMedia)** — SDC extension on `answerOption`; `valueAttachment` imported into `node._answerMedias` map; rendered inline next to option labels in preview; editable in future builder iteration; round-trip safe on export

---

## Running

> **Requires HTTP server** — ES modules do not work over `file://`.

### Locally
```powershell
.\start.ps1
# or: npx serve .
# open http://localhost:3000
```

### GitHub Pages
https://sergeymosyakov.github.io/fhir-questionnaire-builder/

---

## Known Limitations / TODO

- Multi-condition visibility with complex FHIRPath (cross-group references, extensions) not supported in the visual enableWhen builder — must be typed as `enableWhenExpression` directly

