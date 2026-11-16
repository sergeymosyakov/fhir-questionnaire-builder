// Leaf "at least one of several questions has an answer" (or "none of them has"): (a | b | c).exists().
import { registerLeafKind } from './registry.js';
import { LeafKind } from './leaf-kind.js';
import { createCustomSelect } from '../../../custom-select.js';
import { createQuestionSelect } from '../question-select.js';
import { union, UNION } from '../../../../fhir/expr-builder/blocks/index.js';
import { itemRef, exists, BlockKind } from '../../../../fhir/expr-builder/model.js';
import { findItemBySegments } from '../../../../fhir/expr-builder/flatten-items.js';
import { valueAccessor } from '../../../../fhir/expr-builder/value-paths.js';

const blank = () => ({ item: null, value: '' });

export class AnyAnsweredLeaf extends LeafKind {
  static id = 'any-answered';
  static switchLabel = 'any of several questions';

  // The question already chosen in the row being replaced becomes the first pick.
  static create(items, from) {
    const first = from?.item ? { item: from.item, value: valueAccessor(from.item.itemType) } : blank();
    return new AnyAnsweredLeaf(items, [first, blank()], false);
  }

  static fromBlock(block, items) {
    if (block.kind !== BlockKind.EXISTS || block.target?.kind !== UNION) return null;
    const picks = block.target.operands.map((o) => (o.kind === BlockKind.ITEM_REF ? { item: findItemBySegments(items, o.segments), value: o.value } : null));
    return picks.length > 1 && picks.every((p) => p && p.item) ? new AnyAnsweredLeaf(items, picks, block.negate) : null;
  }

  constructor(items, picks, negate) {
    super(items);
    this.picks = picks;
    this.negate = negate;
    this.backLabel = 'one question';
  }

  firstItem() { return this.picks[0]?.item ?? null; }

  toBlock() {
    if (this.picks.length < 2 || this.picks.some((p) => !p.item)) return null;
    return exists(union(this.picks.map((p) => itemRef(p.item.segments, p.value, p.item.answerAt))), this.negate);
  }

  render(host, { notify, rerender }) {
    const mode = createCustomSelect({
      items: [{ value: 'any', label: 'At least one of' }, { value: 'none', label: 'None of' }],
      value: this.negate ? 'none' : 'any',
      className: 'sc-trigger--sm',
      testid: 'eb-any-mode',
      onChange: (v) => { this.negate = v === 'none'; notify(); },
    });
    host.appendChild(mode.el);
    this.picks.forEach((pick, i) => {
      const sel = createQuestionSelect({
        items: this.items,
        value: pick.item?.id,
        testid: 'eb-any-item',
        onChange: (id) => {
          pick.item = this.items.find((it) => it.id === id) || null;
          pick.value = pick.item ? valueAccessor(pick.item.itemType) : '';
          notify();
        },
      });
      host.appendChild(sel.el);
      if (this.picks.length > 2) {
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'eb-rm';
        rm.textContent = '✕';
        rm.dataset.testid = 'eb-any-remove';
        rm.setAttribute('aria-label', 'Remove question');
        rm.addEventListener('click', () => { this.picks.splice(i, 1); rerender(); notify(); });
        host.appendChild(rm);
      }
    });
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'eb-add eb-add--sm';
    add.textContent = '+';
    add.dataset.testid = 'eb-any-add';
    add.setAttribute('aria-label', 'Add a question');
    add.addEventListener('click', () => { this.picks.push(blank()); rerender(); notify(); });
    const tail = document.createElement('span');
    tail.className = 'eb-leaf-tail';
    tail.textContent = 'has an answer';
    host.append(add, tail);
  }
}

registerLeafKind(AnyAnsweredLeaf);
