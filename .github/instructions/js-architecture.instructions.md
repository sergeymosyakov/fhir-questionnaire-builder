---
applyTo: "js/**"
description: "Vanilla-JS event-driven + OOP architecture rules for the FHIR Questionnaire Builder (DI via configure(), AppEvents/EventState, app.js composition root, no inline styles, custom-select, tooltips, innerHTML/URL security, toasts). Use when editing any file under js/."
---

# JS architecture — event-driven + OOP

Rules for all code under `js/`. Tech stack: Vanilla JS ES Modules, event-driven
reactivity (`AppEvents` custom events), OOP node/modal rendering with dependency
injection.

## Modularity & file size

- **Modularity** — new UI widget → `js/ui/<name>.js`; new control → `js/controls/<name>.js`; new CSS concern → `css/<name>.css` + `<link>` in index.html. Do not add logically separate code into existing modules.
- **500-line rule** — a file exceeding 500 lines is a signal that it needs logical splitting. Before adding more code to an oversized file, identify natural seams (independent concerns, repeated patterns, composable units) and extract them. Applies to JS modules, test specs, and CSS files alike.
- **UI behavior rule** — any self-contained UI behavior (resize, toggle, autosave, undo/redo, drag-and-drop, scroll restoration, etc.) that manages its own DOM elements and internal state must be extracted into a dedicated class in `js/ui/<name>.js`. No inline `{ ... }` blocks or imperative top-level code in `app.js` for behaviors that have a clear class boundary. The class: creates or receives its mount/elements in the constructor; wires all its own event handlers; communicates cross-module via `AppEvents` or injected callbacks only.

## OOP / DRY / DI

- **OOP / DRY** — when 2+ modules share the same behavioral pattern, extract a shared base/factory instead of copy-pasting. Example: every modal is `class XyzModal extends Modal` from `js/ui/modals/modal-base.js` — override `open()`, `_apply()`, `_cancel()` only; never monkey-patch `_modal._apply = fn` or inline lifecycle boilerplate.
- **DI** — services injected at startup via `BaseNode.configure(services)` and `Modal.configure(services)` (called in `js/builder/index.js`). Modules read services as `BaseNode._svc.*` / `Modal._svc.*`. No direct state/service imports in node or modal classes.
- **`app.js` is a pure composition root** — allowed: creating singletons with data-DI (`questDoc`, `answerStore`), dispatching `APP_CONTEXT_READY`, `storage.register()`. Forbidden: DOM queries (`getElementById`/`querySelector`), callbacks in constructors (`onEdit`, `getFhirTarget`, `shouldValidate`), passing DOM elements to constructors, two-step init (`new Foo().init()`). Classes self-find their mount points via `document.querySelector('[data-mount="name"]')` in their own constructor.
- **Ownership exception** — a class that *owns* sub-components may instantiate them directly (e.g. `BuilderPanel` creates `RenumberControl`; `QuestionnaireLoader` uses `loadConfirmModal`). Only `app.js` must not know about sub-component internals.

## Event-driven communication

- Cross-module communication uses `document.dispatchEvent(new CustomEvent(...))` / `document.addEventListener(...)`. All event names are defined as constants in `js/events.js` (`AppEvents` object) — **never use raw string literals**. Never pass module function references as callbacks when an event would decouple better.
- **No tick/counter signals** — never use a reactive counter (`ref(0)`, `tick++`, `_formTick.value++`) as a side-channel to trigger re-renders from inside implementation code. Instead, dispatch a named `AppEvents.*` event that describes what happened (`RESPONSE_CHANGED`, `QR_LOADED`, etc.). The render subscriber listens and decides whether to re-render — that is its responsibility, not the node's.
- **EventState cache** — `js/events.js` exports `EventState` which stores the last `detail` for stateful events (`APP_CONTEXT_READY`, `QUESTIONNAIRE_LOADED`, `QUESTIONNAIRE_CLEARED`, `QUESTIONNAIRE_NEW`, `FHIR_VERSION_CHANGED`, `PREVIEW_MODE_CHANGE`, `BUILDER_VIEW_MODE_CHANGE`). Any class that initialises after an event was dispatched reads current state immediately: `EventState.get(AppEvents.APP_CONTEXT_READY)?.questDoc`. This removes ordering constraints in `app.js` — never use `Modal._svc` or direct singleton imports as a substitute.
- **Detail-less dispatch guard** — the same named event may be dispatched with **no `detail`** by different callers (e.g. `undo()`/`redo()` in `js/ui/history.js` re-dispatch `QUESTIONNAIRE_LOADED` with no detail after `importFHIR` has mutated the singleton in place). A listener must **never** dereference `e.detail.x` directly — always optional-chain `e.detail` AND fall back to the cache: `const qd = e.detail?.questDoc ?? EventState.get(AppEvents.APP_CONTEXT_READY)?.questDoc;`. A bare `e.detail.questDoc?.tree` throws `Cannot read properties of null` on the detail-less path. Never mix the raw string form (`'questionnaire-loaded'`) with the constant — always `AppEvents.*`.

## UI conventions

- **No inline styles** — `style="..."` in HTML and `el.style.foo =` in JS are forbidden for static values. Allowed only for **runtime-dynamic** values: show/hide (`display`), computed dimensions, user-driven colors. All static appearance → CSS classes.
- **`<textarea>` rows** — `rows=1` for single-line values (url, text, short extension values); `rows=3` for multi-line content (XHTML, FHIRPath expressions, JSON objects). Never use `rows=2`.
- **Tooltips** — **never use the native `title="..."` attribute for hover tooltips**. Always use the custom rich tooltip system via `data-tip-title` / `data-tip-body` (and optionally `data-tip-fhir` / `data-tip-spec`), triggered by `js/ui/tooltip.js` on mouseover. **Exception:** elements where `title` is an accessibility requirement (`<iframe title>`, `<svg><title>`, `<area title>`) are exempt — that `title` is read by screen readers (WCAG). The ban applies only to `title` used as a visual hover hint.
- **Dropdowns / custom select** — **never use native `<select>`** for user-facing dropdowns in UI modules or modals. Always use `createCustomSelect` from `js/ui/custom-select.js`. API: `createCustomSelect({items, value, onChange, className, testid, searchable})` → `{el, getValue(), setValue(v), setOptions(items), setOnChange(fn)}`. Append `.el` to the DOM. Use class `sc-trigger--sm` for compact size. E2E: click trigger by `data-testid`, then `[data-testid="csel-drop"] [data-val="<value>"]`; verify via `data-value` on the trigger. Exception: native `<select>` is acceptable in the preview panel for rendered questionnaire controls (not builder UI).
- **Error notifications** — use `showError(msg)` / `showWarn(msg)` / `showInfo(msg)` from `js/ui/toast.js`. Never use `window.alert()` or inline error text. The dialog must match the shared modal style (reuses `.modal-backdrop`, `.modal-box`, `.modal-header`, `.modal-body`, `.modal-footer`, `.modal-btn`, `.modal-btn--apply`); `css/toast.css` only adds a z-index override, width, colored top-border accent, and a small `notif-title-icon` circle in the header. No big emoji, no custom colors outside the accent strip, no custom button styles.

## Security

- **`innerHTML`** — never assign unsanitized external or user-supplied content to `innerHTML`. Any HTML string from outside the codebase (FHIR `_renderXhtml`, imported JSON, etc.) must be wrapped in `DOMPurify.sanitize(...)` (`window.DOMPurify` from `lib/dompurify.min.js`). Clearing a container with `el.innerHTML = ''` is always safe.
- **URL matching** — never decide trust/routing by substring-matching a full URL string (`url.includes('host')`, `url.toString().includes(...)`). A substring check matches attacker-controlled URLs like `https://host.evil.com` and is flagged by CodeQL ("Incomplete URL substring sanitization"). Always parse the URL and compare the exact `hostname` (`new URL(u).hostname === 'tx.fhir.org'`). Applies to app code, the CORS worker allow-list, and Playwright `page.route` predicates alike.
