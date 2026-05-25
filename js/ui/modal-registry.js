// ── Modal registry ────────────────────────────────────────────────────────────
// Pure registry — zero deps on nodes or builder.
// Each modal file calls MODAL_REGISTRY.set(key, moduleRef) at import time.
// Node classes import only this file, so there's no circular dependency.
//
// Keys:
//   answerType | states | showWhen | constraint | expression
//   initial | appearance | repeatable | codes | note
export const MODAL_REGISTRY = new Map();
