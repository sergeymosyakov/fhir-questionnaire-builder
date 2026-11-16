// Measures which calculated expressions of the shipped templates and of the gallery the visual value editor can
// really show as blocks, and whether they calculate the same when written back. Needs a DOM (jsdom).
import { createValueEditor } from '../../js/ui/modals/expr-value/value-editor.js';
import { parseExpression } from '../../js/fhir/expr-builder/parse.js';
import { emit } from '../../js/fhir/expr-builder/emit.js';
import { collectExpressions, collectItems, responsesFor, evaluate, fp } from './expressions.js';

const attempt = (fn) => { try { return fn(); } catch { return null; } };

/** → { total, editable, textOnly, changed (calculates differently written back), inconsistent (seeded but cannot be
 *  written), reshaped (written text differs from the plain parse → emit text; same meaning, different shape) } */
export function measureValueEditor() {
  const exprs = collectExpressions();
  const all = collectItems(exprs);
  const numeric = all.filter((i) => ['integer', 'decimal', 'date', 'dateTime'].includes(i.itemType));
  const editable = [];
  const textOnly = [];
  const changed = [];
  const inconsistent = [];
  const reshaped = [];
  for (const e of exprs) {
    const ve = attempt(() => createValueEditor({ items: numeric, allItems: all, variables: [], fp, initialExpr: e.text }));
    const written = ve?.seeded ? ve.getExpr() : '';
    if (ve?.seeded && !written) inconsistent.push(e.id);
    if (!written) { textOnly.push(e.id); continue; }
    editable.push(e.id);
    const block = parseExpression(e.text, fp);
    if (written !== emit(block)) reshaped.push(e.id);
    for (const qr of responsesFor(e.text, block)) {
      if (evaluate(qr, written) !== evaluate(qr, e.text)) { changed.push(e.id); break; }
    }
  }
  return { total: exprs.length, editable, textOnly, changed, inconsistent, reshaped };
}
