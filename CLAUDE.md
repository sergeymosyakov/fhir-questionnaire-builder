# Claude Code Instructions for FHIR Questionnaire Builder

The rules for AI agents are shared with GitHub Copilot and live in `.github/` — single source of truth, do not duplicate them here.

@.github/copilot-instructions.md

## Claude Code mapping

- **Scoped rules** (`.github/instructions/*.instructions.md`, `applyTo` globs) are loaded via `.claude/rules/*.md` wrappers with the same globs as `paths:`. Edit the rule in `.github/instructions/`, not in the wrapper.
- **Skills** (`.github/skills/`) are exposed through the `.claude/skills` symlink — add or edit them in `.github/skills/` only.
- **Onboarding**: `/start` (`.claude/commands/start.md`) mirrors `.github/prompts/start.prompt.md`.
- "New rules go into the repo, not just memory" (workflow rule 5) applies here too: add them to the matching file under `.github/`, not to `CLAUDE.md` or local memory.
- Where the shared rules say "Copilot", "memory tool" or "customization file", read it as the Claude Code equivalent above.
