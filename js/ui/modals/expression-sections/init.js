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
      { node: pending.node },
    );
  }

  commit(pending, node) {
    node._initialExpr = pending.initExpr.trim() || undefined;
    node._initialExprLanguage = undefined; // manual edit here is always FHIRPath
  }

  buildPatch(pending, _node) {
    return { _initialExpr: pending.initExpr.trim() || null, _initialExprLanguage: null };
  }
}

EXPR_SECTIONS.push(new InitSection());
