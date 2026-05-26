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
| `js/app.js` | Entry point — wires inputs, buttons, loads example; registers `LocalStorageAdapter`; wires undo/redo buttons + Ctrl+Z/Y/Shift+Z keyboard shortcuts; calls `initPreview(…)` to inject DOM references into render-preview.js |
| `js/app-load.js` | File loading, QR answers, import pipeline, filename display; `importAndValidate(data, fileName)` — FHIR import + validate + render; `_askBeforeLoad()` — confirm dialog shown when tree non-empty (warns that undo history will be lost); wraps all three load paths (file, library, recent draft) |
| `js/state.js` | Domain data only — reactive tree, answer values, FHIR metadata, data factories, business logic, `evalConstraints`; exports `questMeta` reactive object (id, url, version, name, title, status, language, publisher, description, date, subjectType, purpose, copyright, approvalDate, lastReviewDate, effectivePeriodStart, effectivePeriodEnd, experimental, _rawContact, _rawUseContext, _rawJurisdiction, _rawCode); `CHECKABLE_TYPES` and `NONEMPTY_TYPES` include `time` and `dateTime` (mandatory items of these types participate in PASS/FAIL validation) |
| `js/render-bus.js` | Render coordination bus — `_formTick = ref(0)` (increment to trigger preview `effect()` re-run) and `_bulkUpdate = ref(false)` (set to true before mass tree mutations to suppress intermediate renders). Imported by `render-preview.js`, `builder/index.js`, `fhir/import.js`, `app.js`. Controls (quantity, checkbox, etc.) receive `_formTick` via ctx injection from `render-preview.js` — they do not import this module directly. |
| `js/utils.js` | Pure utility functions (`escAttr`, `findAndRemove`, `isDescendant`, `findAncestorGroupIds`, `parseOption`, `parseOptions`) |
| `js/eval.js` | Tree evaluation — `enableWhen[]` visibility, `enableWhenExpression` FHIRPath, `evalConstraints`; `evaluateNode(node, ctx, results, _insideHidden)` — hidden nodes (`node._hidden` or `_insideHidden=true`) are marked `{hidden:true, hiddenRoot:bool}` and excluded from normal enableWhen evaluation; all descendants recursed with `_insideHidden=true` |
| `js/render-builder.js` | Left panel — 3-line re-export shim → `js/builder/` |
| `js/builder/ctx.js` | `BuilderCtx` JSDoc typedef (no runtime exports) |
| `js/builder/index.js` | Builder orchestrator — public API (`renderTree`, `collapseAll`, `renumberAll`, `addRootGroup`, `renderTreeAsync`) |
| `js/builder/_shared.js` | Shared utilities; injected deps via `init(deps)`; `getAllItems`, `triggerCalcRecalc`, `confirmDelete` |
| `js/builder/dnd.js` | Self-contained drag & drop; all state via `init(onDrop, tree, formTick)` |
| `js/builder/panels.js` | Action panel builders: `addPanel`, `buildVisPanel` (enableWhen), `buildTypePanel` (type+options — dead code; only used as a reference), `buildStylePanel` (appearance for groups). Dead functions `buildMandPanel` / `buildInitialPanel` / `buildConstraintPanel` / `buildSupportLinkPanel` removed — those actions moved to dedicated modals |
| `js/ui/modal-registry.js` | Singleton `MODAL_REGISTRY: Map<string, module>` — zero deps; each modal calls `MODAL_REGISTRY.set(key, {open, …})` at import time; node classes call `MODAL_REGISTRY.get(key).open(…)` without importing modals directly (avoids circular deps) |
| `js/render-preview.js` | Right panel — reactive preview; `initPreview(elements)` called once from app.js to inject DOM refs (DI pattern); injects all stable refs into `_rc` (`buildControl`, `buildRepeatControls`, `_formTick`, `isMandatory`, `calcFormOk`, `evalConstraints`, `getValue`, `CHECKABLE_TYPES`, `viewPrefs`, etc.); **Preview mode dropdown** (`previewMode.value`; `'preview'|'patient'|'json'`): `#previewModeWrap` dropdown with three options; **Patient** mode skips hidden items, nav buttons, badges, condition hints, ok/fail icons — renders a clean form as a patient sees it; **FHIR JSON** mode hides `#lform`, shows `<pre id="fhirJsonView">` with syntax-highlighted JSON (via `highlightJson`); search works in JSON mode (highlights `<mark>` via `highlightJsonWithSearch`); **Hidden items** (`sdc-questionnaire-hidden`): rendered with purple dashed border + striped background + **HIDDEN badge** in builder preview when `showHiddenItems` toggle is on; `buildRepeatControls` renders multi-row repeat UI; enforces `node._maxOccurs` — add button disabled at limit; `hasCriteria` includes `hasConstraints`+`hasRange` |
| `js/preview/render-ctx.js` | `_rc` — dependency injection hub; populated by `render-preview.js` at startup and extended by `render-node.js`; breaks circular deps between node class files and `state.js`/`render-bus.js`; fields: `ctx`, `resultMap`, `cEnv`, `visible`, `groupIconMap`, `previewMode`, `viewPrefs`, `formTick`, `renderNode`, `updateGroupIcons`, `isMandatory`, `calcFormOk`, `evalConstraints`, `getValue`, `CHECKABLE_TYPES`, `buildControl`, `buildRepeatControls`, `scrollToBuilder`, `collapsedGroups` |
| `js/preview/render-node.js` | Thin dispatcher (35 lines) — `renderPreviewNode(res, container)` dispatches to `GroupNode.prototype.renderPreview` or the appropriate `NODE_REGISTRY` class; `updateGroupIcons()` iterates `_rc.groupIconMap` and calls `GroupNode.prototype.refreshIcon`; sets `_rc.renderNode` and `_rc.updateGroupIcons` at module load |
| `js/nodes/base-node.js` | Base class for all preview nodes — `BaseNode`; owns `renderPreview(res, container, rc)` entry point, shared DOM scaffold (`_createBaseRow`, `_buildLabel`, `_buildSupportLinks`, `_buildVisHint`, `_buildRowContent`, `_appendRow`), dimmed/disabled renderers, `_evalCondition` (base stub), `applyRenderStyle()` and `createWrap()` helpers exported for reuse |
| `js/nodes/item-node.js` | `ItemNode extends BaseNode` — all non-group, non-display item types; overrides `_evalCondition`, `_buildLabel`, `_buildRowContent`, `_buildConstraintBadge`, `_buildCalcBadge`, `_appendRow`; **`buildBuilder(ctx)`** — renders the builder-panel row for this item (DnD, action links, modals via `MODAL_REGISTRY`); all builder deps injected through `ctx`; **`supportsRepeat() → true`** — overridden by `CheckboxNode` and `DisplayNode` to return `false`; `buildBuilder` uses `!node.supportsRepeat()` to hide the repeat action link |
| `js/nodes/group-node.js` | `GroupNode extends BaseNode` — group nodes; overrides `_evalCondition`, `_buildLabel`, `_buildRowContent`, `_renderChildren`, `_renderDimmedChildren`, `_renderDisabledChildren`; **`refreshIcon(rc)`** — updates pass/fail icon; **`buildBuilder(ctx)`** — renders the builder-panel row for this group (collapse toggle, child list, ⊕ Add dropdown, DnD, action links, style panel, modals via `MODAL_REGISTRY`) |
| `js/nodes/display-node.js` | `DisplayNode extends ItemNode` — `itemType:'display'`; `buildControl()` returns empty `createWrap()`; `_initRowClass` adds `.lform-item--{_displayCategory}`; `_buildLabel` renders help toggle (cat `'help'`) or plain label; `_buildRowContent` shows category icon (instructions/security), no interactive control |
| `js/nodes/index.js` | `NODE_REGISTRY` — `Map<itemType → class>`; all node classes registered; re-exports `GroupNode`, `ItemNode`, `BaseNode`, `DisplayNode` and all concrete item classes |
| `js/fhir/import.js` | FHIR R4 → internal model; calls `normaliseSTU3()` first (no-op for R4); reads `item.repeats`, `item.maxLength` (→ `_maxLength`), `sdc-questionnaire-entryFormat` extension (→ `_entryFormat`), `questionnaire-choiceOrientation` extension (→ `_choiceOrientation`), `questionnaire-displayCategory` extension (→ `_displayCategory` for `display` items), `item.answerValueSet` (→ `_answerValueSet`), `Questionnaire.contained[]` (→ `questContained`), `questionnaire-minOccurs`/`questionnaire-maxOccurs` extensions, `questionnaire-minValue`/`questionnaire-maxValue` extensions (→ `_minValue`/`_maxValue`), `ordinalValue` extension on `answerOption.extension` (primary) or `answerOption.valueCoding.extension` (fallback) → `_optionOrdinals`, `questionnaire-sliderStepValue` extension (→ `_sliderStep`), `item.disabledDisplay` field + R4 backport extension (→ `_disabledDisplay`), `questionnaire-supportLink` extension 0..* (→ `_supportLinks` string[]; on both items and groups), `sdc-questionnaire-hidden` extension (→ `_hidden = true`; on both items and groups), `maxSize` extension (→ `_maxFileSizeMB` for attachment items), `mimeType` extensions 0..* (→ `_mimeTypes` string[] for attachment items), `questionnaire-optionPrefix` extension on `answerOption[].extension` (→ `_optionPrefixes` map of code→prefix string); populates `questMeta` (id, url, version, name, title, status, **language**, publisher, description, date, subjectType, purpose, copyright, approvalDate, lastReviewDate, effectivePeriodStart, effectivePeriodEnd, **experimental**) on import; stores `contact[]`, `useContext[]`, `jurisdiction[]`, `code[]` as pass-through fields (`_rawContact`, `_rawUseContext`, `_rawJurisdiction`, `_rawCode`); `answerOption[].initialSelected` → `node._initialSelected` (round-trip); `item.initial[]` multi-value for repeating items → `node._initialValues[]` + `node._initialValue` (first value); `applyInitialValues` maps first value to base id, subsequent values to `$$1..$$N`, and sets `$$n = length - 1` (extra row count); exports `resolveContainedValueSet(contained, ref)` |
| `js/fhir/stu3-shim.js` | STU3 → R4 normalisation shim — `normaliseSTU3(fhirJson)` returns R4-compatible copy (deep-cloned) or original unchanged if already R4; `isSTU3(fhirJson)` detects by `meta.fhirVersion` 3.x/1.x or STU3-only item fields; converts: `item.option[]`→`item.answerOption[]`, `item.options`(Reference)→`item.answerValueSet`, `enableWhen.hasAnswer`→`operator:exists+answerBoolean`, STU3 implicit equality→`operator:'='`, `item.initial<Type>`→`item.initial:[{value<Type>}]`; works recursively; no side effects |
| `js/fhir/export.js` | Internal model → FHIR R4; writes `maxLength`, `sdc-questionnaire-entryFormat` extension (from `_entryFormat`), `questionnaire-choiceOrientation` extension (from `_choiceOrientation`), `questionnaire-displayCategory` extension (from `_displayCategory`), `item.answerValueSet` (from `_answerValueSet`), `Questionnaire.contained[]` (from `questContained`), `questionnaire-minOccurs`/`questionnaire-maxOccurs` when `node.repeats`, `questionnaire-minValue`/`questionnaire-maxValue` from `_minValue`/`_maxValue`, `ordinalValue` extension on `answerOption.extension` (from `_optionOrdinals`), `questionnaire-sliderStepValue` extension from `_sliderStep` (`valueInteger` or `valueDecimal`), `item.disabledDisplay` from `_disabledDisplay`, `questionnaire-supportLink` extension entries from `_supportLinks[]` (one `valueUri` per entry; on both items and groups), `sdc-questionnaire-hidden` extension (`valueBoolean: true`) when `node._hidden` (on both items and groups), `maxSize` extension (`valueDecimal`) from `_maxFileSizeMB` for attachment items, `mimeType` extensions (one `valueCode` per entry) from `_mimeTypes[]` for attachment items, `questionnaire-optionPrefix` extension on each `answerOption.extension` (one `valueString` per option) from `_optionPrefixes` map; emitted alongside `ordinalValue` when both are present; uses all `questMeta` fields (id, url, version, name, title, status, **language** (omitted when empty), **experimental** (omitted when null), publisher, description, date, subjectType, purpose, copyright, approvalDate, lastReviewDate) for root-level Questionnaire properties; `subjectType` comes from `questMeta.subjectType` (comma-separated string → array, default `['Patient']`); `date` preserved from import or falls back to today; writes `effectivePeriod` from `effectivePeriodStart`/`effectivePeriodEnd` when non-empty; writes back `_rawContact`, `_rawUseContext`, `_rawJurisdiction`, `_rawCode` pass-through arrays unchanged; marks `answerOption[].initialSelected` from `node._initialSelected`; exports `item.initial[]` as multi-value array for repeating items with `_initialValues`; skips writing `answerOption` when `_answerValueSet` is set |
| `js/fhir/qr-export.js` | `exportQR(fileName)` — builds QR from current tree + answers, downloads JSON |
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
| `js/ui/codes-modal.js` | **Item / Group Properties** modal — `init(elements)`, `open(node, link, setActive)`; draft pattern; four collapsible sections: **Definition URL** (`node._definition`), **Codes** (`node._codes[]` — system/code/display rows), **Support Links** (`node._supportLinks[]` — URL inputs, 0..*), **Extensions** (`node._unknownExtensions[]` — structured editor for unrecognised FHIR item extensions: URL text input, value-type custom-select, contextual value field — textarea for string/JSON types, number input for integer/decimal, boolean custom-select; all changes draft-based, committed on Apply); Apply commits all four fields; Cancel discards; action button highlighted when any field is non-empty; shared `renderCodesEditor(draft, container, prefix, label?)` exported for reuse — optional `label` parameter customises empty-state text and add-button label (default `'code'`); available on both items and gro...
| `js/ui/json-viewer.js` | Shared read-only FHIR JSON viewer modal — `init(elements)`, `show(title, data)`, `close()`; Esc / backdrop / × close |
| `js/ui/contained-panel.js` | Collapsible read-only card for `Questionnaire.contained[]` — `init(elements, containedArray, showJsonFn)`, `refresh()`; each chip opens JSON viewer |
| `js/ui/answer-valueset-panel.js` | Collapsible read-only card for items using `answerValueSet` — `init(elements, treeRef, showJsonFn)`, `refresh()`; collects unique URLs; each chip shows URL + `usedByItems` |
| `js/ui/modals/modal-base.js` | `Modal` base class — `constructor({cancelLabel, applyLabel, maxWidth, bodyClass})` builds and appends modal DOM to `document.body`; exposes `this.body`, `this.title`; `open()` shows backdrop, `close()` hides it; subclass overrides `open()`, `_apply()`, `_cancel()`; single shared Escape handler closes topmost open modal; `static _svc` holds injected services; `static configure(services)` called once at startup. Never monkey-patch `_modal._apply = fn` — always use `extends Modal`. |
| `js/ui/showwhen-modal.js` | Show When (enableWhen) centered modal — draft pattern; Apply commits + triggers preview re-render; Cancel discards; no-op `setActive` during editing so action button only changes on Apply; **disabledDisplay** `<select>` appended at bottom of modal body (options: `protected` / `hidden`; editable via `disabled-display-select` testid) |
| `js/ui/constraint-modal.js` | Constraint edit modal — draft pattern; `node.constraint[]` deep-cloned on open; Apply commits + calls `triggerCalcRecalc()` + updates button state; Cancel discards; expression field is a resizable `.expr-textarea`; each card has an **Explain** button (uses `window.fhirpath` directly) |
| `js/ui/expression-modal.js` | FHIRPath expression modal — `init(elements)`; two modes: `open(cfg)` single-field (groups: calculatedExpression only); `openDual(node, link, setActive, cb)` dual-field (items: calc + init in one modal with `.expr-section-hdr` visual section headers separated by `.expr-modal-sep`); draft pattern; auto-resize `.expr-textarea`; live expr icon via debounced `refreshExprIcons`; Escape / backdrop close |
| `js/ui/initial-modal.js` | Default Value edit modal — `init(elements)`, `open(node, initLink, setActive)`; draft pattern; renders context-aware control per `itemType`; Apply commits `node._initialValue` + `values[node.id]` + calls `triggerCalcRecalc()` |
| `js/ui/appearance-modal.js` | Appearance (rendering-style + rendering-xhtml) edit modal — `init(elements)`, `open(node, styleLink, setActive)`; two sections with `expr-section-hdr` headers + `data-tip-*` tooltips; Style section: Bold / Italic checkboxes, color picker + clear, raw CSS `<textarea rows=1>`; XHTML section: raw XHTML `<textarea rows=3>` (round-trip only, not rendered in preview); Apply sets `node._renderStyle` and `node._renderXhtml` |
| `js/ui/states-modal.js` | **States** modal — `init(elements)`, `open(node, statesLink, setActive)`; draft pattern; 3 controls: Required select (null/true/false), Read-only checkbox (items only — row hidden for groups), Hidden checkbox; Apply commits all 3 + `triggerCalcRecalc()`; link active when `mandatory===true \|\| _readOnly \|\| _hidden` |
| `js/ui/answer-type/modal.js` | Answer Type edit modal — `init(elements)`, `open(node, typeLink, setActive)`; draft pattern; renders type dropdown + iterates `SECTION_REGISTRY` for conditional sections; `_apply()` delegates all node-field commits to `SECTION_REGISTRY.forEach(s => s.commit(pending, node))` — no type-specific if-chains in modal |
| `js/ui/section.js` | Generic `Section` base class — `build(pending)→Node`; extended by both `AnswerTypeSection` and all `MetaSection` subclasses, making the registry pattern reusable across all modals |
| `js/ui/answer-type/base-section.js` | `AnswerTypeSection extends Section` + `SECTION_REGISTRY` array; declares four additional methods (all no-ops): `isVisible(type)`, `initDraft(node)→object`, `onTypeChange(type)`, `commit(pending, node)`; subclasses override all five; `open()` in modal.js builds `_pending` via `Object.assign({node,typeLink,setActive,draftType}, ...SECTION_REGISTRY.map(s => s.initDraft(node)))` |
| `js/ui/answer-type/sections.js` | Barrel — re-exports `SECTION_REGISTRY` from `base-section.js`; side-effect imports of all 8 section files trigger self-registration |
| `js/ui/answer-type/data.js` | Pure constants only (no helpers): `CHOICE_TYPES`, `ENTRY_FORMAT_TYPES`, `NUMERIC_TYPES`, `ITEM_TYPES`, `FHIR_R4_TYPES`, `BUILDER_UNITS`; `_optsWithOrdinals` and `_parseOptsWithOrdinals` are private to `sections/choice.js` |
| `js/ui/answer-type/sections/choice.js` | `ChoiceSection` — choice/radio/open-choice/checkbox: answer-source toggle (options list vs ValueSet), ordinals, prefixes, openLabel; `commit()` writes `_answerValueSet`, `options`, `_optionOrdinals`, `_optionPrefixes`, `_openLabel` |
| `js/ui/answer-type/sections/reference.js` | `ReferenceSection` — resource type dropdown; `commit()` writes `referenceResource` |
| `js/ui/answer-type/sections/unit.js` | `UnitSection` — UCUM unit dropdown; `commit()` writes `quantityUnit` |
| `js/ui/answer-type/sections/numeric.js` | `NumericSection` — min/max inputs + slider toggle+step; `commit()` writes `_minValue`, `_maxValue`, `_sliderStep` |
| `js/ui/answer-type/sections/placeholder.js` | `PlaceholderSection` — entryFormat input; `commit()` writes `_entryFormat` |
| `js/ui/answer-type/sections/orientation.js` | `OrientationSection` — choiceOrientation dropdown (radio only); `commit()` writes `_choiceOrientation` |
| `js/ui/answer-type/sections/display-cat.js` | `DisplayCatSection` — display category dropdown (display items only); `commit()` writes `_displayCategory` |
| `js/ui/answer-type/sections/attach.js` | `AttachSection` — max file size + MIME types inputs (attachment only); `commit()` writes `_maxFileSizeMB`, `_mimeTypes` |
| `js/ui/repeatable-modal.js` | Repeatable edit modal — `init(elements)`, `open(node, repeatLink, setActive)`; draft pattern; toggle for `node.repeats` + cardinality card (`_minOccurs` / `_maxOccurs` integer inputs); Apply trims excess rows when maxOccurs reduced; calls `triggerCalcRecalc()` |
| `js/ui/patient-ctx.js` | Patient presets dropdown + `PatientModal extends Modal` — 5 built-in profiles + Custom…; `configure({tree, effect, questVariables})`; `PatientModal.open()` builds input rows, `_apply()` commits values + fires `reinit-form` + `patient-ctx-applied`; auto-applies on preset selection |
| `js/ui/progress.js` | Global progress bar — `init(elements)`, `show/update/hide` |
| `js/ui/search.js` | Preview search — `init(elements)`, `refresh()`; highlight + up/down/Enter navigation |
| `js/ui/tooltip.js` | Rich tooltip system — delegated `mouseover` on `[data-tip-title]`/`[data-tip-body]`; positions card below/above target; supports `data-tip-fhir` + `data-tip-spec` footer; enabled-state persisted via `StorageAdapter` (read in `init()`, written on toggle) |
| `js/ui/toast.js` | Toast notification system — `showToast(msg, type, duration)`, `showError(msg)`, `showWarn(msg)`, `showInfo(msg)`; self-contained; appends `.toast-container` to `document.body` on first call; `error`/`warn`/`info` variants; CSS transition fade-in/fade-out; styled by `css/toast.css` |
| `js/fhir/explain.js` | FHIRPath boolean expression tree parser — `parseExprTree(expr)` + `evaluateExprTree(node, fp, resource, env)` with AND/OR/NOT/LEAF nodes |
| `js/ui/explain-modal.js` | Expression Explain modal — `show(expr, fp, resource, env)`; renders AND/OR/NOT/LEAF tree with ✓/✗ icons; FHIRPath strip at bottom |
| `js/storage/storage.js` | **StorageAdapter API layer** — thin abstraction over persistence; `register(adapter)` called once at startup in `app.js`; exports `getItem/setItem/removeItem/keys`; throws if adapter not registered; all modules use this instead of `localStorage` directly, enabling backend swap (Supabase etc.) with zero caller changes |
| `js/storage/local-storage.js` | `LocalStorageAdapter` — wraps `window.localStorage`; implements `getItem/setItem/removeItem/keys`; registered at startup in `app.js` |
| `js/ui/autosave.js` | Background autosave — 15 s interval; per-questionnaire slot keyed by `Questionnaire.url` or auto-generated `identifier[fhir-qb.app/editor].value`; public API: `init({buildFn,questMeta,onSaved})`, `isEnabled`, `setEnabled`, `getMostRecentDraft()→{meta,key}\|null`, `getDraftData(key)`, `clearDraft`; reads/writes through `StorageAdapter` (no direct `localStorage` calls) |
| `js/ui/history.js` | Undo/redo — debounced 400 ms + `requestIdleCallback`; watches `_formTick` via `effect()`; max 50 snapshots (JSON strings); `init({buildFn,importFn,renderFn,formTick,effect,onChange})`, `undo()`, `redo()`, `canUndo()`, `canRedo()`; stack resets on `questionnaire-loaded` / `questionnaire-cleared`; initial snapshot taken in `init()` so first change is undoable |
| `js/ui/library-modal.js` | **Load from Library** modal — `init(elements)`, `open(focusGroupId, onSelect, typeFilter)`; fetches and caches `sampledata/library.json`; renders collapsible group tree filtered by `typeFilter` (`'questionnaire'` \| `'qr'` \| undefined for all); clicking an item calls `onSelect(item)` and closes the modal; opened from the `Questionnaires ▾` dropdown (filter: questionnaire) and `Answers ▾` dropdown (filter: qr) |
| `js/ui/status-badge.js` | PASS/FAIL pill badge in preview header — `update({anyVisible, hasCriteria, finalOk, failingItems})`; dark dropdown with numbered issues + ↗ navigate links |
| `js/fhir/validate.js` | `validateTree(tree)` → `{severity,nodeId,message}[]`; linkId uniqueness, FHIRPath syntax check for `_calculatedExpr`, `_answerExpression`, `enableWhenExpression`, constraint expressions; empty titles, missing options; suppresses "no answer options" warning when `_answerValueSet` or `_answerExpression` is set |
| `js/ui/validate-modal.js` | Validation modal UI — `init(elements)` + `show(title, issues, mode, onExport?)`; no hardcoded DOM IDs |
| `sampledata/library.json` | Library index — flat JSON array of group objects `{id, label, items[]}` where each item is `{label, file, type, note?}`; `type` is `'questionnaire'` or `'qr'`; consumed by `library-modal.js` to populate the Load from Library modal |
| `sampledata/example-bariatric.fhir.json` | FHIR R4 example (bariatric pre-authorization). Contains `contained[]` with 2 ValueSets (`vs-comorbidities`, `vs-vitamin-deficiencies`); two items use `answerValueSet`. Constraints: `diet-min-months` (error, integer ≥ 3), `phq9-severity` (warning, score < 15), `bmi-eligibility` (error, readOnly calc ≥ 35) |
| `sampledata/annual-health-check.fhir.json` | **Annual Health Check** — covers all FHIR features: `version`/`publisher`, `prefix`, `item.code[]` (LOINC), `minValue`/`maxValue`, `rendering-style` (bold section headers + blue italic label), `sliderStepValue`, `repeats`+`minOccurs`/`maxOccurs`, `ordinalValue` (PHQ-9 mood), `enableWhen`, `initial[]`, `maxLength`, `calculatedExpression` (BMI), `questionnaire-constraint` (warning when referral set but no notes) |
| `sampledata/valueset-demo.fhir.json` | **Lifestyle & Social History Assessment** — 3 contained ValueSets (SNOMED, LOINC, example.org); 4 items with `code[]` and prefix: 3 using local `#vs-id` refs, 1 using external URL; `rendering-style` on group header |
| `sampledata/sdc-variables-demo.fhir.json` | **BMI & Body Composition Assessment** — SDC questionnaire-level variables (`%weightKg`, `%heightM`, `%bmiCalc`) + `calculatedExpression`; LOINC `code[]` + `minValue`/`maxValue` on height/weight |
| `sampledata/slider-disabled-demo.fhir.json` | **Pain & Symptom Assessment** — numeric sliders, `disabledDisplay` (hidden/protected), `ordinalValue` on radio options, `rendering-style` on section headers, LOINC `code[]`, conditional sections via `enableWhen` |
| `sampledata/reference-example.fhir.json` | **Care Referral Request** — `reference` item type (Patient, Practitioner, Encounter) with `questionnaire-referenceResource`; urgency choice with SNOMED code; reason/history text items; `rendering-style` on group headers; `version`/`publisher` |
| `sampledata/1776102565767-...json` | Real-world questionnaire for testing |
| `sampledata/patient-scenario-eligibility.fhir.json` | Scenario: Bariatric Surgery Eligibility — `initialExpression` + `enableWhenExpression` pathways |
| `sampledata/patient-scenario-risk.fhir.json` | Scenario: Pre-op Risk Assessment — readOnly `initialExpression` fields |
| `sampledata/patient-scenario-calc-chain.fhir.json` | Scenario: Risk Score Calc Chain — `initialExpression` → `calculatedExpression` → `enableWhenExpression` pipeline; LOW/MODERATE/HIGH per preset |
| `sampledata/bariatric-extended.fhir.json` | Synthetic bariatric pre-auth — 87 items, 32 enableWhen, all types |
| `sampledata/ussg-fht.fhir.json` | US Surgeon General Family Health History (49 items, depth 5) |
| `sampledata/prowl-ss.fhir.json` | PROWL-SS post-op pain assessment (44 items) |
| `sampledata/phq-9.fhir.json` | PHQ-9 depression screening (11 items) |
| `sampledata/phq-9.stu3.fhir.json` | PHQ-9 in **FHIR STU3** format (`meta.fhirVersion: "3.0.2"`); uses `item.option[]`, `enableWhen.hasAnswer`, `initialInteger`; normalised to R4 automatically on import via `stu3-shim.js`; frozen copy also in `tests/fixtures/` |
| `sampledata/phq-9-response.qr.json` | Sample QuestionnaireResponse for PHQ-9 (mild depression, score 7) — 10 answered items with `valueCoding` (LOINC codes) |
| `sampledata/example-bariatric-response.qr.json` | Sample QuestionnaireResponse for example-bariatric (eligible male patient, BMI 41.5) — groups + nested items |
| `sampledata/1776102565767-…json` | Real-world questionnaire snapshot for regression testing |
| `docs/ROADMAP.md` | Prioritized feature backlog |
| `docs/FHIR-MAPPING.md` | Full FHIR ↔ internal model mapping + not-supported list |
| `package.json` | Node dev tooling — Vitest (`npm test`) + Playwright (`npm run test:e2e`); `serve` devDep used by Playwright webServer |
| `vitest.config.js` | Vitest config — node environment, `tests/**/*.test.js` |
| `playwright.config.js` | Playwright config — Chromium only, `testDir: tests/e2e`, auto-starts local `serve` (via `node node_modules/.bin/serve`); reporters: `html` (open:never) + `list` |
| `tests/e2e/builder.spec.js` | E2E tests (24) — load/clear form, collapse/expand group, FHIR export, group title edit, delete item/group (cascade), type changes (checkbox/display), bidirectional navigation flash (builder↔preview), node count match on import, answer state persistence, enableWhen (Show When modal), patient preset section visibility, Re-init / initialExpression population; all selectors via `data-testid`; fixtures from `tests/fixtures/` |
| `tests/e2e/contained-panel.spec.js` | E2E tests (17) — Contained Resources card + Answer ValueSet card; chip rendering, JSON viewer modal (open/close via ×/footer/Esc/backdrop), toggle collapse/expand, cards hidden on clear; fixture `tests/fixtures/contained-valueset.fhir.json` |
| `tests/e2e/fhir-features.spec.js` | E2E tests (23) — readOnly enforcement, maxLength counter, minValue/maxValue error display and round-trip, ordinalValue badges in radio/select, ordinalValue round-trip export, minLength error enforcement and round-trip; fixture `tests/fixtures/fhir-features.fhir.json` |
| `tests/e2e/attachment-constraints.spec.js` | E2E tests (19) — `maxSize` and `mimeType` extensions for attachment items: Answer Type modal shows correct values on import, preview hints visible, `accept` attribute set from mimeTypes, file-too-large error tag, round-trip export round-trip for both extensions; fixture `tests/fixtures/attachment-constraints.fhir.json` |
| `tests/e2e/slider-disabled.spec.js` | E2E tests (15) — slider rendering (range input, min/max/step attrs, label update, round-trip), disabledDisplay (hidden absent from DOM, protected dimmed, toggle on condition change, round-trip), builder UI (Answer Type modal numeric section, Show When modal disabledDisplay select, applying changes); fixture `tests/fixtures/slider-disabled.fhir.json` |
| `tests/e2e/metadata-modal.spec.js` | E2E tests (84) — questMetaCard visibility, status badge, modal open/close, fields pre-populated, Advanced section, round-trip export, Apply/Cancel, reset on clear, effectivePeriod, Codes section (toggle + badge + add/remove/edit + round-trip), Resource Meta section (versionId/Generate, source, lastUpdated, profile[], tag[], security[], badge count), **Identifiers section** (toggle, auto-expand, badge count, imported row values, add/remove, system/value/use round-trip, Cancel discards); fixture `tests/fixtures/meta-test.fhir.json` |
| `tests/e2e/support-link.spec.js` | E2E tests — `questionnaire-supportLink` feature: 🔗 icons in builder preview (single / multiple), "More info ↗" buttons in patient view, Props modal editing (open via `action-codes`, expand Support Links section, add/remove URL inputs, Apply updates preview), active-state on Props button; fixture `tests/fixtures/support-link.fhir.json` |
| `tests/e2e/required-modal.spec.js` | E2E tests for Required flag within the States modal — updated from old required-modal; uses `action-states` + `#statesModal` + `states-required-sel` testids; covers open/close, 3-option select, draft pattern (Cancel/Apply), active state, re-open reflects saved value |  
| `tests/e2e/states-modal.spec.js` | E2E tests for the combined States modal — open/close (item + group), item layout (Required select + Read-only + Hidden checkboxes), group layout (no Read-only row), Read-only toggle draft pattern + setActive, Hidden toggle draft pattern + setActive + preview class, combined states active/inactive |  
| `tests/e2e/codes-ordinal.spec.js` | E2E tests (11) — Codes action button active state (with/without codes), modal open/close (Apply/Cancel/×), add/remove/edit code rows, Apply commits + deactivates when all removed, Cancel discards, export round-trip preserving `item.code[]`; fixture `tests/fixtures/codes-ordinal.fhir.json` |
| `tests/e2e/history.spec.js` | E2E tests (13) — undo/redo buttons disabled on fresh start; enabled after adding a group (debounce+ric); undo removes group; redo restores; Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z keyboard shortcuts; history reset after form clear |
| `tests/e2e/autosave.spec.js` | E2E tests (13) — autosave draft "Recent" hidden/visible/loads; autosave toggle persist across reload; tooltip toggle persist across reload; panel width restore from storage; load-confirm dialog: no dialog on empty tree, shown with items, Cancel/Escape keeps tree, proceed opens library |
| `tests/fixtures/` | Frozen FHIR samples for e2e tests — do not edit. `example-bariatric.fhir.json`, `patient-scenario-eligibility.fhir.json`, `all-types-repeatable.fhir.json`, `contained-valueset.fhir.json`, `fhir-features.fhir.json`, `slider-disabled.fhir.json`, `meta-test.fhir.json`, `codes-ordinal.fhir.json`, `attachment-constraints.fhir.json` |
| `tests/utils.test.js` | Unit tests for `js/utils.js` (38 tests) |
| `tests/eval.test.js` | Unit tests for `js/eval.js` — `evaluateNode`, `markAllDisabled`, `enableWhen` AND/OR logic, `_hidden`/`hiddenRoot` marking (32 tests) |
| `tests/calc.test.js` | Unit tests for `js/fhir/calc.js` — `buildVarEnv`, `evalCalcNodes` (23 tests) |
| `tests/validate.test.js` | Unit tests for `js/fhir/validate.js` — `validateTree`, linkId uniqueness, FHIRPath syntax (calculatedExpr + answerExpression), constraint key checks, fhirpath-unavailable path (33 tests) |
| `tests/explain.test.js` | Unit tests for `js/fhir/explain.js` — `parseExprTree`, `evaluateExprTree`, AND/OR/NOT/LEAF nodes, nested expressions, unmatched parens (40 tests) |
| `tests/export.test.js` | Unit tests for `js/fhir/export.js` — enableWhen, constraints, SDC variables, `integer`/`decimal`/`number` type mapping, `answerValueSet`, `contained[]`, `questMeta` round-trip (incl. name, date, subjectType, purpose, copyright, approvalDate, lastReviewDate, pass-through contact/useContext/jurisdiction), `_codes` round-trip, `effectivePeriod` export, `_rawCode` pass-through, `answerOption.initialSelected`, multi-initial for repeating items, `_supportLinks`, `_hidden`, `_maxFileSizeMB`, `_mimeTypes`, `_optionPrefixes` (176 tests) |
| `tests/import.test.js` | Unit tests for `js/fhir/import.js` — `fhirTypeToItemType`, `fhirOptsToStr`, `humanEnableWhen`, `applyVisibility`, `contained[]`, `answerValueSet`, `questMeta` population (incl. name, date, subjectType, purpose, copyright, approvalDate, lastReviewDate, pass-through contact/useContext/jurisdiction), `_codes` import, `effectivePeriod` import, `_rawCode` pass-through, `answerOption.initialSelected`, multi-initial for repeating items, `_supportLinks`, `_hidden`, `_maxFileSizeMB`, `_mimeTypes`, `_optionPrefixes` (171 tests) |
| `tests/qr-builder.test.js` | Unit tests for `js/fhir/qr-builder.js` — `buildQR`, `buildQRItem`, all answer types incl. `quantity`→`valueQuantity`, `url`→`valueUri`, `reference`→`valueReference`, ordinalValue extension, fallback branches (integer/decimal/quantity/reference 0-defaults, non-group with children, questionnaire empty-string fallback) (47 tests) |
| `tests/qr-import.test.js` | Unit tests for `js/fhir/qr-import.js` — input validation, all value types incl. `valueTime`/`valueReference`/`valueQuantity`/`valueUri`, unrecognised answer type, unmatched linkIds, nested groups, repeat rows, empty/missing answers, values mutation (48 tests) |
| `tests/qr-export.test.js` | Unit tests for `js/fhir/qr-export.js` — `exportQR` download trigger, filename prompt, QR structure; `document`/`Blob`/`URL` globals mocked via `vi.stubGlobal` (17 tests) |
| `tests/stu3-shim.test.js` | Unit tests for `js/fhir/stu3-shim.js` — `isSTU3`, `normaliseSTU3`, `option[]`→`answerOption[]`, `hasAnswer`→`operator:exists`, all `initial<Type>`→`initial[]` conversions (incl. Attachment/Reference), STU3 detection heuristics, immutability (35 tests) |
| `tests/state.test.js` | Unit tests for `evalConstraints` in `js/state.js` — severity filtering, empty/false/throw results, varEnv passing (21 tests) |
| `tests/integration.test.js` | Integration tests for `buildQR` + `evalConstraints` pipeline — decimal/integer pass/fail, wrong key regression, warning-only, nested groups (7 tests) |
| `.github/workflows/test.yml` | GitHub Actions CI — `test` job: Vitest; `e2e` job: Playwright (uploads `playwright-report/` artifact); `deploy` job: bundles app + report into `_site/`, deploys to GitHub Pages (`/playwright-report/` = latest test report); both `test`/`e2e` triggered on every push/PR to main |

---

## Tech Stack

- **`@vue/reactivity`** (ESM CDN) — only `ref`, `reactive`, `effect`. No Vue components.
- **ES Modules** — `import/export` between files; requires HTTP server (`npx serve .` or GitHub Pages)
- **Vanilla JS DOM** — left panel (builder) constructed imperatively
- **`effect()`** — rebuilds the right panel (preview) on reactive state changes
- **FHIRPath** — `window.fhirpath` (global, `lib/fhirpath.min.js`); used in `enableWhenExpression`, `calculatedExpression`, `evalConstraints`, and `buildVarEnv`
- **Playwright** — E2E test suite; **309 tests** across 22 spec files (Chromium); CI via GitHub Actions (`npx playwright test`)
- **Dependency injection** — `dnd.js` and `_shared.js` receive all state via `init()`, no module-level singletons
- **`ctx` object** — `{ renderTree, renderNode, tree, formTick, collapsed }` passed down to renderers and panels
- **Vitest** — unit test suite for pure-function modules; **734 tests** across 14 files; CDN imports mocked via `vi.mock`; CI via GitHub Actions (`npm test`)
- **GitHub Pages** — https://sergeymosyakov.github.io/fhir-questionnaire-builder/

---

## Architecture

### Node Class Hierarchy (OOP Rendering)

Each node type owns its own DOM rendering via the `renderPreview(res, container, rc)` method:

```
BaseNode            — js/nodes/base-node.js       shared scaffold, dimmed/disabled rows
  ├─ GroupNode      — js/nodes/group-node.js       group rows, AND/OR logic, collapse, refreshIcon()
  └─ ItemNode       — js/nodes/item-node.js        all item types, badges, controls
       └─ DisplayNode — js/nodes/display-node.js   display items, category icons, help toggle
```

- **`NODE_REGISTRY`** (`js/nodes/index.js`) — `Map<itemType → class>`; dispatch: `NODE_REGISTRY.get(node.itemType)?.prototype.renderPreview.call(node, …)`
- **`_rc`** (`js/preview/render-ctx.js`) — dependency injection hub; node classes read stable refs (`buildControl`, `formTick`, `isMandatory`, etc.) from `_rc` instead of importing `state.js` or `render-bus.js` directly (avoids circular deps)
- **Circular dep rule**: `state.js → nodes/index.js` — node class files **must not** import `state.js` or `render-bus.js`. Inject via `_rc` instead.
- **`js/controls/{type}.js`** — per-type interactive control factories (date picker, select, checkbox, etc.); called via `rc.buildControl(node, ctx)`. Control files do **not** own row rendering.

### Reactive State

```js
// Patient context — stored as FHIRPath literal expressions in questVariables (js/ui/patient-ctx.js)
// Seeded as: { name:'age', expression:'30' }, { name:'gender', expression:"'male'" }, etc.
// Accessible in FHIRPath as %age, %gender, %bmi, %pregnant, %smoker, %proc, %comorb

tree              // reactive([]) — questionnaire node tree
values            // plain object — form answers (not reactive; avoids re-render on every keystroke)
_formTick         // ref(0) — incremented on checkbox/select change to re-trigger effect()
questVariables    // reactive([]) — SDC variable entries; patient ctx seeded here
questContained    // reactive([]) — Questionnaire.contained[] raw FHIR resources (round-trip)
questMeta         // reactive({}) — questionnaire-level metadata: id, url, version, title, status, publisher, description
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
_displayCategory   // 'instructions'|'security'|'help' — questionnaire-displayCategory ext; applies colored bg + left border + icon (instructions/security) or collapsible help toggle (help) to display items in preview; editable in Answer Type modal for display items
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
| `choice` | `select` / `radio` | ✅ | — | `questionnaire-itemControl: radio-button` → `radio` |
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
- `type:group` → group node; `type:boolean` → `itemType:'checkbox'`; `type:choice` → `itemType:'select'` or `'radio'` (if `questionnaire-itemControl: radio-button`)
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
- `node._minOccurs` → `questionnaire-minOccurs` extension (when `node.repeats`)
- `node._maxOccurs` → `questionnaire-maxOccurs` extension (when `node.repeats`)
- `node._minValue` → `questionnaire-minValue` extension (`valueInteger` when integer, `valueDecimal` otherwise)
- `node._maxValue` → `questionnaire-maxValue` extension (`valueInteger` when integer, `valueDecimal` otherwise)
- `node._optionOrdinals` → `ordinalValue` extension on each `answerOption[].extension` (at answerOption level, per FHIR R4 spec) that has an entry
- `node._sliderStep` → `questionnaire-sliderStepValue` extension (`valueInteger` when `Number.isInteger`, otherwise `valueDecimal`)
- `node._disabledDisplay` (when not `'protected'`) → `item.disabledDisplay` (omitted when `'protected'` as it is the default)
- `itemType:'radio'` → exports `type:'choice'` + standard `questionnaire-itemControl: radio-button` extension (round-trip safe)
- Downloads as `<name>.json` (user prompted for filename)

---

## Key UX Features

- **Bidirectional navigation** — `↗` icon on every active preview row (visible on hover; `data-testid="preview-nav-btn"`) → scroll+flash builder node (teal); click builder node header → scroll+flash preview row (blue); `↗` button on every builder node header provides explicit one-click navigation to the corresponding preview row; dimmed and disabled rows remain fully clickable (no interactive controls there)
- **Drag & drop reorder** — ⠿ handle on every node; drag to reorder, drop between nodes (blue line), drop into group (dashed zone), drop at root level; ancestor→descendant drop blocked
- **Collapse sections (preview)** — `▼/▶` toggle on each group row in the preview; SVG corner-arrow icon buttons in the preview toolbar collapse/expand all (appear when tree is non-empty, right-aligned via flex spacer)
- **Preview toolbar order** — `⬆ Load ▾` | `⬇ Export` | 🔍 Search | [flex spacer] | `id` toggle | `prefix` toggle | collapse | expand; search and collapse/expand shown only when tree has content
- **Boolean tristate** — all `boolean`/`checkbox` items render an indeterminate (gray-fill) checkbox when unanswered (`values[id] === undefined`); first click → `true`; subsequent clicks toggle `true ↔ false`; for `required` items `calcFormOk` passes only for `true`/`false` (not `undefined`) — FHIR: `required` means an answer must be given, not that the answer must be `true`
- **Editable linkId** — blue monospace input in the builder node header; directly edits `node.id`
- **item.prefix** — FHIR R4 `Questionnaire.item.prefix` imported into `node._prefix` and exported back (round-trip safe); amber pill badge in preview; editable in builder meta-row; **Renumber** assigns sequential prefixes (e.g. `1`, `1.1`) — writes `_prefix` only, never changes `node.id`
- **linkId / prefix toggles** — `id` (blue) and `prefix` (amber) buttons in preview toolbar toggle the corresponding pill badges; state stored in `showLinkId` / `showPrefix` refs; clicking a linkId badge copies the linkId to clipboard (✓ copied feedback); badge shows rich tooltip with visibility-rule usage, expected value type, item type
- **SDC Variables** — `sdc-questionnaire-variable` extensions on the root Questionnaire are imported into `questVariables[]`; a collapsible card above the tree shows `%name` chips (with rich tooltips showing expression + FHIR spec footer); Edit modal uses draft pattern — Apply commits, Cancel discards; variables passed as `%varName` env vars when evaluating `calculatedExpression`; round-trip safe on export
- **Default value (item.initial[])** — `item.initial[0]` imported → `node._initialValue`; pre-fills the preview on load (`applyInitialValues` runs inside the `_bulkUpdate` block so `effect()` sees filled values on first run); editable via **Default** action panel in builder; control adapts to itemType (select for checkbox/choice, date, number, text); `× clear` link updates preview instantly; exported back as `item.initial[]`
- **Constraint modal** — **Constraint** action button opens a centered modal (`js/ui/constraint-modal.js`) with draft pattern; editable cards per constraint (key, severity, human message, FHIRPath expression, remove) + **+ Add constraint**; Apply commits, Cancel discards; exported as `questionnaire-constraint` extensions
- **Constraint badge in preview** — per-node badge: amber ⚠️ `constraint` (warning or passing error), red ✘ `constraint` (failing error); tooltip; affects Final Result when `severity: 'error'` and expression fails or returns empty
- **Read-only enforcement** — `_readOnly: true` items show a styled `.preview-readonly-value` placeholder (value or `—`) instead of an input; input cannot be edited; 🔒 `read-only` badge shown; does not block PASS/FAIL
- **maxLength enforcement** — `node._maxLength` sets the `maxlength` HTML attribute on text/url inputs + renders a live character counter `(N/M)` below the input
- **minLength enforcement** — `node._minLength` (SDC extension) sets the `minlength` HTML attribute on text/url inputs; inline error `Min N chars` shown on blur when value is non-empty but shorter than the limit; clears when value reaches or exceeds the limit
- **minValue/maxValue enforcement** — `questionnaire-minValue` / `questionnaire-maxValue` extensions imported into `_minValue`/`_maxValue`; `min`/`max` HTML attributes set on number inputs; error badge shown inline when value is out of range; blocks PASS/FAIL
- **ordinalValue display** — `ordinalValue` extension on `answerOption.extension` (or `valueCoding.extension` fallback) imported into `_optionOrdinals`; shown as `(N)` badge on each radio option label and in the select trigger + dropdown items; exported back to `answerOption.extension` (FHIR R4 spec); editable in Answer Type modal — append `=score` to any option: `code=Label=0,code2=Label2=1`
- **Slider input** — `questionnaire-sliderStepValue` extension imported into `_sliderStep`; when set, integer/decimal item renders as `<input type="range">` with a live value label; `min`/`max` attrs from `_minValue`/`_maxValue` (default 0/100); step from `_sliderStep`; exported back as `questionnaire-sliderStepValue` (`valueInteger` or `valueDecimal`); editable in Answer Type modal — Min / Max / Slider step fields shown for integer/decimal types
- **disabledDisplay** — `item.disabledDisplay` (R4B native field, also R4 backport extension) imported into `_disabledDisplay`; `'hidden'` removes the item row entirely from the DOM when condition is not met (vs `'protected'` default which grays it out); exported back; editable in Show When modal — dropdown `When not visible: Show grayed (protected) / Remove from view (hidden)`
- **Read-only badge** — grey 🔒 `read-only` pill when `_readOnly === true` and no `_calculatedExpr`
- **Default badge** — purple ↺ `default` pill when `_initialValue` is defined
- **Real-time calc badge** — `refreshCalcBadges()` patches calc-badge in-place via `data-calc-id` — no DOM rebuild on answer change
- **Calc-badge tooltip** — shows FHIRPath expression + SDC spec footer
- **Show When modal** — "Show When" action button opens a centered modal (`js/ui/showwhen-modal.js`); draft pattern — `enableWhen[]`, `enableBehavior`, `enableWhenExpression` deep-cloned on open; Apply commits to node + calls `triggerCalcRecalc()`; Cancel discards; action button indicator only changes on Apply (no-op `setActive` passed during editing)
- **Searchable question picker** — enableWhen condition rows have a sticky search input filtering by `id` and title; dropdown rendered as a portal (`document.body`) with `position: fixed` + `getBoundingClientRect()` — escapes `overflow` clipping in any ancestor; auto-flips upward if needed; z-index 10200
- **QR Export** — **⬇ Response** button in toolbar; prompts for filename; downloads current answers as FHIR R4 `QuestionnaireResponse` JSON with `authored` timestamp; **QR Export modal** (#qrExportModal) now has consistent z-index (10000), fixed width (min(380px, 94vw)), and body uses flex-column layout directly via CSS — same pattern as Properties (metadataModal); qr-export-modal.js no longer wraps rows in a .meta-modal-form element
- **QR Import (Load Answers)** — **Load Answers…** at bottom of Load dropdown; reads a QR JSON file; loads matched answers into `values[]`; shows warning modal for URL mismatch or unknown linkIds
- **Repeatable items** — `Repeatable` action link opens `js/ui/repeatable-modal.js`; modal: toggle for `node.repeats` + optional **Min** / **Max** cardinality inputs (`questionnaire-minOccurs` / `questionnaire-maxOccurs`); preview renders `.repeat-wrap` with `×` remove + `+ Add another`; `_maxOccurs` enforced — add button disabled at limit; QR export collects all rows into `answer[]`; QR import restores rows; `item.maxLength` imported/exported as `node._maxLength`
- **Shared modal system** — all dialogs (Variables, Show When, Constraints, Patient Context, Validate, Expression Explain) use `.modal-backdrop / .modal-box / .modal-header / .modal-close / .modal-body / .modal-footer / .modal-btn` from `css/modals.css`; per-modal z-index and width via `#id` selectors; tokens `--c-hover` and `--c-text-1` added to `css/styles.css`; title pattern: `.modal-title-label` (bold) + `.modal-title-subject` (muted)
- **Rich tooltips on action buttons** — all builder action buttons (Answer Type, Required, Show When, Applicability, Expression, Default, Appearance), toolbar buttons (Load, Export, Add Root Group, Renumber, prefix format select, id/prefix/collapse/expand), and the Variables card title carry `data-tip-*` attributes with FHIR field path and spec reference (R4 / SDC) in the footer; implemented via delegated `mouseover` in `js/ui/tooltip.js`
- **Tooltip toggle** — `tips` button in the preview toolbar; green = enabled (default), orange = disabled; persisted in `localStorage` (`tooltips-enabled`); **tooltips off** label shown next to Logic Builder heading when disabled
- **Radio answer options in builder** — Answer Type panel shows the Options (comma-separated) editor for `radio` items (bug fix: was shown only for `select` and `open-choice`)
- **Validate button** — standalone **Validate** button in the Questionnaire Preview header; runs `validateTree()`; shows green ✅ "All good" when no issues; only visible when questionnaire is loaded
- **Esc closes modals** — Validate modal and Variables modal both close on Escape key
- **Ctrl+F** — intercepts browser find and focuses preview search input (when visible)
- **Auto calculatedExpression** — `_calculatedExpr`/`_readOnly` nodes evaluated via FHIRPath automatically on every `effect()` run (patient input, answer, or tree change); `buildVarEnv` resolves `questVariables` as `%varName`; no manual Test button
- **Expression Explain modal** — clicking a checkbox `calc-badge` or `👁️`/`🔒` condition-hint badge opens a shared modal; expression parsed into AND/OR/NOT/LEAF tree with ✓/✗ icons; FHIRPath strip at body bottom; single Close button; tooltip says "Click to explain."
- **Live eval icons in builder panels** — `✓`/`✗` icon (`.expr-live-icon`) right of label in `calculatedExpression`, `initialExpression`, `enableWhenExpression` panels; refreshed on panel open + after every recalc; typing lag eliminated: `oninput` → data + debounced icon (400ms); full recalc only on `onblur`
- **Empty-state placeholder** — right panel shows hint text when tree is empty; Validate, Export hidden until questionnaire is loaded
- **Variables card visibility** — controlled solely by `effect()` in `app.js` based on `tree.length`; `refresh()` only updates chips/count
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
- **Patient Context popup** — "Patient Context" button in toolbar opens modal; sets `%age`, `%gender`, `%bmi`, `%pregnant`, `%smoker`, `%proc`, `%comorb` as FHIRPath literal expressions in `questVariables`; button disabled when no questionnaire is loaded; Apply increments `_formTick` → immediate preview re-eval; fires `patient-ctx-applied` event → `variablesPanel.refresh()` updates chips
- **AND/OR badges** — on group headers: `ALL items ✓` / `ANY item ✓`
- **Logic separators** — `— AND —` / `— OR —` between sibling items inside a group
- **Dimmed rows** — conditional items shown grayed (🔒) when condition not met; groups also show their children as disabled (N/A) rows; animate to active when met
- **Informational rows** — `type:'group'` nodes with no children rendered as plain italic text; labeled `[Info]` in builder
- **required text/number** — `required:true` on text/number items means non-empty; shows ✔/✘ icon and affects PASS/FAIL
- **select / radio controls** — no longer auto-fill the first option on render; mandatory fields start empty (`— select —` placeholder for select, no pre-check for radio) so PASS/FAIL is accurate on initial load
- **text / number / date / url / attachment / quantity / reference controls** — `oninput` calls `_reCalc()` (calc badge updates live) without triggering a full preview rebuild; `onchange`/blur increments `_formTick.value++` (re-evaluates enableWhen + constraints on discrete commit)
- **Entry format hint (entryFormat)** — `sdc-questionnaire-entryFormat` SDC extension imported/exported via `js/fhir/import.js` / `js/fhir/export.js`; stored as `node._entryFormat`; applied as `placeholder` on text, url, number and quantity input controls; editable in **Answer Type** modal via "Placeholder hint" field (shown only for input-bearing types); label carries a rich tooltip with FHIR path + SDC spec footer; `z-index` of rich tooltip raised to `10500` to appear above all modals

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

