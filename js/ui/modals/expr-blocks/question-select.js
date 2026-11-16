// The question picker shared by every expression-builder editor: a searchable select of answerable questions.
import { createCustomSelect } from '../../custom-select.js';

/** @param {{ items, value?: string, onChange(id), testid, className?, decorate?(item): object }} opts → custom select */
export function createQuestionSelect({ items, value = '', onChange, testid, className = 'sc-trigger--sm eb-item', decorate, ariaLabel = 'Question' }) {
  return createCustomSelect({
    items: [{ value: '', label: '— question —' }, ...items.map((it) => ({ value: it.id, label: it.label, ...(decorate ? decorate(it) : {}) }))],
    value: value || '',
    className,
    testid,
    searchable: true,
    ariaLabel,
    onChange,
  });
}
