# Generate a documentation report

**Save ▾ → 📖 Generate Docs…** turns the questionnaire you're building into a
human-readable report — structure, visibility logic, expressions, and a
validation/audit summary — that you can hand to a non-technical stakeholder or
QA reviewer without asking them to open the builder.

## Opening it

Open **Save ▾ → Generate Docs…**. The report opens in a new browser tab
(`questionnaire-docs.html`) built entirely from the questionnaire currently
loaded — nothing is sent to a server.

## What's in the report

1. **Legend** — every icon/badge used below, explained once.
2. **Metadata** — title, URL, version, status, publisher, description.
3. **Variables** — questionnaire-level SDC `%variable` declarations, as
   formatted JSON.
4. **Contained Resources** — every `Questionnaire.contained[]` resource (e.g. a
   `ValueSet` referenced locally), as formatted JSON.
5. **Structure** — every group/question as a connector-line tree, each row
   showing its linkId, `prefix` (if any), item type, and `min..max`
   cardinality as colored tags, plus:
   - **Visibility** (`enableWhen` / `enableWhenExpression`), **Calculated**, and
     **Initial value** expressions, described in plain English above the raw
     FHIRPath (falls back to code-only when an expression can't be described).
   - **Answer options** — a static list, or wherever they come from instead: a
     `ValueSet` (named and linked back to Contained Resources when it's a local
     `#`-reference, shown as a bare URL otherwise), or a dynamically computed
     `answerExpression` / `candidateExpression`.
   - **Constraints**, translated **language versions** (🌐), custom
     **Appearance** (🎨) notes, and any other SDC properties the item carries
     (short text, entry format, column layout, codes, etc.).
6. **Validation & Audit** — the same checks as the builder's own Validate and
   Audit tools.

## Printing and downloading

- **🖨️ Print / Save as PDF** — opens the browser print dialog; screen-only
  chrome (buttons, table of contents links) is hidden via `@media print`.
- **⬇ Download as Text** — saves the same content as a plain `.txt` file, using
  the same tree layout as the on-screen report.

## How it's built

The report is generated once, client-side, from the loaded questionnaire and
answer state at the moment you click **Generate Docs…** — reopen the menu item
after making changes to get an up-to-date report.

---

Next: [Translate a questionnaire](translate.md).
