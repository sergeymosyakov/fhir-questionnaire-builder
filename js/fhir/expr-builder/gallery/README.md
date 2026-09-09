# Expression Gallery patterns

Named FHIRPath calculation templates for the Expression Builder's "📐 Choose
from gallery" entry point (issue #122). Each pattern lets an author pick which
questionnaire item fills each placeholder, optionally applying a unit/rounding
transform, before the result is dropped into the Expression Builder as a real,
still-editable FHIRPath string.

## Adding a new pattern

1. Create a new file in this folder, one pattern per file (e.g. `bsa.js`).
2. Export a single pattern object (see shape below).
3. Import it in `index.js` and add it to the `EXPR_GALLERY` array.

Never edit an existing pattern's file to add a different pattern — new pattern
= new file, so the library grows without touching unrelated code.

## Pattern shape

```js
export const myPattern = {
  id: 'my-pattern',            // unique, kebab-case, used as data-testid suffix
  name: 'Human-readable name', // shown in the gallery list
  description: 'One sentence — shown under the name and in the slot-fill view.',
  itemTypes: ['integer', 'decimal', 'quantity'], // eligible item types for every slot
  slots: [
    {
      key: 'weight',           // matches a %weight% placeholder in template
      label: 'Weight item',    // shown next to the item picker
      transforms: [            // optional; omit/empty array = no transform picker
        { id: 'kg', label: 'Already in kg', template: '%value%' },
        { id: 'lb', label: 'Convert from lb', template: '(%value% * 0.453592)' },
      ],
    },
  ],
  template: '(%weight% ...)', // final FHIRPath, %slotKey% placeholders substituted
};
```

- `transforms[].template` must be fully parenthesized if it does anything besides
  passing `%value%` straight through — `resolveGalleryPattern()` only adds its
  own wrapping parens when the value isn't already wrapped.
- Verify any non-trivial FHIRPath (date math, `.power()`, `iif()` on an empty/
  unanswered condition, etc.) against the real vendored `fhirpath` package
  directly (`node -e "require('fhirpath')..."`) before committing it — don't
  guess syntax, see `age-from-birthdate.js` for why.

## Repeatable slots (sum of N items)

Set `repeatable: true` on a slot to let the author add/remove as many rows as
needed at fill time — each row is its own item + optional transform pick, and
the resolved value is every row's value summed together:

```js
slots: [
  {
    key: 'items',
    label: 'Item to include',
    repeatable: true,
    min: 2,        // minimum filled rows before the pattern resolves (default 1)
    transforms: [/* optional, applies per-row */],
  },
],
template: '%items%', // substituted with (row1 + row2 + ...)
```

See `sum-of-items.js`. A pattern can mix fixed and repeatable slots freely.
A slot can also set its own `itemTypes` to narrow (not extend) the pattern's
default for just that slot — e.g. a numeric age slot alongside boolean
condition rows (see `charlson-comorbidity-index.js`).

## Weighted condition lists (`uniqueTransforms`)

A repeatable slot's `transforms` don't have to be unit conversions — each entry
can represent a distinct, fixed-weight condition instead (label communicates
the weight, template applies it via `iif(%value%, weight, 0)` against a
boolean item). Set `uniqueTransforms: true` so picking a condition in one row
hides it from every other row's dropdown — prevents accidentally double-adding
the same condition, at zero cost to patterns that legitimately reuse the same
transform across rows (e.g. converting several weight items lb\u2192kg):

```js
transforms: [
  { id: 'mi', label: 'Myocardial infarction (+1)', template: 'iif(%value%, 1, 0)' },
  { id: 'aids', label: 'AIDS (+6)', template: 'iif(%value%, 6, 0)' },
  // ...
],
uniqueTransforms: true,
```

See `charlson-comorbidity-index.js`.

## Threshold-category output

Set `pattern.categories` to map the resolved `template` expression to a named
band instead of returning it as a raw number — builds a nested `iif()` chain:

```js
categories: [
  { lessThan: 18.5, label: 'Underweight' }, // applies when template result < 18.5
  { lessThan: 25, label: 'Normal weight' },
  { lessThan: 30, label: 'Overweight' },
  { label: 'Obese' },                       // catch-all — no lessThan, must be last
],
```

`lessThan` is an exclusive upper bound; categorize the *unrounded* value if the
template also has a display rounding step, so a borderline value can't cross a
threshold it wouldn't actually cross once rounded (see `bmi-category.js`).
See also `gad7-severity.js` / `phq9-severity.js` for a sum-then-categorize
pattern, and `cha2ds2-vasc.js` for a fixed-slot weighted sum (`iif(%slot%, weight, 0)`
per criterion) that doesn't need `categories` or `repeatable` at all.

