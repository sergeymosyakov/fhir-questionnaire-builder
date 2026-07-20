// ── ID factory ────────────────────────────────────────────────────────────────
// ID utilities — extracted to avoid circular imports.
let _seq = 1;
export const nextId   = () => 'n' + (_seq++);
export const resetSeq = () => { _seq = 1; };

// Monotonic unique-id generator for DOM element ids (e.g. ARIA wiring). Kept
// separate from the node sequence above so it is never reset, guaranteeing
// process-lifetime uniqueness without relying on Math.random().
let _uidSeq = 1;
export const nextUid = (prefix = 'uid') => prefix + '-' + (_uidSeq++);

