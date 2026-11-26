import { describe, test, expect, beforeEach } from 'vitest';
import { putHandoff, takeHandoff, dropHandoff } from '../js/core/questionnaire-handoff.js';

const big = { resourceType: 'Questionnaire', title: 'Ünïcode ✓', item: Array.from({ length: 2000 }, (_, i) => ({ linkId: `q${i}`, type: 'string', text: `Question number ${i}` })) };

describe('questionnaire hand-off', () => {
  let store;
  beforeEach(() => {
    store = new Map();
    globalThis.localStorage = {
      get length() { return store.size; },
      key: (i) => [...store.keys()][i] ?? null,
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, v),
      removeItem: (k) => store.delete(k),
    };
  });

  test('take returns what was put under that id, once, and removes it', async () => {
    const id = await putHandoff(big);
    expect(typeof id).toBe('string');
    expect(await takeHandoff(id)).toEqual(big);
    expect(store.size).toBe(0);
    expect(await takeHandoff(id)).toBeNull();
  });

  test('another id takes nothing and leaves the waiting one alone', async () => {
    const id = await putHandoff(big);
    expect(await takeHandoff('some-other-id')).toBeNull();
    expect(await takeHandoff(id)).toEqual(big);
  });

  test('a full or blocked storage reports failure', async () => {
    globalThis.localStorage = { length: 0, key: () => null, setItem() { throw new Error('quota'); } };
    expect(await putHandoff(big)).toBeNull();
  });

  test('dropHandoff removes a waiting hand-off', async () => {
    const id = await putHandoff(big);
    dropHandoff(id);
    expect(await takeHandoff(id)).toBeNull();
  });

  test('leftovers older than ten minutes are swept on the next hand-off', async () => {
    store.set('fhirqb.handoff.old', `${Date.now() - 11 * 60_000}:gz:x`);
    store.set('unrelated', 'keep');
    await putHandoff(big);
    expect(store.has('fhirqb.handoff.old')).toBe(false);
    expect(store.get('unrelated')).toBe('keep');
  });

  test('an unreadable envelope is reported, not silently dropped', async () => {
    store.set('fhirqb.handoff.bad', `${Date.now()}:gz:@@@`);
    await expect(takeHandoff('bad')).rejects.toThrow();
  });
});
