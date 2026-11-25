// Each builder card build gives the node a fresh signal and drops the document listeners of the previous card.
import { describe, it, expect } from 'vitest';

globalThis.document = { addEventListener() {}, removeEventListener() {} };
const { cardSignal, dropStaleCards } = await import('../js/builder/builder-helpers.js');

describe('cardSignal', () => {
  it('keeps the old card listeners until its replacement is on screen, then drops them', () => {
    const child = {};
    const node = { children: [child] };
    const first = cardSignal(node);
    const childFirst = cardSignal(child);
    const second = cardSignal(node);
    cardSignal(child);
    expect(first.aborted).toBe(false); // the old card is still what the user sees
    dropStaleCards([node]);
    expect(first.aborted).toBe(true);
    expect(childFirst.aborted).toBe(true);
    expect(second.aborted).toBe(false);
  });
});
