// ── QuestionnaireSession — one isolated renderer/session context ──────────────
// Bundles the per-session state the renderer + core need: the questionnaire
// document, the answer store, the event bus, and a config bag. The default app
// uses `defaultSession` (wrapping the legacy singletons on the document-backed
// bus); an embedded widget calls `createSession()` to get a fully isolated
// instance with its own bus + fresh document/answers.
import { EventBus, defaultBus } from './events/bus.js';
import { QuestDocument, questDoc } from '../fhir/quest-document.js';
import { AnswerStore, answerStore } from '../answer-store.js';

export class QuestionnaireSession {
  constructor({ questDoc, answerStore, bus, config = {} }) {
    this.questDoc    = questDoc;
    this.answerStore = answerStore;
    this.bus         = bus;
    this.config      = config;
  }
}

/** Create a fully isolated session (own bus + fresh document/answers). */
export function createSession(config = {}) {
  const bus = new EventBus(new EventTarget());
  return new QuestionnaireSession({
    questDoc:    new QuestDocument(bus),
    answerStore: new AnswerStore(bus),
    bus,
    config,
  });
}

/** The app's default session — wraps the legacy singletons on the page bus. */
export const defaultSession = new QuestionnaireSession({
  questDoc,
  answerStore,
  bus: defaultBus,
  config: {},
});
