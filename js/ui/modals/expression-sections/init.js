import { ExpressionSection } from './base-section.js';
import { EXPR_SECTIONS } from './registry.js';
import { makeSectionBlock } from './helpers.js';

class InitSection extends ExpressionSection {
  initPending(node) {
    return { initExpr: node._initialExpr || '' };
  }

  build(pending) {
    return makeSectionBlock(
      'Initial Expression',
      'sdc-questionnaire-initialExpression',
      'Evaluated once on load and after clicking \u21BA Re-init in the Variables panel.',
      pending.initExpr,
      'expr-init-ta',
      'e.g. %age > 18 or %today',
      val => { pending.initExpr = val; },
    );
  }

  commit(pending, node) {
    node._initialExpr = pending.initExpr.trim() || undefined;
  }
}

EXPR_SECTIONS.push(new InitSection());
