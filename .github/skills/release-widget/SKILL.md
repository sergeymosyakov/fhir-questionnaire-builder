---
name: release-widget
description: "Step-by-step recipe to release a new version of the embeddable QuestionnaireRenderer widget (GitHub Release + npm + NuGet) via the release-widget.yml workflow. USE WHEN: user asks to release/ship/publish a new widget version, or to recover from a partial/failed publish (e.g. NuGet-only republish). DO NOT USE FOR: the main fhir-qb app itself (no release concept — GitHub Pages deploys automatically on push to master) or fhir-structuremap-js's npm release (separate repo/process)."
---

# Release widget

fhir-qb's only "release" concept is the embeddable **QuestionnaireRenderer widget**
(`dist/questionnaire-widget.*`), versioned independently from the app itself (the
app has no release step — GitHub Pages deploys on every push to master). Releases
are tagged `widget-vMAJOR.MINOR.PATCH` and published to three channels: GitHub
Release, npm (`@sergeymosyakov/questionnaire-widget`), NuGet (`FhirQuestionnaireWidget`).

## Versioning
- `version.json` at repo root holds `{ major, minor }` (hand-edited only when you
  actually want to bump one of those — most releases don't touch it).
- **Patch auto-increments** — the workflow counts existing `widget-vMAJOR.MINOR.*`
  tags and uses that count as the next patch (first release of a `major.minor` is
  `.0`, next `.1`, ...). Bumping `major`/`minor` in `version.json` resets patch to 0.
- Predict the next tag before releasing: `git tag -l "widget-v<major>.<minor>.*" | wc -l`.

## Release notes (written by hand, before the release)
The GitHub Release body is `docs/releases/widget/<semver>.md` (the next version, e.g. `1.0.18.md`) followed by
the fixed assets / quick-start text of `.github/release-notes-widget.md`. **The workflow refuses to run without the
file** (it checks right after computing the version) and never fills in a list of commits.

Write it for the people who embed the widget, not for the repo:
- Find what could matter: `npx esbuild js/renderer/index.js --bundle --metafile=/tmp/m.json --outfile=/tmp/w.js` lists
  the files in the bundle; `git log widget-v<prev>..master --no-merges -- <those files> css/widget.css` lists the
  commits, `gh pr view <n>` / `gh issue view <n>` give the reasons. Many commits are builder-only: leave them out.
- No title line: the release already has one. Start with one paragraph saying what the release is about.
- Group by what the reader notices (calculations, what the response contains, conditions, language, safety,
  API...), plain language, one line per change, issue/PR number in brackets. No commit subjects, no file names.
- Verify each claim against the code or the PR before writing it; never describe what was not checked. For a behaviour claim that matters (a fix a host would notice), run the previous release's bundle (`gh release download widget-v<prev>`) and the current build side by side.
- "Check before upgrading": every behaviour change a host application could depend on.
- API: new / changed / removed (say "nothing is removed" only when true). Size: build and compare the bundle with the previous release's asset.
- No promises: nothing about plans or dates; say what is not covered.
- The notes file goes to `master` through a normal PR (with the review of rule 10), before the workflow is dispatched.

## Release steps
This is a **real, hard-to-reverse action** (mints a tag + GitHub Release, publishes
to npm and NuGet) — always state the predicted next tag and get explicit
confirmation before triggering, per WORKFLOW RULE 1 in `.github/copilot-instructions.md` (git commit/push only on explicit instruction).

1. Confirm the intended feature(s) **and the release notes file** are already merged to `master` (`gh pr list
   --state all --head <branch>` if unsure) — the workflow releases whatever is on
   `master` (or the `--ref` you pass), not your local checkout.
2. Optional but recommended before spending CI minutes: sync local master and run
   a fast local sanity check — `git checkout master && git pull --ff-only && npm
   run lint && npx vitest run`.
3. Optional rehearsal: `gh workflow run release-widget.yml --ref master -f dry_run=true` runs
   the release-notes check, tests, build, tag computation, NuGet pack and `npm pack --dry-run`. It skips release
   creation and the npm/NuGet OIDC login and push, so a green dry run is necessary, not sufficient.
4. Trigger: `gh workflow run release-widget.yml --ref master`. Never pass
   `nuget_only=true` for a normal release — that input is the recovery-only path
   (see below).
5. Find the run and watch it to completion: `gh run list --workflow=release-widget.yml
   --limit 1` then `gh run watch <id>`. Takes ~10-15 min. Two jobs: `verify` (read-only:
   compute tag → check the release notes exist → lint → unit → e2e (chromium only, `--grep-invert @perf`) → build widget →
   artifact) then `publish` (write + OIDC: NuGet pack → GitHub Release → npm publish → NuGet
   publish), so dependency install scripts never run with publishing rights.
6. Verify all three artifacts actually landed — **do not trust the job's green
   checkmark alone**:
   - GitHub Release: `gh release view widget-v<X.Y.Z>` — assets present
     (`questionnaire-widget.js`, `.global.js`, `.css`, `SHA256SUMS.txt`).
   - npm: `npm view @sergeymosyakov/questionnaire-widget version` matches.
   - **NuGet gotcha**: that publish step has `continue-on-error: true`, so the job
     stays green even when the NuGet push actually fails (happened for real — a
     `NU5030` packaging error was masked this way). Check the step's raw log
     (`gh run view <id> --log | grep -i nuget`) for an actual success line, or
     confirm on nuget.org directly — don't just trust the checkmark.
7. Report back: new tag, GitHub Release URL, explicit confirmation that npm *and*
   NuGet both actually published (not just "job green").

## Recovery: NuGet-only republish
If NuGet publish failed for the *current* release but GitHub Release + npm already
succeeded, don't re-run a full release (it would mint a new tag/version for
something already shipped). Instead: `gh workflow run release-widget.yml --ref
master -f nuget_only=true` — skips lint/test/e2e/tag/release/npm and republishes
the existing latest `widget-v*` version to NuGet only.

## After release
- [WIDGET.md](../../../WIDGET.md) documents all three install channels; its CDN
  quick-start example pins an illustrative `@widget-v1.0.x` tag — updating it to
  the newest tag is optional polish, not required for the release itself.
- Closing now-superseded branches/PRs after a release is a separate explicit step,
  not automatically bundled with releasing.

## Known limits
- No `npm_only` recovery: if npm publish fails after the GitHub Release exists, fix the cause and
  publish manually; a normal re-run would mint the next patch number.
- `nuget_only` rebuilds from current `master`, so the NuGet package can contain newer code than the
  released npm/GitHub assets if `master` moved since.
