import { AnswerTypeSection } from '../base-section.js';
import { ANSWER_TYPE_SECTIONS } from '../registry.js';
import { CHOICE_TYPES } from '../data.js';
import { createCustomSelect } from '../../../custom-select.js';

class ColumnCountSection extends AnswerTypeSection {
  isVisible(type) { return CHOICE_TYPES.has(type); }

  build(pending) {
    const section = document.createElement('div');
    section.className = 'at-modal-sub';

    const lbl = document.createElement('div');
    lbl.className        = 'at-modal-sub-lbl at-modal-sub-lbl--tip';
    lbl.textContent      = 'Option columns:';
    lbl.dataset.tipTitle = 'Column Count';
    lbl.dataset.tipBody  = 'Recommends laying out this question\u2019s answer options across the given number of columns (vertical-first fill; direction follows choice-orientation). Per SDC it is a rendering recommendation \u2014 this preview applies it to inline option layouts (radio / check-box). Exported as the sdc-questionnaire-columnCount extension for any choice item. Default is a single column.';
    lbl.dataset.tipFhir  = 'item.extension[sdc-questionnaire-columnCount].valueInteger';
    lbl.dataset.tipSpec  = 'SDC';

    const sel = createCustomSelect({
      items: [
        { value: '',  label: '\u2014 default (1) \u2014' },
        { value: '2', label: '2 columns' },
        { value: '3', label: '3 columns' },
        { value: '4', label: '4 columns' },
        { value: '5', label: '5 columns' },
        { value: '6', label: '6 columns' },
      ],
      value:     pending.draftColumnCount,
      className: 'at-modal-sub-sel sc-trigger--full',
      testid:    'column-count-select',
      onChange:  v => { pending.draftColumnCount = v; },
    });

    section.append(lbl, sel.el);
    return section;
  }

  commit(pending, node, _questDoc, _answerStore) {
    const n = parseInt(pending.draftColumnCount, 10);
    if (CHOICE_TYPES.has(node.itemType) && n > 1) {
      node._columnCount = n;
    } else {
      delete node._columnCount;
    }
  }

  initPending(node) {
    return { draftColumnCount: node._columnCount ? String(node._columnCount) : '' };
  }
}

ANSWER_TYPE_SECTIONS.push(new ColumnCountSection());
