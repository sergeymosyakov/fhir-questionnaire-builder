// ── ID factory ────────────────────────────────────────────────────────────────
// ID utilities — extracted to avoid circular imports.
let _seq = 1;
export const nextId   = () => 'n' + (_seq++);
export const resetSeq = () => { _seq = 1; };
