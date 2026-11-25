// Undo history: a change that leaves the questionnaire as it was adds nothing to undo.
import { describe, it, expect, vi } from 'vitest';

const listeners = {};
globalThis.document = { addEventListener: (t, fn) => { (listeners[t] ||= []).push(fn); }, removeEventListener() {} };
globalThis.window = { requestIdleCallback: (fn) => fn() };

const { AppEvents } = await import('../js/events.js');
const history = await import('../js/ui/history.js');

describe('history snapshots', () => {
  it('skips a snapshot identical to the current one', () => {
    vi.useFakeTimers();
    let doc = { title: 'a' };
    history.init({ buildFn: () => doc, importFn: () => {} });
    const fire = (type) => { listeners[type].forEach((fn) => fn({})); vi.advanceTimersByTime(500); };
    expect(history.canUndo()).toBe(false);

    fire(AppEvents.RESPONSE_CHANGED); // an answer typed in the preview
    fire(AppEvents.RESPONSE_CHANGED);
    expect(history.canUndo()).toBe(false);

    doc = { title: 'b' };
    fire(AppEvents.REINIT_FORM);
    expect(history.canUndo()).toBe(true);
    vi.useRealTimers();
  });
});
