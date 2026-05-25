// ── ID factory ────────────────────────────────────────────────────────────────
// Extracted to break the cycle: state.js ← nodes/base-node.js ← state.js
let _seq = 1;
export const nextId   = () => 'n' + (_seq++);
export const resetSeq = () => { _seq = 1; };
