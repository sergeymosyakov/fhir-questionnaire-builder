# GitHub Copilot Instructions for FHIR Questionnaire Builder

> **Critical workflow rules for AI agents working on this codebase.**  
> Full architecture docs: `docs/CONTEXT.md`, `docs/FHIR-MAPPING.md`, `docs/ROADMAP.md`

---

## 🚨 THE MUST — highest priority, no exceptions

0. **Announce every step — wait for yes/no.** Before any action (edit, run, push, read, create) output:
   > **Plan:** [numbered list of all steps you intend to take]
   
   Then **STOP** and wait for explicit "да" / "yes" / "go". Only after confirmation — execute step 1. If more steps remain — stop again after each one and wait. Do NOT chain actions silently. Do NOT proceed on assumption of approval.
1. **Stop and ask after one failed attempt.** If a bug or issue is not resolved on the first real attempt — STOP immediately. Ask the user to reproduce manually and provide more details. Do NOT keep iterating or running more diagnostics.
2. **Never guess. Never infer. Ask.** If any detail is unclear or missing — stop and ask exactly what information is needed. Do not proceed on assumptions.
3. **Implemented = removed from Not Supported.** Once a FHIR field or feature is fully implemented, DELETE its row from all Not Supported / remaining-gaps tables in `docs/FHIR-MAPPING.md` and add it to the relevant supported table. A ✅ row must **never** remain in a Not Supported section.

---

## ⚠️ WORKFLOW RULES — MANDATORY

1. **git commit/push only on explicit user instruction** ("push it", "пушай"). Never automatically.
   - `commit` and `push` are **two separate operations** — each requires explicit permission unless both are mentioned together.
   - "commit and push" / "пушай" = permission for both in one step.
   - "move / create / fix" without "push" = only edit files, do NOT commit or push.
2. **Before every push** — announce "I'm about to push, running pre-push checklist first", then: run `npx vitest run` (must pass); update relevant `docs/` files: `docs/CONTEXT.md` (file table, UX features, architecture), `docs/FHIR-MAPPING.md` (if FHIR mapping changed), `docs/ROADMAP.md` (if features completed or new features planned). `README.md` — only update for major changes (running instructions, sample data list, tech stack summary). **E2E (Playwright) tests are on-demand only** — run only when user explicitly asks ("run e2e"). Do NOT run playwright as part of the default pre-push checklist.
3. **Modularity** — new UI widget → `js/ui/<name>.js`; new control → `js/controls/<name>.js`; new CSS concern → `css/<name>.css` + `<link>` in index.html. Do not add logically separate code into existing modules.
   **500-line rule** — a file exceeding 500 lines is a signal that it needs logical splitting. Before adding more code to an oversized file, identify natural seams (independent concerns, repeated patterns, composable units) and extract them. This applies to JS modules, test specs, and CSS files alike. E2E specs should be split by feature area (one spec file per modal or feature cluster, not one mega-spec per page).
4. **OOP / DRY** — when 2+ modules share the same behavioral pattern, extract a shared base/factory instead of copy-pasting. Example: every modal is `class XyzModal extends Modal` from `js/ui/modals/modal-base.js` — override `open()`, `_apply()`, `_cancel()` only; never monkey-patch `_modal._apply = fn` or inline lifecycle boilerplate.
5. **DI** — services injected at startup via `BaseNode.configure(services)` (called in `builder/index.js`) and `Modal.configure(services)` (called in `builder/index.js`). Modules read services as `BaseNode._svc.*` / `Modal._svc.*`. No direct state/service imports in node or modal classes. DOM references resolved once at module load via `document.getElementById`.
6. **No inline styles** — `style="..."` in HTML and `el.style.foo =` in JS are forbidden for static values. Allowed only for **runtime-dynamic** values: show/hide (`display`), computed dimensions, user-driven colors. All static appearance → CSS classes.
7. **`<textarea>` rows** — `rows=1` for single-line values (url, text, short extension values); `rows=3` for multi-line content (XHTML, FHIRPath expressions, JSON objects). Never use `rows=2`.
8. **English only** — all code comments, doc strings, commit messages, CONTEXT.md, README.md, any in-repo text, **and all UI labels, button text, and tooltip text in HTML and JS** must be in English. No Russian anywhere in the codebase.
9. **E2E test selectors** — selectors in `tests/e2e/*.spec.js` must use `data-testid` (via `element.dataset.testid`) where applicable. No raw class or tag selectors. When adding a testable element, register its ID in the registry comment at the top of the relevant spec file.
10. **Tooltips** — **never use the native `title="..."` attribute**. Always use the custom rich tooltip system via `data-tip-title` / `data-tip-body` (and optionally `data-tip-fhir` / `data-tip-spec`). Triggered automatically by `js/ui/tooltip.js` on mouseover.
11. **Dropdowns / custom select** — **never use native `<select>`** for user-facing dropdown controls in UI modules or modals. Always use `createCustomSelect` from `js/ui/custom-select.js`. API: `createCustomSelect({items, value, onChange, className, testid, searchable})` → `{el, getValue(), setValue(v), setOptions(items), setOnChange(fn)}`. Append `.el` to the DOM. Use class `sc-trigger--sm` for compact (inline) size. E2E pattern: click trigger by `data-testid`, then `[data-testid="csel-drop"] [data-val="<value>"]`; verify selection via `data-value` attribute on the trigger element. Exception: native `<select>` is still acceptable in the preview panel for rendered questionnaire controls (not builder UI).
12. **Security — `innerHTML`** — never assign unsanitized external or user-supplied content to `innerHTML`. Any HTML string coming from outside the codebase (FHIR `_renderXhtml`, imported JSON, etc.) must be wrapped in `DOMPurify.sanitize(...)` (available as `window.DOMPurify` from `lib/dompurify.min.js`). Clearing a container with `el.innerHTML = ''` is always safe.
13. **Event-driven comms** — cross-module communication uses `document.dispatchEvent(new CustomEvent(...))` / `document.addEventListener(...)`. Named events: `questionnaire-loaded`, `questionnaire-cleared`, `reinit-form`, `show-json`, `patient-ctx-applied`, `renumber-progress`, `renumber-done`, `view-pref-change`, `preview-mode-change`, `qr-loaded`. Never pass module function references as callbacks when an event would decouple better.
14. **Error notifications** — use `showError(msg)` / `showWarn(msg)` / `showInfo(msg)` from `js/ui/toast.js`. Never use `window.alert()` or inline error text. The dialog **must match the shared modal style**: it reuses `.modal-backdrop`, `.modal-box`, `.modal-header`, `.modal-body`, `.modal-footer`, `.modal-btn`, `.modal-btn--apply` — `css/toast.css` only adds a z-index override, width, colored top-border accent, and a small `notif-title-icon` circle in the header. No big emoji, no custom colors outside the accent strip, no custom button styles.

---

## Project Context

- **Tech stack**: Vanilla JS ES Modules, @vue/reactivity (ref/reactive/effect), FHIRPath, Playwright e2e + Vitest unit tests
- **Architecture**: OOP node rendering (BaseNode → GroupNode/ItemNode), modal registry pattern, dependency injection via `_rc` context
- **Deployment**: GitHub Pages, CI runs tests on every push
- **Main files**: `js/app.js` (entry), `js/state.js` (reactive model), `js/builder/index.js` (left panel), `js/render-preview.js` (right panel), `js/nodes/*.js` (preview rendering)

See `docs/CONTEXT.md` for full file manifest, architecture diagrams, and UX feature list.
