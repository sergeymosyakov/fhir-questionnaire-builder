# Widget Extraction Plan — Core module + Renderer widget

> **Goal:** Split the app into three layers **without duplication**, in-place (transform, not fork):
> - **Core** (`js/core/*`) — single pluggable module, no DOM, instantiable, no global singletons. Imported by BOTH the builder app AND the renderer widget.
> - **Renderer** (`js/renderer/*`) — the right side as `QuestionnaireRenderer(mountEl, {questionnaire, response, config})`; in-page, multi-instance, isolated, **no menus** (all behavior via config/API).
> - **Builder app** (`js/builder/*`, `js/app.js`, `index.html`) — left side + shell; consumes Core and dogfoods the Renderer for its right panel.
>
> Every phase keeps the app green: `npm run lint` (0 errors) + `npx vitest run` (1653+ pass) + relevant e2e.

## Locked decisions
- **In-page true widget**, multiple isolated instances per page.
- **Both interactive-fill and read-only** via `config.readOnly`.
- Widget covers validation/PASS-FAIL, calculations, language switch, view-options (linkId/prefix/hidden), preview-mode, search, Fill-from-server ($populate) — **but no dropdown menus**; only configurable options in `config`. Host builds its own UI.
- **Core is a shared module** — the widget must not duplicate core logic.
- **Bundler now** (esbuild, Phase 0).
- `uiStr`/`render-ctx` → Renderer by default; anything used outside preview/renderer → Core (decide per-symbol by actual usage).
- Names: `QuestionnaireRenderer`, `js/renderer/`, `js/core/`.
- Legacy `questDoc`/`answerStore` proxy shims allowed as a temporary migration bridge (removed by Phase E).

## Public contract (in-page)

```js
import { QuestionnaireRenderer } from './js/renderer/index.js';
const w = new QuestionnaireRenderer(mountEl, {
  questionnaire,                 // FHIR Questionnaire JSON (required)
  response,                      // optional QR JSON (initial answers)
  config: {
    readOnly, language, previewMode,
    viewPrefs: { showLinkId, showPrefix, showHidden },
    features: { validation, calculations, populate, search, languageSwitcher },
    terminology: { server, corsProxy }, fhirBaseUrl,
  },
});
w.on('ready' | 'response-changed' | 'validated' | 'language-changed', cb);
w.getResponse(); w.setResponse(qr); w.setLanguage(l);
w.setConfig(partial); w.validate(); w.destroy();
```

## Progress tracker

| Phase | Description | Status | Verified (lint/vitest/e2e) | Notes |
|-------|-------------|--------|----------------------------|-------|
| 0 | Bundler setup (esbuild): `build:widget` JS + `build:widget:css`; bundle vendored libs into the widget; app stays raw-ESM | ✅ Done | lint ✓ · vitest 1653 ✓ · bundle ✓ | esbuild 0.28.2; entry `js/renderer/index.js` (skeleton); `css/widget.css` manifest → dist 51.8kb; dist/ gitignored. Vendored-lib bundling deferred to Phase D (entry uses no libs yet). |
| A | Core skeleton + event-bus de-globalization (`js/core/events/bus.js`, per-bus `EventState`, `defaultBus` bridges document) | ✅ Done | lint ✓ · vitest 1653 ✓ · e2e translation 12/12 ✓ | `EventBus` wraps `document` (1:1 back-compat); `EventState` = `createEventState(defaultBus, …)`; call-site migration to session buses deferred to D/E |
| B | `QuestionnaireSession` container + factories; `eval.js` DI; legacy singleton proxy shims | ✅ Done | lint ✓ · vitest 1658 ✓ · e2e enable-when/variables/calc 22/22 ✓ | `js/core/session.js` (`createSession`/`defaultSession`); models bus-aware (constructor `bus=defaultBus`); `eval.js` prefers `ctx.answerStore`, falls back to singleton; vitest `setup.js` lifts node listener cap |
| C | Node layer split: preview-only core nodes + builder extension (buildBuilder/dnd out of `js/nodes/*`); per family base→group→item→choice→leaf | ✅ Done | lint ✓ · vitest 1658 ✓ · e2e builder 33/33 + preview 8/8 ✓ | `js/builder/node-builder-ext.js` augments BaseNode/GroupNode/ItemNode prototypes (buildBuilder + inline-type-row + bh delegators); nodes no longer import builder/dnd/gear/modals. Follow-up: move `builder-helpers.js` js/nodes→js/builder (only ext imports it now) |
| D | `PreviewForm` → parameterized renderer + public `QuestionnaireRenderer`; config-driven chrome, no menus | ✅ Done | lint ✓ · vitest 1658 ✓ · widget e2e 4/4 · broad e2e 61/61 | `PreviewForm(opts)` fully parameterized (session/rc/chrome/progress/mountEl/jsonEl). `QuestionnaireRenderer(mountEl,{questionnaire,response,config})` composes an isolated session + widget-mode PreviewForm. Shell-import blocker resolved: `search`/`statusBadge`/`progress` decoupled — app supplies them via `chrome`/opts, widget builds its own opt-in chrome (`config.search`/`config.validation`). `importFHIR`/`buildFHIRObject` session-aware. Follow-up (housekeeping): move `builder-helpers.js` js/nodes→js/builder. |
| E | Multi-instance isolation: per-session bus everywhere, drop `document` from render path; session config provider; two-widgets-on-one-page e2e | 🟨 In progress | lint ✓ · vitest 1658 ✓ · widget e2e 5/5 · app nav e2e 38/38 | **Render path off `document`:** `rc.bus` added (set by PreviewForm); nodes wire preview listeners (`PREVIEW_NAVIGATE_TO`, `REFRESH_CALC_BADGES`, `COLLAPSE/EXPAND_ALL_PREVIEW`, `BUILDER_NAVIGATE`) on `rc.bus` via `_ensureBusListeners`; **`notifyChanged(bus)`** + all ~25 `buildControl` handlers dispatch `RESPONSE_CHANGED` on `ctx.bus` (fixes live-input recompute in widget); preview→builder nav (nav arrow, dimmed/disabled rows) dispatches `BUILDER_NAVIGATE_TO` on `rc.bus`, gated by `rc.showNavBtn`. `COPY_TO_NODES`/`CLIPBOARD_CHANGED`/builder events + raw outside-click `mousedown`/`keydown` stay on `document` (builder-only / not app events). Config flags `showNavBtn`/`showExplain` (default off; app on; widget `config.navButton`/`config.explain`). **Session config (`fhirBase`/`corsProxy`):** widget `config.fhirBaseUrl`/`config.corsProxy` flow via `session.config`; PreviewForm resolves them (session override → global `serverConfig` fallback) and exposes on the buildControl `ctx`; `reference-node` + `searchFhir`/`proxiedUrl` + `_populate` use them (app unchanged). **Isolation e2e:** live-input in one widget recomputes only itself, sibling untouched. **Explain in widget:** works via `config.explain` — `Modal` self-mounts to `document.body` (no app-shell needed); plain numeric calc values (`.preview-calc-value`, e.g. BMI) are now Explain-clickable too, not just checkbox badges/condition hints. NEXT: per-widget terminology server (deferred — `terminologyService` cache is keyed by `(vsUrl, serverUrl)` so sharing is safe; only the default-server selection is global, and valueset `$expand` isn't in the widget import path yet). |
| F | Packaging: `js/renderer/index.js` entry, `widget-demo.html`, docs (CONTEXT / docs-site "Embed the renderer" / ROADMAP) | ⬜ Not started | — | — |

_Status legend: ⬜ Not started · 🟨 In progress · ✅ Done_

## Key files to touch

- `js/preview-form.js` — render engine → extract to `js/renderer/preview-renderer.js`; drop shell-mount + global-bus deps.
- `js/nodes/base-node.js`, `js/nodes/group-node.js`, `js/nodes/item-node.js` — split preview/builder; remove builder imports.
- `js/preview/render-ctx.js` — `_rc` DI surface (move to renderer).
- `js/fhir/quest-document.js`, `js/answer-store.js` — singletons → session members.
- `js/events.js` — global bus / `EventState` → per-bus.
- `js/eval.js` — remove direct `answerStore` singleton import.
- `js/app.js` — create one session; mount `QuestionnaireRenderer` on the right panel.

## Scope

- **Included:** Core module, Renderer widget, in-page multi-instance, config-driven chrome, dogfood in app, esbuild bundle.
- **Excluded (unchanged, stay in shell):** builder authoring UX, export/REDCap, translate modal, auth/cloud, settings page.

## Findings that shaped the plan

- Right side = `PreviewForm` + `js/nodes/*` over singletons `questDoc`/`answerStore`, DI via `_rc`, on the **global `document` event bus** + `EventState` cache + window globals (`fhirpath`, `fhirpath_r4_model`, `DOMPurify`, `marked`).
- Core compute mostly pure (`calc`, `dep-graph`, `form-checks`, `qr-builder`, `qr-import`); impure spots: `eval.js` imports the `answerStore` singleton; `fhirModel` = `window.fhirpath_r4_model` accessor (stateless).
- Hardest seam = `js/nodes/*`: same classes do `renderPreview` (right) AND `buildBuilder` (left) + import `builder/dnd.js`.
- Isolation blockers: global bus, global `EventState`, singletons, `eval.js` direct singleton import.
- No bundler today; raw ESM + global `<script>` libs + scattered CSS; embedding precedent = `#embedded` iframe.

## Phase detail

### Phase 0 — Bundler setup (esbuild)
- Add esbuild devDep + npm scripts: `build:widget` (bundle future `js/renderer/index.js` → `dist/questionnaire-widget.js`), `build:widget:css` (concat/minify the preview CSS manifest → `dist/questionnaire-widget.css`), plus a watch script for dev.
- Vendored libs (`fhirpath`, `fhirpath.r4` model, `DOMPurify`, `marked`): bundle **into** the widget for self-containment (removes window-global coupling on the widget path; aligns with Phase E isolation). App `index.html` keeps global `<script>` tags until the app is migrated.
- Right-side CSS manifest: `preview-structure`, `preview-ui`, `preview-controls`, `status-badge`, `explain-modal` + `controls`, `date-picker`, `tooltip`, `toast`, `layout` (subset), `custom-select`.
- Verify: `build:widget` produces dist artifacts (stub entry OK until Phase D); lint/vitest unaffected.

### Phase A — Core skeleton + event-bus de-globalization
- `js/core/events/bus.js`: `EventBus` wraps an `EventTarget` (`dispatch`/`on`/`off`). `defaultBus` bridges to `document` for back-compat during migration. `EventState` becomes per-bus (default seeded on `defaultBus`).
- Migrate core + render `document.dispatchEvent`/`addEventListener` to an injected bus (default = `defaultBus`). Keep `AppEvents` names.
- Verify: green; behavior identical (single default bus).

### Phase B — Session container + de-singleton state
- `js/core/session.js`: `QuestionnaireSession { questDoc, answerStore, bus, config }`; `createSession(config?)`. App makes `defaultSession`; legacy `questDoc`/`answerStore` exports become proxies to `defaultSession`, migrate imports gradually.
- `eval.js`: store via ctx/param (drop singleton import). `import.js` / `qr-answers-manager` point at the session.

### Phase C — Node layer split (biggest; per family)
- Move `buildBuilder()` + `builder/dnd` + `builder-helpers` OUT of `js/nodes/*` into a builder-side extension (`js/builder/node-builder-ext.js` augmenting node prototypes, or subclasses). Core nodes = `renderPreview` / `_buildControl` only.
- Move `uiStr` / `render-ctx` so nodes don't import a preview-coupled path (`uiStr` → renderer; shared live-ctx + `eval-fhirpath` → core).
- Order: base → group → item → choice → leaf types. Green after each family.

### Phase D — Renderer extraction
- `js/renderer/preview-renderer.js`: engine takes `{ mountEl, session, config }`; owns `_rc` + async render pipeline + `_reCalc` + `_buildControl` + node dispatch. No shell-mount queries.
- Chrome (validation/status, calc badges, language, search, view-options, preview-mode, populate) = config-driven internal optional pieces; NO menus. App menus stay in the shell and call `renderer.setConfig()`/API.
- `QuestionnaireRenderer` public class = session + renderer + API; imports questionnaire + response via Core.
- `PreviewForm` becomes a thin app adapter: mounts a `QuestionnaireRenderer` on the right panel + bridges existing app menus to its config/API. App visually identical.

### Phase E — Multi-instance isolation hardening
- Audit: no module-global STATE reads in the core + render path (window libs are stateless = OK). Drop the default-bus→document bridge for the widget path (own bus only). Session-scoped config provider (terminology/cors/fhirBase/language) instead of global `serverConfig` for the widget path; app feeds its `serverConfig` into its session.
- e2e: TWO `QuestionnaireRenderer` instances on one page, independent answers, zero cross-talk.

### Phase F — Packaging + dogfood + docs
- `js/renderer/index.js` ESM entry exporting `QuestionnaireRenderer`. CSS manifest. Finalize esbuild `build:widget` → `dist/questionnaire-widget.{js,css}` (+ vendored libs).
- `widget-demo.html` host page (sample Questionnaire + QR) — dogfood + manual check.
- Docs: CONTEXT (core/renderer manifest), docs-site "Embed the renderer", ROADMAP.
