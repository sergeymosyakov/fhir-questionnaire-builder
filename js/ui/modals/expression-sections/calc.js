import { ExpressionSection } from './base-section.js';
import { EXPR_SECTIONS } from './registry.js';
import { makeSectionBlock } from './helpers.js';

class CalcSection extends ExpressionSection {
  initPending(node) {
    return { calcExpr: node._calculatedExpr || '' };
  }

  build(pending) {
    return makeSectionBlock(
      'Calculated Expression',
      'sdc-questionnaire-calculatedExpression',
      'Evaluated automatically on every preview render. Result is written into the answer field.',
      pending.calcExpr,
      'expr-calc-ta',
      "%resource.item.where(linkId='...')",
      val => { pending.calcExpr = val; },
    );
  }

  commit(pending, node) {
    node._calculatedExpr = pending.calcExpr.trim() || undefined;
  }

  buildPatch(pending, _node) {
    return { _calculatedExpr: pending.calcExpr.trim() || null };
  }
}

EXPR_SECTIONS.push(new CalcSection());
