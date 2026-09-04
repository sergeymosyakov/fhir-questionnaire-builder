---
name: feature-workflow
description: "Standard end-to-end workflow for shipping any feature or fix in this repo: issue → branch → implement/validate → commit → push → PR with squash auto-merge → close issue → delete branch. USE WHEN: starting new feature/fix work, deciding branch naming, unsure whether/when to open a PR, wiring work to a tracking issue, wrapping up finished work. DO NOT USE FOR: one-off doc/typo edits that don't need a branch or issue."
---

# Feature workflow

The same flow applies to every feature, fix, or chore that touches code (not just a one-line doc tweak). Follow it in order — don't skip steps or reorder them.

## 1. Issue
- If there's no tracking issue yet, create one (`gh issue create`) describing the gap/bug — for multi-step features, include a phased checklist (`- [ ] Phase N — ...`) so progress is visible over multiple branches/sessions.
- **Business requirement only — no implementation details.** An issue states the *problem*: current behavior vs. expected/desired behavior (or just the desired behavior, for a from-scratch feature). No class/function/file names, no CSS selectors, no chosen mechanism, no code. A checklist item is a testable outcome ("X can be toggled back to its original size"), not an implementation step ("add class Y to file Z"). Implementation details belong in the PR description and commit messages, once a solution is chosen.
- If one already exists, read it first (`gh issue view <n>`) — don't guess scope from memory or from a stale summary.

## 2. Branch
- Sync the local default branch first: `git checkout master && git pull --ff-only` (or `main`) — never branch off a stale local ref (see the squash-merge note in step 6).
- Name it `feature/<slug>-<issue#>` or `fix/<slug>-<issue#>`, including the issue number whenever one exists.

## 3. Implement + validate
- Do the work. Run the repo's lint + unit tests (and e2e when the feature is user-facing or explicitly requested) before considering it done — see this repo's own copilot-instructions.md pre-push checklist for the exact commands.
- Keep tests + sample/fixture coverage in step with the feature per the repo's own rules (e.g. e2e + sampledata for user-facing FHIR features in fhir-qb).
- If a real bug slips through review/testing, fix it directly on the same branch — don't open a second branch for a same-feature bugfix found before merge.

## 4. Commit + push — still two separate explicit permissions
- This workflow describes the SHAPE of the flow, not a bypass of the commit/push permission rule: commit and push each still require the user's explicit "commit" / "push" / "да" — never fire them just because the feature "looks done".
- Once permitted: commit with an essence-only message (subject + short bullets — why/what in a few words, no essay, no restating the diff), then push.

## 5. PR — only once the feature is fully complete
- If the branch is mid-flight (more work planned before it's shippable), don't open a PR yet — keep pushing to the branch and iterating.
- Once fully complete and validated: `gh pr create` (reference the tracking issue with `Closes #<n>` in the body when one exists), then `gh pr merge <branch> --squash --auto`. Squash auto-merge is the default — skip it only for large/needs-manual-review branches, and say so explicitly rather than silently deviating.

## 6. Close out
- If there was a tracking issue, update its checklist (`gh issue edit`) to reflect what actually shipped, even though the PR's `Closes #<n>` will auto-close it on merge — keep the checklist accurate for anyone reading history later.
- After the PR merges (confirm via `gh pr view <n> --json state,mergedAt`), sync the local default branch (`git checkout master && git pull --ff-only`) and delete the branch both locally (`git branch -d`) and on origin (`git push origin --delete`).
- If a later branch was accidentally created off a stale pre-merge master, `git rebase origin/master` on it — git recognizes previously-applied squash commits and skips them cleanly in most cases.

## Cross-repo note
This account maintains multiple repos with the same flow (fhir-qb, fhir-structuremap-js, ...). Keep this skill's content identical across them — if the flow changes in one, mirror the change to the others rather than letting them diverge silently.
