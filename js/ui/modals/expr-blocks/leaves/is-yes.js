// Leaf "<yes/no question> is Yes (checked)" written as the bare answer, e.g. iif(%q.answer.valueBoolean, …).
// Recognised when read from an expression; a new leaf of this shape is made with the ordinary "= Yes" row.
import { registerLeafKind } from './registry.js';
import { LeafKind } from './leaf-kind.js';
import { createQuestionSelect } from '../question-select.js';
import { itemRef, BlockKind } from '../../../../fhir/expr-builder/model.js';
import { findItemBySegments } from '../../../../fhir/expr-builder/flatten-items.js';

const isYesNo = (it) => it.itemType === 'checkbox';

export class IsYesLeaf extends LeafKind {
  static id = 'is-yes';

  static fromBlock(block, items) {
    if (block.kind !== BlockKind.ITEM_REF || block.value !== 'valueBoolean') return null;
    const item = findItemBySegments(items, block.segments);
    return item && isYesNo(item) ? new IsYesLeaf(items, item) : null;
  }

  constructor(items, item) {
    super(items);
    this.item = item;
  }

  toBlock() { return this.item ? itemRef(this.item.segments, 'valueBoolean', this.item.answerAt) : null; }

  render(host, { notify }) {
    const sel = createQuestionSelect({
      items: this.items.filter(isYesNo),
      value: this.item?.id,
      testid: 'eb-leaf-item',
      onChange: (id) => { this.item = this.items.find((it) => it.id === id) || null; notify(); },
    });
    const tail = document.createElement('span');
    tail.className = 'eb-leaf-tail';
    tail.textContent = 'is Yes (checked)';
    host.append(sel.el, tail);
  }
}

registerLeafKind(IsYesLeaf);
