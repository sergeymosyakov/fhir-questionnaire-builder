// Evaluates a FHIRPath expression against the live preview context ({ fp, qr, envVars }).
// Pure, no DOM. Shared by the FHIRPath tester and the expression builder.
import { fhirModel } from '../fhir/fhir-model.js';

export function evalFhirpath(ctx, expr) {
  const trimmed = (expr || '').trim();
  if (!trimmed) return { status: 'empty' };
  if (!ctx || !ctx.fp || !ctx.qr) return { status: 'not-ready' };
  try {
    const res = ctx.fp.evaluate(ctx.qr, trimmed, { resource: ctx.qr, ...(ctx.envVars || {}) }, fhirModel());
    return { status: 'ok', result: res, count: Array.isArray(res) ? res.length : null };
  } catch (e) {
    return { status: 'error', error: e?.message ? e.message : String(e) };
  }
}
