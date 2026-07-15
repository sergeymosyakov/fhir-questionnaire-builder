# GitHub Copilot Instructions for FHIR Questionnaire Builder

> **Critical workflow rules for AI agents working on this codebase.**  
> Full architecture docs: `docs/CONTEXT.md`, `docs/FHIR-MAPPING.md`, `docs/ROADMAP.md`

---

## 🚨 THE MUST — highest priority, no exceptions

0. **Announce every step — wait for yes/no.** Before any action (edit, run, push, read, create) output:
   > **Plan:** [numbered list of all steps you intend to take]
   
   Then **STOP** and wait for explicit "да" / "yes" / "go". Only after confirmation — execute step 1. If more steps remain — stop again after each one and wait. Do NOT chain actions silently. Do NOT proceed on assumption of approval.
1. **Stop and ask after one failed attempt.** If a bug or issue is not resolved on the first real attempt — STOP immediately. Ask the user to reproduce manually and provide more details. Do NOT keep iterating or running more diagnostics.
   **STOP command is absolute.** If the user writes "стоп", "stop", "стоять", "прекрати", "остановись", "стой" — immediately stop ALL actions, output one sentence max, and wait. No explanations, no tool calls, no "I'll just quickly check one more thing". Zero tolerance.
2. **Never guess. Never infer. Ask.** If any detail is unclear or missing — stop and ask exactly what information is needed. Do not proceed on assumptions.
3. **FHIR support ⇄ docs must stay in sync.** Implemented FHIR fields are removed from the Not Supported tables in `docs/FHIR-MAPPING.md` and from `docs/ROADMAP.md`; `help.html` and `sampledata/` are updated; every FHIR-mapped control carries the four `data-tip-*` attributes. Full details in [instructions/fhir.instructions.md](instructions/fhir.instructions.md).

---

## ⚠️ WORKFLOW RULES — MANDATORY

1. **git commit/push only on explicit user instruction** ("push it", "пушай"). Never automatically.
   - `commit` and `push` are **two separate operations** — each requires explicit permission unless both are mentioned together.
   - "commit and push" / "пушай" = permission for both in one step.
   - "move / create / fix" without "push" = only edit files, do NOT commit or push.
   - **`push` is NEVER included in a proposed plan automatically.** A plan may include commit, but push must always be requested separately by the user. Do not include `git push` as a step in any plan unless the user explicitly asked to push in the same message.
2. **Before every push** — announce "I'm about to push, running pre-push checklist first", then: run `npm run lint` (must pass, zero errors); run `npx vitest run` (must pass); update relevant `docs/` files: `docs/CONTEXT.md` (file table, UX features, architecture), `docs/FHIR-MAPPING.md` (if FHIR mapping changed), `docs/ROADMAP.md` (if features completed or new features planned). `README.md` — only update for major changes (running instructions, sample data list, tech stack summary). **E2E (Playwright) tests are on-demand only** — run only when the user explicitly asks ("run e2e"). Do NOT run playwright as part of the default pre-push checklist.
3. **English only** — all code comments, doc strings, commit messages, CONTEXT.md, README.md, any in-repo text, **and all UI labels, button text, and tooltip text in HTML and JS** must be in English. No Russian anywhere in the codebase.
4. **Every new feature ships with tests + sample coverage.** For any new user-facing functionality: (a) add **e2e (Playwright)** coverage under `tests/e2e/` proving the feature works end-to-end (plus unit tests for any pure logic); (b) if the feature is data-driven (FHIR field/extension, item type, control), either **add a new `sampledata/` file or extend an existing one** so the feature is visible to users, and keep `sampledata/library.json` + docs in sync. A feature that exists only in `tests/fixtures/` is not considered shipped.
5. **New rules go into the repo, not just memory** — whenever a new rule is established (in conversation, from a bug, from a lesson learned), add it immediately to the correct customization file (see layout below), without asking. Do not store rules only in local memory.
6. **Always run tests in an observable way — never blind-buffer.** Any test run (Vitest or Playwright), especially long ones, must be launched so their live state can be inspected at any moment. Do NOT pipe the command through `tail`/`head`/`grep` (that hides all output until the process ends and makes progress invisible). Instead stream output live (plain `npx vitest run` / `npx playwright test`) or tee it to a log file that can be read mid-run (e.g. `npx playwright test 2>&1 | tee /tmp/e2e.log`). Then filter the saved log afterwards if a summary is needed.

---

## 🗂️ Customization layout

Domain rules live in scoped instruction files (auto-loaded by their `applyTo` glob) and on-demand skills. These files are authoritative — when a domain rule changes, edit the file below, not this one.

| File | Scope (`applyTo`) | Contains |
|------|-------------------|----------|
| [instructions/js-architecture.instructions.md](instructions/js-architecture.instructions.md) | `js/**` | OOP/DI/DRY, event-driven comms (AppEvents/EventState/detail-less/no-tick), `app.js` composition root, 500-line & UI-behavior-class rules, no inline styles, custom-select, tooltips, `innerHTML`/URL security, toasts, textarea rows |
| [instructions/fhir.instructions.md](instructions/fhir.instructions.md) | `js/**`, `docs/**`, `help.html`, `sampledata/**` | Mandatory FHIR tooltips, implemented→remove-from-Not-Supported/ROADMAP, `help.html` sync, sample-data requirement, two-layer preview validation |
| [instructions/e2e.instructions.md](instructions/e2e.instructions.md) | `tests/e2e/**` | `data-testid` selector policy, flaky-test patterns, fixture validity, no silent workarounds |
| [skills/add-fhir-extension/SKILL.md](skills/add-fhir-extension/SKILL.md) | on-demand | End-to-end recipe for adding a FHIR field/extension/SDC feature |

---

## Project Context

- **Tech stack**: Vanilla JS ES Modules, event-driven reactivity (`AppEvents` custom events), FHIRPath, Playwright e2e + Vitest unit tests
- **Architecture**: OOP node rendering (BaseNode → GroupNode/ItemNode), modal registry pattern, dependency injection via `_rc` context (`js/preview/render-ctx.js`)
- **app.js is a pure composition root** — allowed: creating singletons with data-DI (`questDoc`, `answerStore`), dispatching `APP_CONTEXT_READY`, `storage.register()`. Forbidden: DOM queries (`getElementById`/`querySelector`), callbacks in constructors (`onEdit`, `getFhirTarget`, `shouldValidate`), passing DOM elements to constructors, two-step init (`new Foo().init()`). Classes self-find their mount points via `document.querySelector('[data-mount="name"]')` in their own constructor.
- **Ownership exception** — a class that *owns* sub-components may instantiate them directly (e.g. `BuilderPanel` creates `RenumberControl`; `QuestionnaireLoader` uses `loadConfirmModal`). Only `app.js` must not know about sub-component internals.
- **Deployment**: GitHub Pages, CI runs tests on every push
- **Main files**: `js/app.js` (entry/composition root), `js/fhir/quest-document.js` + `js/answer-store.js` (data model), `js/fhir/form-checks.js` (`calcFormOk`), `js/builder/index.js` (left panel), `js/preview-form.js` (right panel), `js/nodes/*.js` (preview rendering)

See `docs/CONTEXT.md` for full file manifest, architecture diagrams, and UX feature list.
