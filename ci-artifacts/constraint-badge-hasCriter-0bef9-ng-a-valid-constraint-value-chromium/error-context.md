# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: constraint-badge.spec.js >> hasCriteria: badge visible for constraint-only questionnaire >> badge shows PASS after filling a valid constraint value
- Location: tests/e2e/constraint-badge.spec.js:68:3

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByTestId('status-badge-btn')
Expected substring: "PASS"
Received string:    "✗ FAIL · 1 issue"
Timeout: 8000ms

Call log:
  - Expect "toContainText" with timeout 8000ms
  - waiting for getByTestId('status-badge-btn')
    20 × locator resolved to <button type="button" id="statusBadgeBtn" data-testid="status-badge-btn" class="status-badge status-badge--fail">✗ FAIL · 1 issue</button>
       - unexpected value "✗ FAIL · 1 issue"

```

```yaml
- button "✗ FAIL · 1 issue"
```

# Test source

```ts
  1   | // ── E2E: Status badge and group icon with constraint-only / range-only items ──
  2   | //
  3   | // Covers two render-preview.js regressions fixed in the same commit:
  4   | //   1. hasCriteria fix — badge was hidden when questionnaire had only constraints
  5   | //      or only range items (no mandatory, no calc). Now includes hasConstraints
  6   | //      and hasRange in the hasCriteria check.
  7   | //   2. Group icon fix  — group .icon-ok/.icon-fail was always ✔ for groups whose
  8   | //      children had only constraints (not mandatory). Now evaluates constraints
  9   | //      in both relevantItems filter and itemOk predicate.
  10  | //
  11  | // Fixture: tests/fixtures/constraint-badge.fhir.json
  12  | //   grp-constraint  — group with one integer child "age" (constraint: >= 18, not required)
  13  | //   age             — integer item, constraint only, NOT required
  14  | //   score-range     — root integer item, minValue=0 / maxValue=100, NOT required
  15  | //
  16  | // Run: npx playwright test tests/e2e/constraint-badge.spec.js
  17  | //
  18  | // ── data-testid registry ─────────────────────────────────────────────────────
  19  | //   status-badge-btn    coloured PASS/FAIL pill in the preview header
  20  | // ─────────────────────────────────────────────────────────────────────────────
  21  | 
  22  | import path from 'node:path';
  23  | import { test, expect } from '@playwright/test';
  24  | 
  25  | const FIXTURE = path.resolve('tests/fixtures/constraint-badge.fhir.json');
  26  | 
  27  | async function waitForLoad(page) {
  28  |   await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  29  | }
  30  | 
  31  | async function loadFixture(page) {
  32  |   await page.addInitScript(() => localStorage.clear());
  33  |   await page.goto('/');
  34  |   await waitForLoad(page);
  35  |   await page.locator('#fhirFileInput').setInputFiles(FIXTURE);
  36  |   // Wait until the preview renders the group
  37  |   await expect(page.locator('[data-preview-id="grp-constraint"]')).toBeVisible({ timeout: 8_000 });
  38  | }
  39  | 
  40  | const badge = page => page.getByTestId('status-badge-btn');
  41  | 
  42  | // Blur the input, click away into a neutral area so the browser fires the
  43  | // change event reliably (headless Chromium may not fire it on blur() alone),
  44  | // then wait a tick for the async re-render to complete.
  45  | async function commitInput(page, input) {
  46  |   await input.blur();
  47  |   await page.locator('text=Questionnaire Preview').click();
  48  |   await page.waitForTimeout(300);
  49  | }
  50  | 
  51  | // ── 1. hasCriteria — badge visibility ─────────────────────────────────────────
  52  | 
  53  | test.describe('hasCriteria: badge visible for constraint-only questionnaire', () => {
  54  |   test('badge is visible on load (questionnaire has only constraints, no required fields)', async ({ page }) => {
  55  |     await loadFixture(page);
  56  |     await expect(badge(page)).toBeVisible();
  57  |   });
  58  | 
  59  |   test('badge shows FAIL initially (constraint not yet satisfied — no answer)', async ({ page }) => {
  60  |     await loadFixture(page);
  61  |     // age has required:false → only in constraintItems, not mandatoryItems
  62  |     // score-range has required:false → rangeAllOk=true when empty (no value violates range)
  63  |     // Only the age constraint failure → 1 issue
  64  |     await expect(badge(page)).toContainText('FAIL');
  65  |     await expect(badge(page)).toContainText('1 issue');
  66  |   });
  67  | 
  68  |   test('badge shows PASS after filling a valid constraint value', async ({ page }) => {
  69  |     await loadFixture(page);
  70  |     const input = page.locator('[data-preview-id="age"] input[type="number"]');
  71  |     await input.fill('20');
  72  |     await commitInput(page, input);
> 73  |     await expect(badge(page)).toContainText('PASS');
      |                               ^ Error: expect(locator).toContainText(expected) failed
  74  |   });
  75  | 
  76  |   test('badge returns to FAIL when constraint value becomes invalid', async ({ page }) => {
  77  |     await loadFixture(page);
  78  |     const input = page.locator('[data-preview-id="age"] input[type="number"]');
  79  |     await input.fill('20');
  80  |     await commitInput(page, input);
  81  |     await expect(badge(page)).toContainText('PASS');
  82  |     await input.fill('5');
  83  |     await commitInput(page, input);
  84  |     await expect(badge(page)).toContainText('FAIL');
  85  |   });
  86  | });
  87  | 
  88  | // ── 2. hasCriteria — badge visible for range-only questionnaire ───────────────
  89  | 
  90  | test.describe('hasCriteria: badge visible for range-only (minValue/maxValue) item', () => {
  91  |   test('badge is visible (score-range item has min/max, not required)', async ({ page }) => {
  92  |     await loadFixture(page);
  93  |     await expect(badge(page)).toBeVisible();
  94  |   });
  95  | 
  96  |   test('range item out of range: badge shows FAIL', async ({ page }) => {
  97  |     await loadFixture(page);
  98  |     const ageInput = page.locator('[data-preview-id="age"] input[type="number"]');
  99  |     const rangeInput = page.locator('[data-preview-id="score-range"] input[type="number"]');
  100 |     // Satisfy constraint, then violate the range
  101 |     await ageInput.fill('20');
  102 |     await commitInput(page, ageInput);
  103 |     // Now violate the range — badge must show FAIL
  104 |     await rangeInput.fill('200');
  105 |     await commitInput(page, rangeInput);
  106 |     await expect(badge(page)).toContainText('FAIL');
  107 |   });
  108 | 
  109 |   test('all valid: constraint satisfied + range in bounds → PASS', async ({ page }) => {
  110 |     await loadFixture(page);
  111 |     const ageInput   = page.locator('[data-preview-id="age"] input[type="number"]');
  112 |     const rangeInput = page.locator('[data-preview-id="score-range"] input[type="number"]');
  113 |     await ageInput.fill('25');
  114 |     await commitInput(page, ageInput);
  115 |     await rangeInput.fill('50');
  116 |     await commitInput(page, rangeInput);
  117 |     await expect(badge(page)).toContainText('PASS');
  118 |   });
  119 | });
  120 | 
  121 | // ── 3. Group icon — constraint-only child items ───────────────────────────────
  122 | 
  123 | test.describe('group icon reflects constraint-only child state', () => {
  124 |   test('group icon shows fail (✘) when child constraint not satisfied', async ({ page }) => {
  125 |     await loadFixture(page);
  126 |     const groupIcon = page.locator('[data-preview-id="grp-constraint"] .icon-fail');
  127 |     await expect(groupIcon).toBeVisible();
  128 |   });
  129 | 
  130 |   test('group icon shows ok (✔) after child constraint is satisfied', async ({ page }) => {
  131 |     await loadFixture(page);
  132 |     const input     = page.locator('[data-preview-id="age"] input[type="number"]');
  133 |     const groupOk   = page.locator('[data-preview-id="grp-constraint"] .icon-ok');
  134 |     const groupFail = page.locator('[data-preview-id="grp-constraint"] .icon-fail');
  135 |     await input.fill('21');
  136 |     await commitInput(page, input);
  137 |     await expect(groupOk).toBeVisible();
  138 |     await expect(groupFail).toHaveCount(0);
  139 |   });
  140 | 
  141 |   test('group icon reverts to fail when value drops below constraint', async ({ page }) => {
  142 |     await loadFixture(page);
  143 |     const input   = page.locator('[data-preview-id="age"] input[type="number"]');
  144 |     const groupOk = page.locator('[data-preview-id="grp-constraint"] .icon-ok');
  145 |     await input.fill('18');
  146 |     await commitInput(page, input);
  147 |     await expect(groupOk).toBeVisible();
  148 |     await input.fill('17');
  149 |     await commitInput(page, input);
  150 |     await expect(page.locator('[data-preview-id="grp-constraint"] .icon-fail')).toBeVisible();
  151 |   });
  152 | });
  153 | 
```