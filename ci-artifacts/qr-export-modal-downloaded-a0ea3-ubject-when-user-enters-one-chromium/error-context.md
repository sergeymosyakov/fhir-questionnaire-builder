# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: qr-export-modal.spec.js >> downloaded JSON has subject when user enters one
- Location: tests/e2e/qr-export-modal.spec.js:128:1

# Error details

```
TypeError: Cannot read properties of null (reading 'toString')
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
            - button "autosave" [ref=e19] [cursor=pointer]
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
        - generic [ref=e34]: ⚗ experimental
        - button "Edit" [ref=e35] [cursor=pointer]
      - generic [ref=e37]:
        - button "Collapse / expand" [expanded] [ref=e38] [cursor=pointer]:
          - img [ref=e39]
        - generic [ref=e41]: Variables
        - button "↺ Re-init" [ref=e42] [cursor=pointer]
        - button "Edit" [ref=e43] [cursor=pointer]
      - generic [ref=e45]:
        - generic [ref=e46]:
          - generic: Drop here
          - generic [ref=e47]:
            - generic [ref=e48]:
              - generic [ref=e50]:
                - generic "Drag to reorder" [ref=e51]: ⠿
                - generic [ref=e52] [cursor=pointer]: "[Item]"
              - generic [ref=e53]:
                - generic [ref=e54]: "id:"
                - textbox "FHIR linkId — editable" [ref=e55]: /44250-9
                - generic [ref=e56]: "prefix:"
                - textbox "Display prefix (e.g. 1.2) — cosmetic only, does not affect logic" [ref=e57]:
                  - /placeholder: prefix
              - generic [ref=e59] [cursor=pointer]: Little interest or pleasure in doing things?
              - generic [ref=e60]:
                - generic [ref=e61] [cursor=pointer]: Answer Type
                - generic [ref=e62] [cursor=pointer]: Required
                - generic [ref=e63] [cursor=pointer]: Show When
                - generic [ref=e64] [cursor=pointer]: Expression
                - generic [ref=e65] [cursor=pointer]: Read-only
                - generic [ref=e66] [cursor=pointer]: Repeatable
                - generic [ref=e67] [cursor=pointer]: Default
                - generic [ref=e68] [cursor=pointer]: Constraint
                - generic [ref=e69] [cursor=pointer]: Appearance
                - generic [ref=e70] [cursor=pointer]: Props
            - button "✕" [ref=e71] [cursor=pointer]
        - generic [ref=e72]:
          - generic: Drop here
          - generic [ref=e73]:
            - generic [ref=e74]:
              - generic [ref=e76]:
                - generic "Drag to reorder" [ref=e77]: ⠿
                - generic [ref=e78] [cursor=pointer]: "[Item]"
              - generic [ref=e79]:
                - generic [ref=e80]: "id:"
                - textbox "FHIR linkId — editable" [ref=e81]: /44255-8
                - generic [ref=e82]: "prefix:"
                - textbox "Display prefix (e.g. 1.2) — cosmetic only, does not affect logic" [ref=e83]:
                  - /placeholder: prefix
              - generic [ref=e85] [cursor=pointer]: Feeling down, depressed, or hopeless?
              - generic [ref=e86]:
                - generic [ref=e87] [cursor=pointer]: Answer Type
                - generic [ref=e88] [cursor=pointer]: Required
                - generic [ref=e89] [cursor=pointer]: Show When
                - generic [ref=e90] [cursor=pointer]: Expression
                - generic [ref=e91] [cursor=pointer]: Read-only
                - generic [ref=e92] [cursor=pointer]: Repeatable
                - generic [ref=e93] [cursor=pointer]: Default
                - generic [ref=e94] [cursor=pointer]: Constraint
                - generic [ref=e95] [cursor=pointer]: Appearance
                - generic [ref=e96] [cursor=pointer]: Props
            - button "✕" [ref=e97] [cursor=pointer]
        - generic [ref=e98]:
          - generic: Drop here
          - generic [ref=e99]:
            - generic [ref=e100]:
              - generic [ref=e102]:
                - generic "Drag to reorder" [ref=e103]: ⠿
                - generic [ref=e104] [cursor=pointer]: "[Item]"
              - generic [ref=e105]:
                - generic [ref=e106]: "id:"
                - textbox "FHIR linkId — editable" [ref=e107]: /44259-0
                - generic [ref=e108]: "prefix:"
                - textbox "Display prefix (e.g. 1.2) — cosmetic only, does not affect logic" [ref=e109]:
                  - /placeholder: prefix
              - generic [ref=e111] [cursor=pointer]: Trouble falling or staying asleep, or sleeping too much in last 2 weeks [Reported.PHQ]
              - generic [ref=e112]:
                - generic [ref=e113] [cursor=pointer]: Answer Type
                - generic [ref=e114] [cursor=pointer]: Required
                - generic [ref=e115] [cursor=pointer]: Show When
                - generic [ref=e116] [cursor=pointer]: Expression
                - generic [ref=e117] [cursor=pointer]: Read-only
                - generic [ref=e118] [cursor=pointer]: Repeatable
                - generic [ref=e119] [cursor=pointer]: Default
                - generic [ref=e120] [cursor=pointer]: Constraint
                - generic [ref=e121] [cursor=pointer]: Appearance
                - generic [ref=e122] [cursor=pointer]: Props
            - button "✕" [ref=e123] [cursor=pointer]
        - generic [ref=e124]:
          - generic: Drop here
          - generic [ref=e125]:
            - generic [ref=e126]:
              - generic [ref=e128]:
                - generic "Drag to reorder" [ref=e129]: ⠿
                - generic [ref=e130] [cursor=pointer]: "[Item]"
              - generic [ref=e131]:
                - generic [ref=e132]: "id:"
                - textbox "FHIR linkId — editable" [ref=e133]: /44254-1
                - generic [ref=e134]: "prefix:"
                - textbox "Display prefix (e.g. 1.2) — cosmetic only, does not affect logic" [ref=e135]:
                  - /placeholder: prefix
              - generic [ref=e137] [cursor=pointer]: Feeling tired or having little energy in last 2 weeks [Reported.PHQ]
              - generic [ref=e138]:
                - generic [ref=e139] [cursor=pointer]: Answer Type
                - generic [ref=e140] [cursor=pointer]: Required
                - generic [ref=e141] [cursor=pointer]: Show When
                - generic [ref=e142] [cursor=pointer]: Expression
                - generic [ref=e143] [cursor=pointer]: Read-only
                - generic [ref=e144] [cursor=pointer]: Repeatable
                - generic [ref=e145] [cursor=pointer]: Default
                - generic [ref=e146] [cursor=pointer]: Constraint
                - generic [ref=e147] [cursor=pointer]: Appearance
                - generic [ref=e148] [cursor=pointer]: Props
            - button "✕" [ref=e149] [cursor=pointer]
        - generic [ref=e150]:
          - generic: Drop here
          - generic [ref=e151]:
            - generic [ref=e152]:
              - generic [ref=e154]:
                - generic "Drag to reorder" [ref=e155]: ⠿
                - generic [ref=e156] [cursor=pointer]: "[Item]"
              - generic [ref=e157]:
                - generic [ref=e158]: "id:"
                - textbox "FHIR linkId — editable" [ref=e159]: /44251-7
                - generic [ref=e160]: "prefix:"
                - textbox "Display prefix (e.g. 1.2) — cosmetic only, does not affect logic" [ref=e161]:
                  - /placeholder: prefix
              - generic [ref=e163] [cursor=pointer]: Poor appetite or overeating in last 2 weeks [Reported.PHQ]
              - generic [ref=e164]:
                - generic [ref=e165] [cursor=pointer]: Answer Type
                - generic [ref=e166] [cursor=pointer]: Required
                - generic [ref=e167] [cursor=pointer]: Show When
                - generic [ref=e168] [cursor=pointer]: Expression
                - generic [ref=e169] [cursor=pointer]: Read-only
                - generic [ref=e170] [cursor=pointer]: Repeatable
                - generic [ref=e171] [cursor=pointer]: Default
                - generic [ref=e172] [cursor=pointer]: Constraint
                - generic [ref=e173] [cursor=pointer]: Appearance
                - generic [ref=e174] [cursor=pointer]: Props
            - button "✕" [ref=e175] [cursor=pointer]
        - generic [ref=e176]:
          - generic: Drop here
          - generic [ref=e177]:
            - generic [ref=e178]:
              - generic [ref=e180]:
                - generic "Drag to reorder" [ref=e181]: ⠿
                - generic [ref=e182] [cursor=pointer]: "[Item]"
              - generic [ref=e183]:
                - generic [ref=e184]: "id:"
                - textbox "FHIR linkId — editable" [ref=e185]: /44258-2
                - generic [ref=e186]: "prefix:"
                - textbox "Display prefix (e.g. 1.2) — cosmetic only, does not affect logic" [ref=e187]:
                  - /placeholder: prefix
              - generic [ref=e189] [cursor=pointer]: Feeling bad about yourself - or that you are a failure or have let yourself or your family down in last 2 weeks [Reported.PHQ]
              - generic [ref=e190]:
                - generic [ref=e191] [cursor=pointer]: Answer Type
                - generic [ref=e192] [cursor=pointer]: Required
                - generic [ref=e193] [cursor=pointer]: Show When
                - generic [ref=e194] [cursor=pointer]: Expression
                - generic [ref=e195] [cursor=pointer]: Read-only
                - generic [ref=e196] [cursor=pointer]: Repeatable
                - generic [ref=e197] [cursor=pointer]: Default
                - generic [ref=e198] [cursor=pointer]: Constraint
                - generic [ref=e199] [cursor=pointer]: Appearance
                - generic [ref=e200] [cursor=pointer]: Props
            - button "✕" [ref=e201] [cursor=pointer]
        - generic [ref=e202]:
          - generic: Drop here
          - generic [ref=e203]:
            - generic [ref=e204]:
              - generic [ref=e206]:
                - generic "Drag to reorder" [ref=e207]: ⠿
                - generic [ref=e208] [cursor=pointer]: "[Item]"
              - generic [ref=e209]:
                - generic [ref=e210]: "id:"
                - textbox "FHIR linkId — editable" [ref=e211]: /44252-5
                - generic [ref=e212]: "prefix:"
                - textbox "Display prefix (e.g. 1.2) — cosmetic only, does not affect logic" [ref=e213]:
                  - /placeholder: prefix
              - generic [ref=e215] [cursor=pointer]: Trouble concentrating on things, such as reading the newspaper or watching television in last 2 weeks [Reported.PHQ]
              - generic [ref=e216]:
                - generic [ref=e217] [cursor=pointer]: Answer Type
                - generic [ref=e218] [cursor=pointer]: Required
                - generic [ref=e219] [cursor=pointer]: Show When
                - generic [ref=e220] [cursor=pointer]: Expression
                - generic [ref=e221] [cursor=pointer]: Read-only
                - generic [ref=e222] [cursor=pointer]: Repeatable
                - generic [ref=e223] [cursor=pointer]: Default
                - generic [ref=e224] [cursor=pointer]: Constraint
                - generic [ref=e225] [cursor=pointer]: Appearance
                - generic [ref=e226] [cursor=pointer]: Props
            - button "✕" [ref=e227] [cursor=pointer]
        - generic [ref=e228]:
          - generic: Drop here
          - generic [ref=e229]:
            - generic [ref=e230]:
              - generic [ref=e232]:
                - generic "Drag to reorder" [ref=e233]: ⠿
                - generic [ref=e234] [cursor=pointer]: "[Item]"
              - generic [ref=e235]:
                - generic [ref=e236]: "id:"
                - textbox "FHIR linkId — editable" [ref=e237]: /44253-3
                - generic [ref=e238]: "prefix:"
                - textbox "Display prefix (e.g. 1.2) — cosmetic only, does not affect logic" [ref=e239]:
                  - /placeholder: prefix
              - generic [ref=e241] [cursor=pointer]: Moving or speaking so slowly that other people could have noticed. Or the opposite - being so fidgety or restless that you have been moving around a lot more than usual in last 2 weeks [Reported.PHQ]
              - generic [ref=e242]:
                - generic [ref=e243] [cursor=pointer]: Answer Type
                - generic [ref=e244] [cursor=pointer]: Required
                - generic [ref=e245] [cursor=pointer]: Show When
                - generic [ref=e246] [cursor=pointer]: Expression
                - generic [ref=e247] [cursor=pointer]: Read-only
                - generic [ref=e248] [cursor=pointer]: Repeatable
                - generic [ref=e249] [cursor=pointer]: Default
                - generic [ref=e250] [cursor=pointer]: Constraint
                - generic [ref=e251] [cursor=pointer]: Appearance
                - generic [ref=e252] [cursor=pointer]: Props
            - button "✕" [ref=e253] [cursor=pointer]
        - generic [ref=e254]:
          - generic: Drop here
          - generic [ref=e255]:
            - generic [ref=e256]:
              - generic [ref=e258]:
                - generic "Drag to reorder" [ref=e259]: ⠿
                - generic [ref=e260] [cursor=pointer]: "[Item]"
              - generic [ref=e261]:
                - generic [ref=e262]: "id:"
                - textbox "FHIR linkId — editable" [ref=e263]: /44260-8
                - generic [ref=e264]: "prefix:"
                - textbox "Display prefix (e.g. 1.2) — cosmetic only, does not affect logic" [ref=e265]:
                  - /placeholder: prefix
              - generic [ref=e267] [cursor=pointer]: Thoughts that you would be better off dead, or of hurting yourself in some way in last 2 weeks [Reported.PHQ]
              - generic [ref=e268]:
                - generic [ref=e269] [cursor=pointer]: Answer Type
                - generic [ref=e270] [cursor=pointer]: Required
                - generic [ref=e271] [cursor=pointer]: Show When
                - generic [ref=e272] [cursor=pointer]: Expression
                - generic [ref=e273] [cursor=pointer]: Read-only
                - generic [ref=e274] [cursor=pointer]: Repeatable
                - generic [ref=e275] [cursor=pointer]: Default
                - generic [ref=e276] [cursor=pointer]: Constraint
                - generic [ref=e277] [cursor=pointer]: Appearance
                - generic [ref=e278] [cursor=pointer]: Props
            - button "✕" [ref=e279] [cursor=pointer]
        - generic [ref=e280]:
          - generic: Drop here
          - generic [ref=e281]:
            - generic [ref=e282]:
              - generic [ref=e284]:
                - generic "Drag to reorder" [ref=e285]: ⠿
                - generic [ref=e286] [cursor=pointer]: "[Item]"
              - generic [ref=e287]:
                - generic [ref=e288]: "id:"
                - textbox "FHIR linkId — editable" [ref=e289]: /44261-6
                - generic [ref=e290]: "prefix:"
                - textbox "Display prefix (e.g. 1.2) — cosmetic only, does not affect logic" [ref=e291]:
                  - /placeholder: prefix
              - generic [ref=e293] [cursor=pointer]: Patient health questionnaire 9 item total score
              - generic [ref=e294]:
                - generic [ref=e295] [cursor=pointer]: Answer Type
                - generic [ref=e296] [cursor=pointer]: Required
                - generic [ref=e297] [cursor=pointer]: Show When
                - generic [ref=e298] [cursor=pointer]: Expression
                - generic [ref=e299] [cursor=pointer]: Read-only
                - generic [ref=e300] [cursor=pointer]: Repeatable
                - generic [ref=e301] [cursor=pointer]: Default
                - generic [ref=e302] [cursor=pointer]: Constraint
                - generic [ref=e303] [cursor=pointer]: Appearance
                - generic [ref=e304] [cursor=pointer]: Props
            - button "✕" [ref=e305] [cursor=pointer]
        - generic [ref=e306]:
          - generic: Drop here
          - generic [ref=e307]:
            - generic [ref=e308]:
              - generic [ref=e310]:
                - generic "Drag to reorder" [ref=e311]: ⠿
                - generic [ref=e312] [cursor=pointer]: "[Item]"
              - generic [ref=e313]:
                - generic [ref=e314]: "id:"
                - textbox "FHIR linkId — editable" [ref=e315]: /69722-7
                - generic [ref=e316]: "prefix:"
                - textbox "Display prefix (e.g. 1.2) — cosmetic only, does not affect logic" [ref=e317]:
                  - /placeholder: prefix
              - generic [ref=e319] [cursor=pointer]: How difficult have these made it for you to do your work, take care of things at home, or get along with other people [Reported.PHQ]
              - generic [ref=e320]:
                - generic [ref=e321] [cursor=pointer]: Answer Type
                - generic [ref=e322] [cursor=pointer]: Required
                - generic [ref=e323] [cursor=pointer]: Show When
                - generic [ref=e324] [cursor=pointer]: Expression
                - generic [ref=e325] [cursor=pointer]: Read-only
                - generic [ref=e326] [cursor=pointer]: Repeatable
                - generic [ref=e327] [cursor=pointer]: Default
                - generic [ref=e328] [cursor=pointer]: Constraint
                - generic [ref=e329] [cursor=pointer]: Appearance
                - generic [ref=e330] [cursor=pointer]: Props
            - button "✕" [ref=e331] [cursor=pointer]
        - generic: Drop here to move to end
    - generic [ref=e333]:
      - generic [ref=e334]:
        - generic [ref=e335]:
          - generic [ref=e336]:
            - generic [ref=e337]: Questionnaire Preview
            - generic [ref=e338]:
              - generic [ref=e339]: phq-9
              - button "×" [ref=e340] [cursor=pointer]
          - generic [ref=e341]:
            - button "👁 Patient View" [ref=e342] [cursor=pointer]
            - button "Validate" [ref=e343] [cursor=pointer]
            - button "✗ FAIL · 8 issues" [ref=e345] [cursor=pointer]
        - generic [ref=e346]:
          - button "Questionnaires ▾" [ref=e348] [cursor=pointer]
          - button "📥 Answers ▾" [ref=e350] [cursor=pointer]
          - button "⬇ Export ▾" [ref=e352] [cursor=pointer]
          - generic [ref=e353]:
            - searchbox "🔍 Search…" [ref=e354]
            - button "↑" [ref=e355] [cursor=pointer]
            - button "↓" [ref=e356] [cursor=pointer]
          - button "id" [ref=e357] [cursor=pointer]
          - button "prefix" [ref=e358] [cursor=pointer]
          - button "badges" [ref=e359] [cursor=pointer]
          - button [ref=e360] [cursor=pointer]:
            - img [ref=e361]
          - button [ref=e363] [cursor=pointer]:
            - img [ref=e364]
      - generic [ref=e367]:
        - generic [ref=e368]:
          - generic [ref=e369] [cursor=pointer]: ↗
          - generic [ref=e370]: ✘
          - generic [ref=e371] [cursor=pointer]: /44250-9
          - generic [ref=e372]: Little interest or pleasure in doing things?*
          - generic [ref=e375] [cursor=pointer]: — select —
        - generic [ref=e376]:
          - generic [ref=e377] [cursor=pointer]: ↗
          - generic [ref=e378]: ✘
          - generic [ref=e379] [cursor=pointer]: /44255-8
          - generic [ref=e380]: Feeling down, depressed, or hopeless?*
          - generic [ref=e383] [cursor=pointer]: — select —
        - generic [ref=e384]:
          - generic [ref=e385] [cursor=pointer]: ↗
          - generic [ref=e386]: ✘
          - generic [ref=e387] [cursor=pointer]: /44259-0
          - generic [ref=e388]: Trouble falling or staying asleep, or sleeping too much in last 2 weeks [Reported.PHQ]*
          - generic [ref=e391] [cursor=pointer]: — select —
        - generic [ref=e392]:
          - generic [ref=e393] [cursor=pointer]: ↗
          - generic [ref=e394]: ✘
          - generic [ref=e395] [cursor=pointer]: /44254-1
          - generic [ref=e396]: Feeling tired or having little energy in last 2 weeks [Reported.PHQ]*
          - generic [ref=e399] [cursor=pointer]: — select —
        - generic [ref=e400]:
          - generic [ref=e401] [cursor=pointer]: ↗
          - generic [ref=e402]: ✘
          - generic [ref=e403] [cursor=pointer]: /44251-7
          - generic [ref=e404]: Poor appetite or overeating in last 2 weeks [Reported.PHQ]*
          - generic [ref=e407] [cursor=pointer]: — select —
        - generic [ref=e408]:
          - generic [ref=e409] [cursor=pointer]: ↗
          - generic [ref=e410]: ✘
          - generic [ref=e411] [cursor=pointer]: /44258-2
          - generic [ref=e412]: Feeling bad about yourself - or that you are a failure or have let yourself or your family down in last 2 weeks [Reported.PHQ]*
          - generic [ref=e415] [cursor=pointer]: — select —
        - generic [ref=e416]:
          - generic [ref=e417] [cursor=pointer]: ↗
          - generic [ref=e418]: ✘
          - generic [ref=e419] [cursor=pointer]: /44252-5
          - generic [ref=e420]: Trouble concentrating on things, such as reading the newspaper or watching television in last 2 weeks [Reported.PHQ]*
          - generic [ref=e423] [cursor=pointer]: — select —
        - generic [ref=e424]:
          - generic [ref=e425] [cursor=pointer]: ↗
          - generic [ref=e426]: ✘
          - generic [ref=e427] [cursor=pointer]: /44253-3
          - generic [ref=e428]: Moving or speaking so slowly that other people could have noticed. Or the opposite - being so fidgety or restless that you have been moving around a lot more than usual in last 2 weeks [Reported.PHQ]*
          - generic [ref=e431] [cursor=pointer]: — select —
        - generic [ref=e432]:
          - generic [ref=e433] [cursor=pointer]: ↗
          - generic [ref=e434] [cursor=pointer]: /44260-8
          - generic [ref=e435]: Thoughts that you would be better off dead, or of hurting yourself in some way in last 2 weeks [Reported.PHQ]
          - generic [ref=e436]: optional
          - generic [ref=e439] [cursor=pointer]: — select —
        - generic [ref=e440]:
          - generic [ref=e441] [cursor=pointer]: ↗
          - generic [ref=e442] [cursor=pointer]: /44261-6
          - generic [ref=e443]: Patient health questionnaire 9 item total score
          - generic [ref=e444]: optional
          - spinbutton [ref=e446]
        - generic [ref=e447]:
          - generic [ref=e448] [cursor=pointer]: ↗
          - generic [ref=e449] [cursor=pointer]: /69722-7
          - generic [ref=e450]: How difficult have these made it for you to do your work, take care of things at home, or get along with other people [Reported.PHQ]
          - generic [ref=e451]: optional
          - generic [ref=e454] [cursor=pointer]: — select —
```

# Test source

```ts
  36  |   await page.getByTestId('export-qr-item').click();
  37  |   // Wait for modal
  38  |   await expect(page.locator('#qrExportModal')).toBeVisible({ timeout: 5_000 });
  39  | }
  40  | 
  41  | // ── modal opens ───────────────────────────────────────────────────────────────
  42  | 
  43  | test('QR export modal opens when Export→QR clicked', async ({ page }) => {
  44  |   await loadSampleAndOpenExportModal(page);
  45  |   await expect(page.locator('#qrExportModal')).toBeVisible();
  46  | });
  47  | 
  48  | // ── fields present ────────────────────────────────────────────────────────────
  49  | 
  50  | test('modal contains filename, status, subject, author fields', async ({ page }) => {
  51  |   await loadSampleAndOpenExportModal(page);
  52  |   await expect(page.getByTestId('qr-export-filename')).toBeVisible();
  53  |   await expect(page.getByTestId('qr-export-status')).toBeVisible();
  54  |   await expect(page.getByTestId('qr-export-subject')).toBeVisible();
  55  |   await expect(page.getByTestId('qr-export-author')).toBeVisible();
  56  | });
  57  | 
  58  | // ── default values ─────────────────────────────────────────────────────────────
  59  | 
  60  | test('status defaults to in-progress', async ({ page }) => {
  61  |   await loadSampleAndOpenExportModal(page);
  62  |   await expect(page.getByTestId('qr-export-status')).toHaveValue('in-progress');
  63  | });
  64  | 
  65  | test('filename is pre-filled with questionnaire name', async ({ page }) => {
  66  |   await loadSampleAndOpenExportModal(page);
  67  |   const val = await page.getByTestId('qr-export-filename').inputValue();
  68  |   expect(val.length).toBeGreaterThan(0);
  69  |   expect(val).toMatch(/-response\.json$/);
  70  | });
  71  | 
  72  | // ── user edits fields ─────────────────────────────────────────────────────────
  73  | 
  74  | test('user can change status to completed', async ({ page }) => {
  75  |   await loadSampleAndOpenExportModal(page);
  76  |   await page.getByTestId('qr-export-status').selectOption('completed');
  77  |   await expect(page.getByTestId('qr-export-status')).toHaveValue('completed');
  78  | });
  79  | 
  80  | test('user can enter subject and author references', async ({ page }) => {
  81  |   await loadSampleAndOpenExportModal(page);
  82  |   await page.getByTestId('qr-export-subject').fill('Patient/42');
  83  |   await page.getByTestId('qr-export-author').fill('Practitioner/7');
  84  |   await expect(page.getByTestId('qr-export-subject')).toHaveValue('Patient/42');
  85  |   await expect(page.getByTestId('qr-export-author')).toHaveValue('Practitioner/7');
  86  | });
  87  | 
  88  | // ── cancel ────────────────────────────────────────────────────────────────────
  89  | 
  90  | test('Cancel closes the modal without downloading', async ({ page }) => {
  91  |   await loadSampleAndOpenExportModal(page);
  92  |   const downloads = [];
  93  |   page.on('download', d => downloads.push(d));
  94  |   await page.locator('#qrExportModalCancel').click();
  95  |   await expect(page.locator('#qrExportModal')).toBeHidden();
  96  |   expect(downloads).toHaveLength(0);
  97  | });
  98  | 
  99  | test('Escape key closes the modal', async ({ page }) => {
  100 |   await loadSampleAndOpenExportModal(page);
  101 |   await page.keyboard.press('Escape');
  102 |   await expect(page.locator('#qrExportModal')).toBeHidden();
  103 | });
  104 | 
  105 | // ── export triggers download ──────────────────────────────────────────────────
  106 | 
  107 | test('Export button triggers JSON download', async ({ page }) => {
  108 |   await loadSampleAndOpenExportModal(page);
  109 |   const [download] = await Promise.all([
  110 |     page.waitForEvent('download'),
  111 |     page.getByTestId('qr-export-apply').click(),
  112 |   ]);
  113 |   expect(download.suggestedFilename()).toMatch(/\.json$/);
  114 | });
  115 | 
  116 | test('downloaded JSON has the user-specified status', async ({ page }) => {
  117 |   await loadSampleAndOpenExportModal(page);
  118 |   await page.getByTestId('qr-export-status').selectOption('completed');
  119 |   const [download] = await Promise.all([
  120 |     page.waitForEvent('download'),
  121 |     page.getByTestId('qr-export-apply').click(),
  122 |   ]);
  123 |   const text = await (await download.createReadStream()).read();
  124 |   const qr = JSON.parse(text.toString());
  125 |   expect(qr.status).toBe('completed');
  126 | });
  127 | 
  128 | test('downloaded JSON has subject when user enters one', async ({ page }) => {
  129 |   await loadSampleAndOpenExportModal(page);
  130 |   await page.getByTestId('qr-export-subject').fill('Patient/99');
  131 |   const [download] = await Promise.all([
  132 |     page.waitForEvent('download'),
  133 |     page.getByTestId('qr-export-apply').click(),
  134 |   ]);
  135 |   const text = await (await download.createReadStream()).read();
> 136 |   const qr = JSON.parse(text.toString());
      |                              ^ TypeError: Cannot read properties of null (reading 'toString')
  137 |   expect(qr.subject?.reference).toBe('Patient/99');
  138 | });
  139 | 
  140 | test('downloaded JSON has no subject when field is empty', async ({ page }) => {
  141 |   await loadSampleAndOpenExportModal(page);
  142 |   await page.getByTestId('qr-export-subject').fill('');
  143 |   const [download] = await Promise.all([
  144 |     page.waitForEvent('download'),
  145 |     page.getByTestId('qr-export-apply').click(),
  146 |   ]);
  147 |   const text = await (await download.createReadStream()).read();
  148 |   const qr = JSON.parse(text.toString());
  149 |   expect(qr.subject).toBeUndefined();
  150 | });
  151 | 
```