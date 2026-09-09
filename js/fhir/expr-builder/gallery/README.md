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
- Verify any non-trivial FHIRPath (date math, `.power()`, etc.) against the real
  vendored `fhirpath` package directly (`node -e "require('fhirpath')..."`)
  before committing it — don't guess syntax, see `age-from-birthdate.js` for why.
- If a pattern needs a variable number of slots (e.g. a threshold-category
  bucket, or summing N items) it doesn't fit this fixed-slot shape yet — that's
  a separate UI mode, not implemented here (see issue #122).
