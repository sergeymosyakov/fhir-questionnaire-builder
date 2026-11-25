// Builder drag-and-drop: a node cannot be dropped next to or into its own descendant.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const handlers = {};
const fakeEl = () => ({ dataset: {}, classList: { add() {}, remove() {}, contains: () => false }, contains: () => false, addEventListener: (t, fn) => { handlers.last = { ...handlers.last, [t]: fn }; } });
globalThis.document = { addEventListener() {}, removeEventListener() {}, createElement: fakeEl, querySelector: () => null, querySelectorAll: () => [], dispatchEvent: vi.fn(), body: { classList: { add() {}, remove() {} } } };
globalThis.CSS = { escape: (s) => s };
vi.stubGlobal('setTimeout', (fn) => fn());

const { init, makeDragHandle, attachDropZone } = await import('../js/builder/dnd.js');

const node = (id, children = []) => ({ id, type: children.length ? 'group' : 'item', children });
let tree;
const drag = (id) => {
  makeDragHandle({ id });
  handlers.last.dragstart({ dataTransfer: { setData() {}, effectAllowed: '' } });
};
const dropOn = (id, position) => {
  attachDropZone(fakeEl(), { id }, position);
  handlers.last.drop({ preventDefault() {}, stopPropagation() {} });
};

beforeEach(() => {
  tree = [node('g', [node('a'), node('b')]), node('z')];
  init(() => {}, tree);
});

describe('drop onto a descendant', () => {
  it.each(['before', 'after', 'inside', 'inside-last'])('is ignored for %s', (position) => {
    drag('g');
    dropOn('a', position);
    expect(tree.map((n) => n.id)).toEqual(['g', 'z']);
    expect(tree[0].children.map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('still moves a node next to an unrelated one', () => {
    drag('z');
    dropOn('a', 'before');
    expect(tree[0].children.map((n) => n.id)).toEqual(['z', 'a', 'b']);
  });
});
