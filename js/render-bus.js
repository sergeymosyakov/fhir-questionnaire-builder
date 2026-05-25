// ── Render coordination bus ───────────────────────────────────────────────────
// Reactive primitives used to coordinate between the builder/controls and the
// preview renderer. Kept separate from state.js (domain data) intentionally.
//
// _formTick   — increment to trigger a preview re-render (effect() subscription)
// _bulkUpdate — set true before mass tree mutations to suppress intermediate renders;
//               reset to false when done (effect re-runs once on reset)
import { ref } from './state.js';

export const _formTick   = ref(0);
export const _bulkUpdate = ref(false);
