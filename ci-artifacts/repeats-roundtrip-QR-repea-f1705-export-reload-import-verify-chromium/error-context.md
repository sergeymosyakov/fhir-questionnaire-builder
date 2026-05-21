# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: repeats-roundtrip.spec.js >> QR repeat round-trip: fill 3 rows per field, export, reload, import, verify
- Location: tests/e2e/repeats-roundtrip.spec.js:65:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForEvent: Test timeout of 30000ms exceeded.
=========================== logs ===========================
waiting for event "download"
============================================================
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]: Logic Builder
    - button "👤 Patient ▾" [ref=e6] [cursor=pointer]
    - generic [ref=e7]:
      - link "GitHub" [ref=e8] [cursor=pointer]:
        - /url: https://github.com/sergeymosyakov/fhir-questionnaire-builder
        - img [ref=e9]
        - text: GitHub
      - generic [ref=e11]:
        - text: © 2026
        - link "Sergey Mosyakov" [ref=e12] [cursor=pointer]:
          - /url: https://github.com/sergeymosyakov
        - text: · Free to use with attribution
  - generic [ref=e13]:
    - generic [ref=e14]:
      - generic [ref=e15]:
        - generic [ref=e16]:
          - generic [ref=e17]: Logic Builder
          - generic [ref=e18]:
            - button "autosave · 07:47" [ref=e19] [cursor=pointer]
            - button "tips" [ref=e20] [cursor=pointer]
        - generic [ref=e21]:
          - button "+ Add Root Group" [ref=e22] [cursor=pointer]
          - button [ref=e23] [cursor=pointer]:
            - img [ref=e24]
          - button [ref=e26] [cursor=pointer]:
            - img [ref=e27]
          - combobox [ref=e29] [cursor=pointer]:
            - option "1 · 2 · 3" [selected]
            - option "I · II · III"
            - option "A · B · C"
          - button "↺ Renumber" [ref=e30] [cursor=pointer]
      - generic [ref=e31]:
        - generic [ref=e32]: Questionnaire
        - generic [ref=e33]: active
        - button "Edit" [ref=e34] [cursor=pointer]
      - generic [ref=e36]:
        - button "Collapse / expand" [expanded] [ref=e37] [cursor=pointer]:
          - img [ref=e38]
        - generic [ref=e40]: Variables
        - button "↺ Re-init" [ref=e41] [cursor=pointer]
        - button "Edit" [ref=e42] [cursor=pointer]
      - generic [ref=e44]:
        - generic [ref=e45]:
          - generic: Drop here
          - generic [ref=e46]:
            - generic [ref=e47]:
              - generic [ref=e49]:
                - generic "Drag to reorder" [ref=e50]: ⠿
                - generic [ref=e51] [cursor=pointer]: "[Item]"
              - generic [ref=e52]:
                - generic [ref=e53]: "id:"
                - textbox "FHIR linkId — editable" [ref=e54]: text-item
                - generic [ref=e55]: "prefix:"
                - textbox "Display prefix (e.g. 1.2) — cosmetic only, does not affect logic" [ref=e56]:
                  - /placeholder: prefix
              - generic [ref=e58] [cursor=pointer]: Text answer
              - generic [ref=e59]:
                - generic [ref=e60] [cursor=pointer]: Answer Type
                - generic [ref=e61] [cursor=pointer]: Required
                - generic [ref=e62] [cursor=pointer]: Show When
                - generic [ref=e63] [cursor=pointer]: Expression
                - generic [ref=e64] [cursor=pointer]: Read-only
                - generic [ref=e65] [cursor=pointer]: Repeatable
                - generic [ref=e66] [cursor=pointer]: Default
                - generic [ref=e67] [cursor=pointer]: Constraint
                - generic [ref=e68] [cursor=pointer]: Appearance
                - generic [ref=e69] [cursor=pointer]: Props
            - button "✕" [ref=e70] [cursor=pointer]
        - generic [ref=e71]:
          - generic: Drop here
          - generic [ref=e72]:
            - generic [ref=e73]:
              - generic [ref=e75]:
                - generic "Drag to reorder" [ref=e76]: ⠿
                - generic [ref=e77] [cursor=pointer]: "[Item]"
              - generic [ref=e78]:
                - generic [ref=e79]: "id:"
                - textbox "FHIR linkId — editable" [ref=e80]: number-item
                - generic [ref=e81]: "prefix:"
                - textbox "Display prefix (e.g. 1.2) — cosmetic only, does not affect logic" [ref=e82]:
                  - /placeholder: prefix
              - generic [ref=e84] [cursor=pointer]: Number answer
              - generic [ref=e85]:
                - generic [ref=e86] [cursor=pointer]: Answer Type
                - generic [ref=e87] [cursor=pointer]: Required
                - generic [ref=e88] [cursor=pointer]: Show When
                - generic [ref=e89] [cursor=pointer]: Expression
                - generic [ref=e90] [cursor=pointer]: Read-only
                - generic [ref=e91] [cursor=pointer]: Repeatable
                - generic [ref=e92] [cursor=pointer]: Default
                - generic [ref=e93] [cursor=pointer]: Constraint
                - generic [ref=e94] [cursor=pointer]: Appearance
                - generic [ref=e95] [cursor=pointer]: Props
            - button "✕" [ref=e96] [cursor=pointer]
        - generic [ref=e97]:
          - generic: Drop here
          - generic [ref=e98]:
            - generic [ref=e99]:
              - generic [ref=e101]:
                - generic "Drag to reorder" [ref=e102]: ⠿
                - generic [ref=e103] [cursor=pointer]: "[Item]"
              - generic [ref=e104]:
                - generic [ref=e105]: "id:"
                - textbox "FHIR linkId — editable" [ref=e106]: date-item
                - generic [ref=e107]: "prefix:"
                - textbox "Display prefix (e.g. 1.2) — cosmetic only, does not affect logic" [ref=e108]:
                  - /placeholder: prefix
              - generic [ref=e110] [cursor=pointer]: Date answer
              - generic [ref=e111]:
                - generic [ref=e112] [cursor=pointer]: Answer Type
                - generic [ref=e113] [cursor=pointer]: Required
                - generic [ref=e114] [cursor=pointer]: Show When
                - generic [ref=e115] [cursor=pointer]: Expression
                - generic [ref=e116] [cursor=pointer]: Read-only
                - generic [ref=e117] [cursor=pointer]: Repeatable
                - generic [ref=e118] [cursor=pointer]: Default
                - generic [ref=e119] [cursor=pointer]: Constraint
                - generic [ref=e120] [cursor=pointer]: Appearance
                - generic [ref=e121] [cursor=pointer]: Props
            - button "✕" [ref=e122] [cursor=pointer]
        - generic [ref=e123]:
          - generic: Drop here
          - generic [ref=e124]:
            - generic [ref=e125]:
              - generic [ref=e127]:
                - generic "Drag to reorder" [ref=e128]: ⠿
                - generic [ref=e129] [cursor=pointer]: "[Item]"
              - generic [ref=e130]:
                - generic [ref=e131]: "id:"
                - textbox "FHIR linkId — editable" [ref=e132]: select-item
                - generic [ref=e133]: "prefix:"
                - textbox "Display prefix (e.g. 1.2) — cosmetic only, does not affect logic" [ref=e134]:
                  - /placeholder: prefix
              - generic [ref=e136] [cursor=pointer]: Select answer
              - generic [ref=e137]:
                - generic [ref=e138] [cursor=pointer]: Answer Type
                - generic [ref=e139] [cursor=pointer]: Required
                - generic [ref=e140] [cursor=pointer]: Show When
                - generic [ref=e141] [cursor=pointer]: Expression
                - generic [ref=e142] [cursor=pointer]: Read-only
                - generic [ref=e143] [cursor=pointer]: Repeatable
                - generic [ref=e144] [cursor=pointer]: Default
                - generic [ref=e145] [cursor=pointer]: Constraint
                - generic [ref=e146] [cursor=pointer]: Appearance
                - generic [ref=e147] [cursor=pointer]: Props
            - button "✕" [ref=e148] [cursor=pointer]
        - generic: Drop here to move to end
    - generic [ref=e150]:
      - generic [ref=e151]:
        - generic [ref=e152]:
          - generic [ref=e153]:
            - generic [ref=e154]: Questionnaire Preview
            - generic [ref=e155]:
              - generic [ref=e156]: all-types-repeatable.fhir.json
              - button "×" [ref=e157] [cursor=pointer]
          - generic [ref=e158]:
            - button "👁 Patient View" [ref=e159] [cursor=pointer]
            - button "Validate" [ref=e160] [cursor=pointer]
            - button "✓ PASS" [ref=e162] [cursor=pointer]
        - generic [ref=e163]:
          - button "Questionnaires ▾" [ref=e165] [cursor=pointer]
          - button "📥 Answers ▾" [ref=e167] [cursor=pointer]
          - button "⬇ Export ▾" [ref=e169] [cursor=pointer]
          - generic [ref=e170]:
            - searchbox "🔍 Search…" [ref=e171]
            - button "↑" [ref=e172] [cursor=pointer]
            - button "↓" [ref=e173] [cursor=pointer]
          - button "id" [ref=e174] [cursor=pointer]
          - button "prefix" [ref=e175] [cursor=pointer]
          - button "badges" [ref=e176] [cursor=pointer]
          - button [ref=e177] [cursor=pointer]:
            - img [ref=e178]
          - button [ref=e180] [cursor=pointer]:
            - img [ref=e181]
      - generic [ref=e184]:
        - generic [ref=e185]:
          - generic [ref=e186] [cursor=pointer]: ↗
          - generic [ref=e187]: ✔
          - generic [ref=e188] [cursor=pointer]: text-item
          - generic [ref=e189]: Text answer*
          - generic [ref=e190]:
            - generic [ref=e191]:
              - textbox [ref=e193]: Hello
              - button "×" [ref=e194] [cursor=pointer]
            - generic [ref=e195]:
              - textbox [ref=e197]: World
              - button "×" [ref=e198] [cursor=pointer]
            - generic [ref=e199]:
              - textbox [ref=e201]: Foo
              - button "×" [ref=e202] [cursor=pointer]
            - button "+ Add another" [ref=e203] [cursor=pointer]
        - generic [ref=e204]:
          - generic [ref=e205] [cursor=pointer]: ↗
          - generic [ref=e206]: ✔
          - generic [ref=e207] [cursor=pointer]: number-item
          - generic [ref=e208]: Number answer*
          - generic [ref=e209]:
            - generic [ref=e210]:
              - spinbutton [ref=e212]: "10"
              - button "×" [ref=e213] [cursor=pointer]
            - generic [ref=e214]:
              - spinbutton [ref=e216]: "20"
              - button "×" [ref=e217] [cursor=pointer]
            - generic [ref=e218]:
              - spinbutton [ref=e220]: "30"
              - button "×" [ref=e221] [cursor=pointer]
            - button "+ Add another" [ref=e222] [cursor=pointer]
        - generic [ref=e223]:
          - generic [ref=e224] [cursor=pointer]: ↗
          - generic [ref=e225]: ✔
          - generic [ref=e226] [cursor=pointer]: date-item
          - generic [ref=e227]: Date answer*
          - generic [ref=e228]:
            - generic [ref=e229]:
              - generic [ref=e232] [cursor=pointer]: 1 January 2024
              - button "×" [ref=e233] [cursor=pointer]
            - generic [ref=e234]:
              - generic [ref=e237] [cursor=pointer]: 15 February 2024
              - button "×" [ref=e238] [cursor=pointer]
            - generic [ref=e239]:
              - generic [ref=e242] [cursor=pointer]: 31 March 2024
              - button "×" [ref=e243] [cursor=pointer]
            - button "+ Add another" [ref=e244] [cursor=pointer]
        - generic [ref=e245]:
          - generic [ref=e246] [cursor=pointer]: ↗
          - generic [ref=e247]: ✔
          - generic [ref=e248] [cursor=pointer]: select-item
          - generic [ref=e249]: Select answer*
          - generic [ref=e250]:
            - generic [ref=e251]:
              - generic [ref=e254] [cursor=pointer]: Option A
              - button "×" [ref=e255] [cursor=pointer]
            - generic [ref=e256]:
              - generic [ref=e259] [cursor=pointer]: Option B
              - button "×" [ref=e260] [cursor=pointer]
            - generic [ref=e261]:
              - generic [ref=e264] [cursor=pointer]: Option C
              - button "×" [ref=e265] [cursor=pointer]
            - button "+ Add another" [ref=e266] [cursor=pointer]
  - generic [ref=e268]:
    - generic [ref=e269]:
      - generic [ref=e270]: Export QuestionnaireResponse
      - button "✕" [ref=e271] [cursor=pointer]
    - generic [ref=e272]:
      - text: File name
      - textbox "File name" [ref=e273]: all-types-repeatable.fhir.json-response.json
      - text: Status
      - combobox "Status" [ref=e274]:
        - option "in-progress" [selected]
        - option "completed"
        - option "amended"
        - option "entered-in-error"
        - option "stopped"
      - text: Subject reference
      - textbox "Subject reference" [ref=e275]:
        - /placeholder: Patient/123
      - text: Author reference
      - textbox "Author reference" [ref=e276]:
        - /placeholder: Practitioner/456
    - generic [ref=e277]:
      - button "Cancel" [ref=e278] [cursor=pointer]
      - button "⬇ Export" [ref=e279] [cursor=pointer]
```

# Test source

```ts
  1   | // ── E2E: Repeatable QR round-trip ─────────────────────────────────────────────
  2   | // Loads a fixture with 4 repeatable field types (text, number, date, select),
  3   | // fills 3 rows for each, exports as QuestionnaireResponse, reloads the page,
  4   | // re-loads the fixture, imports the QR, and verifies every value round-trips.
  5   | //
  6   | // Run: npx playwright test tests/e2e/repeats-roundtrip.spec.js
  7   | // ─────────────────────────────────────────────────────────────────────────────
  8   | 
  9   | import path from 'node:path';
  10  | import { test, expect } from '@playwright/test';
  11  | 
  12  | const FIXTURE = path.resolve('tests/fixtures/all-types-repeatable.fhir.json');
  13  | 
  14  | async function loadFixture(page) {
  15  |   await page.locator('#fhirFileInput').setInputFiles(FIXTURE);
  16  |   await expect(page.locator('[data-preview-id="text-item"]')).toBeVisible({ timeout: 8_000 });
  17  | }
  18  | 
  19  | // Fill N rows for an item: fill row 0, then click "+ Add another" and fill row 1, 2, ...
  20  | async function fillTextRows(page, linkId, values) {
  21  |   const wrap = page.locator(`[data-preview-id="${linkId}"]`);
  22  |   await wrap.locator('.repeat-row').nth(0).locator('textarea').fill(values[0]);
  23  |   for (let i = 1; i < values.length; i++) {
  24  |     await wrap.locator('[data-testid="repeat-add-btn"]').click();
  25  |     await expect(wrap.locator('.repeat-row')).toHaveCount(i + 1);
  26  |     await wrap.locator('.repeat-row').nth(i).locator('textarea').fill(values[i]);
  27  |   }
  28  | }
  29  | 
  30  | async function fillNumberRows(page, linkId, values) {
  31  |   const wrap = page.locator(`[data-preview-id="${linkId}"]`);
  32  |   await wrap.locator('.repeat-row').nth(0).locator('input[type="number"]').fill(values[0]);
  33  |   for (let i = 1; i < values.length; i++) {
  34  |     await wrap.locator('[data-testid="repeat-add-btn"]').click();
  35  |     await expect(wrap.locator('.repeat-row')).toHaveCount(i + 1);
  36  |     await wrap.locator('.repeat-row').nth(i).locator('input[type="number"]').fill(values[i]);
  37  |   }
  38  | }
  39  | 
  40  | async function fillDateRows(page, linkId, values) {
  41  |   const wrap = page.locator(`[data-preview-id="${linkId}"]`);
  42  |   await wrap.locator('.repeat-row').nth(0).locator('[data-testid="date-input"]').evaluate((el, v) => el._dpSetValue(v), values[0]);
  43  |   for (let i = 1; i < values.length; i++) {
  44  |     await wrap.locator('[data-testid="repeat-add-btn"]').click();
  45  |     await expect(wrap.locator('.repeat-row')).toHaveCount(i + 1);
  46  |     await wrap.locator('.repeat-row').nth(i).locator('[data-testid="date-input"]').evaluate((el, v) => el._dpSetValue(v), values[i]);
  47  |   }
  48  | }
  49  | 
  50  | async function fillSelectRows(page, linkId, values) {
  51  |   const wrap = page.locator(`[data-preview-id="${linkId}"]`);
  52  |   // Row 0: click trigger (the only sc-trigger at this point), pick option
  53  |   await wrap.locator('.sc-trigger').nth(0).click();
  54  |   await page.locator('.oc-opt').filter({ hasText: values[0] }).first().click();
  55  |   for (let i = 1; i < values.length; i++) {
  56  |     await wrap.locator('[data-testid="repeat-add-btn"]').click();
  57  |     await expect(wrap.locator('.repeat-row')).toHaveCount(i + 1);
  58  |     await wrap.locator('.sc-trigger').nth(i).click();
  59  |     await page.locator('.oc-opt').filter({ hasText: values[i] }).first().click();
  60  |   }
  61  | }
  62  | 
  63  | // ─────────────────────────────────────────────────────────────────────────────
  64  | 
  65  | test('QR repeat round-trip: fill 3 rows per field, export, reload, import, verify', async ({ page }) => {
  66  |   // ── Setup ──
  67  |   await page.addInitScript(() => localStorage.clear());
  68  |   await page.goto('/');
  69  |   await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  70  | 
  71  |   // ── 1. Load fixture ──
  72  |   await loadFixture(page);
  73  | 
  74  |   // Verify all 4 items are repeatable (add button visible)
  75  |   await expect(page.locator('[data-preview-id="text-item"]   [data-testid="repeat-add-btn"]')).toBeVisible();
  76  |   await expect(page.locator('[data-preview-id="number-item"] [data-testid="repeat-add-btn"]')).toBeVisible();
  77  |   await expect(page.locator('[data-preview-id="date-item"]   [data-testid="repeat-add-btn"]')).toBeVisible();
  78  |   await expect(page.locator('[data-preview-id="select-item"] [data-testid="repeat-add-btn"]')).toBeVisible();
  79  | 
  80  |   // ── 2. Fill 3 rows per field ──
  81  |   await fillTextRows(page,   'text-item',   ['Hello', 'World', 'Foo']);
  82  |   await fillNumberRows(page, 'number-item', ['10', '20', '30']);
  83  |   await fillDateRows(page,   'date-item',   ['2024-01-01', '2024-02-15', '2024-03-31']);
  84  |   await fillSelectRows(page, 'select-item', ['Option A', 'Option B', 'Option C']);
  85  | 
  86  |   // ── 3. Export QR ──
  87  |   page.once('dialog', d => d.accept());
  88  |   await page.getByTestId('export-btn').click();
  89  |   const [download] = await Promise.all([
> 90  |     page.waitForEvent('download'),
      |          ^ Error: page.waitForEvent: Test timeout of 30000ms exceeded.
  91  |     page.getByTestId('export-qr-item').click(),
  92  |   ]);
  93  |   const qrPath = await download.path();
  94  |   expect(qrPath).toBeTruthy();
  95  | 
  96  |   // ── 4. Reload page to clear state ──
  97  |   await page.addInitScript(() => localStorage.clear());
  98  |   await page.reload();
  99  |   await page.waitForSelector('[data-testid="add-root-group-btn"]', { timeout: 10_000 });
  100 | 
  101 |   // ── 5. Re-load fixture ──
  102 |   await loadFixture(page);
  103 | 
  104 |   // All rows should start at 1 (only row 0, no extras)
  105 |   await expect(page.locator('[data-preview-id="text-item"] .repeat-row')).toHaveCount(1);
  106 | 
  107 |   // ── 6. Import QR ──
  108 |   await page.locator('#qrFileInput').setInputFiles(qrPath);
  109 | 
  110 |   // Wait for re-render: text-item should now show 3 rows
  111 |   await expect(page.locator('[data-preview-id="text-item"] .repeat-row')).toHaveCount(3, { timeout: 8_000 });
  112 | 
  113 |   // ── 7. Verify text-item ──
  114 |   await expect(page.locator('[data-preview-id="text-item"] .repeat-row').nth(0).locator('textarea')).toHaveValue('Hello');
  115 |   await expect(page.locator('[data-preview-id="text-item"] .repeat-row').nth(1).locator('textarea')).toHaveValue('World');
  116 |   await expect(page.locator('[data-preview-id="text-item"] .repeat-row').nth(2).locator('textarea')).toHaveValue('Foo');
  117 | 
  118 |   // ── 8. Verify number-item ──
  119 |   await expect(page.locator('[data-preview-id="number-item"] .repeat-row')).toHaveCount(3);
  120 |   await expect(page.locator('[data-preview-id="number-item"] .repeat-row').nth(0).locator('input[type="number"]')).toHaveValue('10');
  121 |   await expect(page.locator('[data-preview-id="number-item"] .repeat-row').nth(1).locator('input[type="number"]')).toHaveValue('20');
  122 |   await expect(page.locator('[data-preview-id="number-item"] .repeat-row').nth(2).locator('input[type="number"]')).toHaveValue('30');
  123 | 
  124 |   // ── 9. Verify date-item ──
  125 |   await expect(page.locator('[data-preview-id="date-item"] .repeat-row')).toHaveCount(3);
  126 |   await expect(page.locator('[data-preview-id="date-item"] .repeat-row').nth(0).locator('[data-testid="date-input"]')).toHaveAttribute('data-value', '2024-01-01');
  127 |   await expect(page.locator('[data-preview-id="date-item"] .repeat-row').nth(1).locator('[data-testid="date-input"]')).toHaveAttribute('data-value', '2024-02-15');
  128 |   await expect(page.locator('[data-preview-id="date-item"] .repeat-row').nth(2).locator('[data-testid="date-input"]')).toHaveAttribute('data-value', '2024-03-31');
  129 | 
  130 |   // ── 10. Verify select-item ──
  131 |   await expect(page.locator('[data-preview-id="select-item"] .repeat-row')).toHaveCount(3);
  132 |   await expect(page.locator('[data-preview-id="select-item"] .repeat-row').nth(0).locator('.sc-trigger-text')).toHaveText('Option A');
  133 |   await expect(page.locator('[data-preview-id="select-item"] .repeat-row').nth(1).locator('.sc-trigger-text')).toHaveText('Option B');
  134 |   await expect(page.locator('[data-preview-id="select-item"] .repeat-row').nth(2).locator('.sc-trigger-text')).toHaveText('Option C');
  135 | });
  136 | 
```