---
description: Onboard for fhir-qb — load rules and report project state before starting work.
---
Onboard for **fhir-qb** (the FHIR Questionnaire Builder — the upstream "original") before any task. Do NOT commit, push, or edit anything during onboarding.

1. Read the auto-loaded memory index (`MEMORY.md`) and open any fhir-qb-scoped entries.
2. Skim the rule files: `.github/copilot-instructions.md` (imported by `CLAUDE.md`) and the scoped `.github/instructions/*.instructions.md` per `applyTo` (js-architecture → `js/**`; fhir → `js/**`, `docs/**`, `help.html`, `sampledata/**`; e2e → `tests/e2e/**`). Check `.github/skills/` for on-demand recipes (e.g. add-fhir-extension).
3. Run `git status -sb` — note the current branch and any uncommitted changes.
4. Output a short status: branch, uncommitted files, open items. Then STOP and wait for the task.
