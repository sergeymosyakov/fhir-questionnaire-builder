// A growing list of question pickers with remove (✕) and add (+) controls, shared by the editors that work on a
// set of questions ("any of several questions has an answer", "the scores of these questions").
import { createQuestionSelect } from './question-select.js';

/** The questions this entry may pick: every question not already picked by another entry (a question twice is meaningless). */
export const availableFor = (entries, entry, items) => items.filter((it) => it.id === entry.item?.id || !entries.some((e) => e !== entry && e.item?.id === it.id));

/**
 * @param {{ entries: object[], items: object[], blank(): object, onPick(entry, item|null), notify(), min?: number,
 *           testids: { item, add, remove }, labels?: { group, remove, add } }} opts
 *   `entries` is edited in place; each entry has an `item` (the chosen question or null).
 */
export function createQuestionList({ entries, items, blank, onPick, notify, min = 1, testids, labels = {} }) {
  const text = { group: 'Questions', remove: 'Remove question', add: 'Add a question', ...labels };
  const box = document.createElement('span');
  box.className = 'eb-qlist';
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', text.group);

  // `focus`: where keyboard focus goes after a redraw — { select: index } or 'add' — so it is not lost with the old controls.
  const draw = (focus) => {
    box.innerHTML = '';
    const selects = [];
    entries.forEach((entry, i) => {
      const select = createQuestionSelect({
        items: availableFor(entries, entry, items),
        value: entry.item?.id,
        testid: testids.item,
        onChange: (id) => { onPick(entry, items.find((it) => it.id === id) || null); draw({ select: i }); notify(); },
      });
      selects.push(select.el);
      box.appendChild(select.el);
      if (entries.length > min) {
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'eb-rm';
        rm.textContent = '\u2715';
        rm.dataset.testid = testids.remove;
        rm.setAttribute('aria-label', `${text.remove} ${i + 1}`);
        rm.addEventListener('click', () => { entries.splice(i, 1); draw('add'); notify(); });
        box.appendChild(rm);
      }
    });
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'eb-add eb-add--sm';
    add.textContent = '+';
    add.dataset.testid = testids.add;
    add.setAttribute('aria-label', text.add);
    add.addEventListener('click', () => { entries.push(blank()); draw({ select: entries.length - 1 }); notify(); });
    box.appendChild(add);
    if (focus === 'add') add.focus();
    else if (focus && selects[focus.select]) selects[focus.select].focus();
  };

  draw();
  return box;
}
