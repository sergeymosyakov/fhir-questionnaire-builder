// ── Unit: QuestionnaireSession container ──────────────────────────────────────
// Proves the session container wires the default singletons and that
// createSession() yields fully isolated instances with their own bus.
import { describe, it, expect } from 'vitest';
import { AppEvents } from '../js/events.js';
import { createSession, defaultSession } from '../js/core/session.js';
import { questDoc } from '../js/fhir/quest-document.js';
import { answerStore } from '../js/answer-store.js';

describe('QuestionnaireSession', () => {
  it('defaultSession wraps the legacy singletons', () => {
    expect(defaultSession.questDoc).toBe(questDoc);
    expect(defaultSession.answerStore).toBe(answerStore);
  });

  it('createSession() returns fresh, independent instances', () => {
    const a = createSession();
    const b = createSession();
    expect(a.questDoc).not.toBe(questDoc);
    expect(a.answerStore).not.toBe(answerStore);
    expect(a.answerStore).not.toBe(b.answerStore);
    expect(a.bus).not.toBe(b.bus);
  });

  it('answer stores are isolated across sessions', () => {
    const a = createSession();
    const b = createSession();
    a.answerStore.set('q1', 'yes');
    expect(a.answerStore.get('q1')).toBe('yes');
    expect(b.answerStore.get('q1')).toBeUndefined();
  });

  it('each session bus routes ANSWER_SET only to its own store', () => {
    const a = createSession();
    const b = createSession();
    a.bus.dispatch(AppEvents.ANSWER_SET, { id: 'q1', value: 42 });
    expect(a.answerStore.get('q1')).toBe(42);
    expect(b.answerStore.get('q1')).toBeUndefined();
  });

  it('config bag defaults to an object and is carried', () => {
    const s = createSession({ readOnly: true });
    expect(s.config).toEqual({ readOnly: true });
    expect(createSession().config).toEqual({});
  });
});
