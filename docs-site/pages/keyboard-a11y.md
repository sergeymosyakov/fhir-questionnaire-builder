# Keyboard & accessibility

The builder is designed to be usable with a keyboard and with assistive
technology. This page summarises the accessibility support that is built in.

## Keyboard navigation

You can move through the interface with the keyboard:

- Interactive controls are reachable with **Tab** / **Shift+Tab** and show a
  visible focus outline.
- The custom drop-downs behave like native comboboxes — open with Enter/Space,
  move with the arrow keys, choose with Enter, and dismiss with **Escape**.
- Choice options (radio buttons and check-boxes) are operable with the keyboard.
- The per-item action controls (States, Show When, Expression, …) can be
  activated from the keyboard, not just the mouse.

## Dialogs

Modal dialogs manage focus properly:

- Focus is **trapped** inside an open dialog so Tab doesn't wander behind it.
- **Escape** closes the dialog.
- Focus returns to a sensible place when the dialog closes.

## Undo, redo & search

- **Ctrl+Z** (or **Cmd+Z**) — undo the last change; **Ctrl+Y** or **Ctrl+Shift+Z**
  (**Cmd+Shift+Z** on Mac) — redo. The same **Undo** / **Redo** buttons are
  always visible in the toolbar and disable themselves when there's nothing to
  undo/redo. History covers both structural edits (add/delete/move/rename) and
  answer changes in the preview, up to 50 steps back.
- **Ctrl+F** (or **Cmd+F**) — jump to the preview's search box (searches the
  visible form text, or the FHIR JSON when that view is active) instead of the
  browser's own page search.

## Screen-reader support

The interface exposes semantic roles and labels so assistive technology can make
sense of it:

- Menus, comboboxes and the builder tree carry appropriate ARIA roles and labels.
- Validation errors are announced (they use an alert role), and the form-status
  indicator updates through a live region, so a screen-reader user hears when the
  response becomes valid or invalid.

## Honest scope

Accessibility is an ongoing effort rather than a certified conformance claim. The
features above cover keyboard operation, focus management, and the main
screen-reader affordances; if you hit an accessibility gap, it is a bug worth
reporting.

---

Next: [Settings](settings.md).
