---
applyTo: "tests/e2e/**"
description: "Playwright end-to-end test conventions for the FHIR Questionnaire Builder — data-testid selector policy, flaky-test patterns (preview input commit, inline-title click, dropdown open, state transitions), fixture validity, and no silent workarounds in helpers. Use when writing or fixing any spec under tests/e2e/."
---

# E2E (Playwright) test conventions

Rules for all specs under `tests/e2e/`.

## Selector policy — `data-testid`

Selectors must use `data-testid` (via `element.dataset.testid`) **wherever possible**. This is the default and applies to all builder UI: modals, panels, toolbars, menus, cards, buttons, inputs, and any element the builder itself renders. No raw class (`.foo`), tag, `#id`, or `getByText(...)` selectors for these — if a testable element lacks a `data-testid`, add one to the source element rather than selecting it by class/id/text.

**Only when a `data-testid` is genuinely impossible** may class/text selectors be used, and then it is acceptable to ignore this rule. The single sanctioned exception is the preview panel's rendered questionnaire controls (the runtime form output — `.sc-trigger`, `.oc-opt`, `.repeat-row`, `.radio-label`, `.preview-*`, `#lform`, etc.), which mirror an external renderer and need not carry `data-testid`. When adding a testable element, register its id in the registry comment at the top of the relevant spec file.

## Flaky-test patterns

**Preview input commit** — to commit a value entered in a preview-panel input (triggering `blur` → `BaseNode.notifyChanged()` → `RESPONSE_CHANGED`), always click the search input: `await page.getByTestId('preview-search-input').click()`. This is a real `<input>` so focus transfer is guaranteed. Never use `Tab`, `waitForTimeout`, or clicking a non-input span. Encapsulate:
```js
async function commitInput(page) {
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.getByTestId('preview-search-input').click();
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}
```

**Inline title click-to-edit** — to enter a node's inline title editor (`node-title-display` span → `node-title-input` textarea), never use the fragile `click(display)` then `expect(display).not.toBeVisible()`: a re-render right after node creation can swallow the single click. Retry the click until edit mode actually engages, and assert positively on the input:
```js
await expect(item.getByTestId('node-title-display')).toBeVisible();
await expect(async () => {
  await item.getByTestId('node-title-display').click();
  await expect(item.getByTestId('node-title-input')).toBeVisible();
}).toPass();
await item.getByTestId('node-title-input').fill(title);
await item.getByTestId('node-title-input').blur();
```

**Dropdown-menu open** — `DropdownMenu` toggle buttons (`export-btn`, `tools-btn`, `load-btn`, `save-btn`, etc.) flip the menu: clicking while open *closes* it. Never click the toggle then immediately click a menu item — if the first click is missed (or a `CLOSE_DROPDOWNS` race fires), the item stays `display:none` and the test hangs. Open retry-safely by clicking the toggle only when the target item is not yet visible:
```js
await expect(async () => {
  if (!(await page.getByTestId('export-quest-item').isVisible())) {
    await page.getByTestId('export-btn').click();
  }
  await expect(page.getByTestId('export-quest-item')).toBeVisible();
}).toPass();
await page.getByTestId('export-quest-item').click();
```

**State transitions (ok→fail)** — assert `.not.toBeVisible()` on the previous state before checking the new one.

**Modal title empty** — assert `toBeVisible()` on the backdrop before `toContainText()` on the title span.

**rAF yield before commitInput** — after `fill()` for reactive DOM, yield two rAF before committing.

**Preserve `data-testid` when moving/consolidating UI** — when a control moves to a new home (e.g. a title-row icon → a gear-menu item), keep the **same** `data-testid` on the new element so existing specs keep resolving it. Only the *interaction* changes (e.g. open the gear menu first), not the id. This avoids mass spec churn. If the surrounding container now contains sibling nodes carrying the same testid (a group whose children reuse `node-copy-btn` etc.), scope the locator to the node's own menu with `.first()` (the node's own header/menu precedes its children in the DOM).

## Fixtures

- **Fixture validity** — test fixtures must not trigger side-effects unrelated to the test. If loading a fixture causes a warning/error modal to auto-open (e.g. import validate modal), fix the fixture — do NOT dismiss the modal silently in `loadFixture`/`freshLoad`. A `choice` item in a fixture must have at least 1 `answerOption` to avoid triggering the import validation warning. Empty-state UI scenarios must be reached by removing rows in the test, not by having a broken fixture item.
- **No silent workarounds in test helpers** — `if (await modal.isVisible()) { await modal.close() }` in a setup helper is forbidden unless the test explicitly covers that modal. If something unexpected opens during test setup, fix the root cause. Exception: if the test IS asserting on the modal (checking its content, verifying it opened), dismissing it at the end of the assertion block is correct.

## Running the suite

- **Always run tests in an observable way — never blind-buffer.** Playwright (and Vitest) runs, especially the full e2e suite, must be launched so their live state is inspectable at any moment. Do NOT pipe the command through `tail`/`head`/`grep` — that buffers everything until the process exits and hides all progress. Instead either stream output live (`npx playwright test`) or tee it to a log file that can be read while the run is in flight (`npx playwright test 2>&1 | tee /tmp/e2e.log`), then filter the saved log afterwards for a summary.
- E2E is **on-demand only** — run `npx playwright test` only when explicitly asked, never as part of the default pre-push checklist.
