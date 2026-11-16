// The calculation part of the "calculated value" condition leaves: a short formula with an "edit" link that opens
// the full chain editor (open by default for a leaf that is still empty).
import { formulaText } from '../../../../fhir/expr-builder/formula-text.js';

const link = (label, testid, ariaLabel, onClick) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.setAttribute('aria-label', ariaLabel);
  b.className = 'eb-leaf-link';
  b.dataset.testid = testid;
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
};

/** @param leaf { chain, items, open } — `open` is kept on the leaf so the view survives a redraw */
export function renderCalc(host, leaf, { rerender }) {
  const view = document.createElement('span');
  view.className = 'eb-calc';
  if (leaf.open) {
    view.append(leaf.chain.el, link('done', 'eb-calc-done', 'Done editing the calculation', () => { leaf.open = false; rerender(); }));
  } else {
    const block = leaf.chain.getBlock();
    const text = document.createElement('span');
    text.className = 'eb-calc-text';
    text.dataset.testid = 'eb-calc-text';
    text.textContent = block ? formulaText(block, (id) => leaf.items.find((it) => it.id === id)?.label ?? id) : '(not complete)';
    view.append(text, link('edit', 'eb-calc-edit', 'Edit the calculation', () => { leaf.open = true; rerender(); }));
  }
  host.appendChild(view);
}
