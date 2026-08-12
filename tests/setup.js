// Vitest setup. Node caps EventTarget listeners at 10; tests construct many
// AnswerStore/QuestDocument instances that share the node default bus, so lift
// the cap to avoid noisy MaxListenersExceededWarning (browsers have no such cap).
import { setMaxListeners } from 'node:events';

setMaxListeners(1000);
