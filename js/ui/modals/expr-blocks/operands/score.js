// Operand "Sum / count of answer scores": adds up (or counts, averages, …) the scores of the chosen answers of
// several questions, e.g. the sum of a questionnaire's ordinal scores.
import { registerOperand } from './registry.js';
import { OperandKind } from './operand-kind.js';
import { createCustomSelect } from '../../../custom-select.js';
import { createQuestionList } from '../question-list.js';
import { codedItems, entriesForLinkIds, pickedLinkIds } from '../scores.js';
import { answerScores, ANSWER_SCORES, ORDINAL_VALUE_URL } from '../../../../fhir/expr-builder/blocks/index.js';
import { aggregate, BlockKind, AGG_FNS } from '../../../../fhir/expr-builder/model.js';

const FN_LABEL = { sum: 'sum', count: 'count', avg: 'average', min: 'minimum', max: 'maximum' };

export class ScoreOperand extends OperandKind {
  static id = 'scores';
  static label = 'Sum / count of answer scores';
  static available(ctx) { return codedItems(ctx.allItems).length > 0; }

  static fromBlock(block, ctx) {
    if (block.kind !== BlockKind.AGGREGATE || block.source?.kind !== ANSWER_SCORES || block.filter) return null;
    const entries = entriesForLinkIds(ctx.allItems, block.source.linkIds);
    return entries ? new ScoreOperand(ctx, { fn: block.fn, entries, url: block.source.url }) : null;
  }

  constructor(ctx, parts = {}) {
    super(ctx);
    this.fn = parts.fn ?? 'sum';
    this.entries = parts.entries ?? [{ item: null }];
    this.url = parts.url ?? ORDINAL_VALUE_URL;
  }

  toBlock() {
    const ids = pickedLinkIds(this.entries);
    return ids ? aggregate(this.fn, answerScores(ids, this.url)) : null;
  }

  render(host) {
    const fn = createCustomSelect({
      items: AGG_FNS.map((v) => ({ value: v, label: FN_LABEL[v] })),
      value: this.fn,
      className: 'sc-trigger--sm',
      testid: 'eb-scores-fn',
      ariaLabel: 'Function',
      onChange: (v) => { this.fn = v; this.ctx.onChange(); },
    });
    const of = document.createElement('span');
    of.className = 'eb-leaf-tail';
    of.textContent = 'of the scores of';
    host.append(fn.el, of, createQuestionList({
      entries: this.entries,
      items: codedItems(this.ctx.allItems),
      blank: () => ({ item: null }),
      notify: this.ctx.onChange,
      labels: { group: 'Questions to take the scores of' },
      testids: { item: 'eb-scores-item', add: 'eb-scores-add', remove: 'eb-scores-remove' },
      onPick: (entry, item) => { entry.item = item; },
    }));
  }
}

registerOperand(ScoreOperand);
