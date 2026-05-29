// ── Render coordination bus ───────────────────────────────────────────────────
// _formTick — increment to trigger a preview re-render (effect() subscription).
// Incremented only by PreviewForm itself in response to named AppEvents.
import { ref } from './state.js';

export const _formTick = ref(0);
