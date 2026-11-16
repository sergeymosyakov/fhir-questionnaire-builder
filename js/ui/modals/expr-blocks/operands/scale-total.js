// Operand "Scale total (when all answered)": the total score of a scale — the sum of the scores of the chosen
// answers, but only once every one of the questions is answered (otherwise no result). It is the form every
// shipped scale uses: iif(count = N, sum, {}). Read only when an expression has exactly that shape; anything else
// stays an ordinary conditional, so applying never changes what a calculation computes.
import { registerOperand } from './registry.js';
import { OperandKind } from './operand-kind.js';
import { createQuestionList } from '../question-list.js';
import { codedItems, entriesForLinkIds, pickedLinkIds } from '../scores.js';
import { iif, empty, answerScores, IIF, EMPTY, ANSWER_SCORES, ORDINAL_VALUE_URL } from '../../../../fhir/expr-builder/blocks/index.js';
import { aggregate, compare, literal, BlockKind } from '../../../../fhir/expr-builder/model.js';

const sameIds = (a, b) => a.length === b.length && a.every((id, i) => id === b[i]);
const scoresOf = (b, fn) => (b?.kind === BlockKind.AGGREGATE && b.fn === fn && !b.filter && b.source?.kind === ANSWER_SCORES ? b.source : null);

export class ScaleTotalOperand extends OperandKind {
  static id = 'scale-total';
  static label = 'Scale total (when all answered)';
  static available(ctx) { return codedItems(ctx.allItems).length > 0; }

  // iif(<scores>.count() = N, <scores>.sum(), {}) over the same questions, N being how many there are.
  static fromBlock(block, ctx) {
    if (block.kind !== IIF || block.otherwise?.kind !== EMPTY) return null;
    const test = block.condition;
    if (test?.kind !== BlockKind.COMPARE || test.op !== '=' || test.right?.kind !== BlockKind.LITERAL || test.right.dataType !== 'number') return null;
    const counted = scoresOf(test.left, 'count');
    const summed = scoresOf(block.then, 'sum');
    if (!counted || !summed || counted.url !== summed.url || !sameIds(counted.linkIds, summed.linkIds)) return null;
    if (test.right.value !== counted.linkIds.length) return null;
    const entries = entriesForLinkIds(ctx.allItems, counted.linkIds);
    return entries ? new ScaleTotalOperand(ctx, { entries, url: counted.url }) : null;
  }

  constructor(ctx, parts = {}) {
    super(ctx);
    this.entries = parts.entries ?? [{ item: null }, { item: null }];
    this.url = parts.url ?? ORDINAL_VALUE_URL;
  }

  toBlock() {
    const ids = pickedLinkIds(this.entries);
    if (!ids) return null;
    const scores = answerScores(ids, this.url);
    return iif(compare('=', aggregate('count', scores), literal('number', ids.length)), aggregate('sum', scores), empty());
  }

  render(host) {
    const lead = document.createElement('span');
    lead.className = 'eb-leaf-tail';
    lead.textContent = 'Total score of';
    const note = document.createElement('span');
    note.className = 'eb-novalue';
    note.dataset.testid = 'eb-scale-total-note';
    note.textContent = 'no result until every one is answered';
    host.append(lead, createQuestionList({
      entries: this.entries,
      items: codedItems(this.ctx.allItems),
      blank: () => ({ item: null }),
      notify: this.ctx.onChange,
      labels: { group: 'Questions of the scale' },
      testids: { item: 'eb-scale-item', add: 'eb-scale-add', remove: 'eb-scale-remove' },
      onPick: (entry, item) => { entry.item = item; },
    }), note);
  }
}

registerOperand(ScaleTotalOperand);
