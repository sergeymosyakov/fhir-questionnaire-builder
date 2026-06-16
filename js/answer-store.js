// ── AnswerStore — preview answer session ──────────────────────────────────────
// Holds all current form answer values for the active preview session.
// Writes go through AppEvents (ANSWER_SET, ANSWER_DELETE, ANSWERS_CLEAR) so
// all state changes are observable and cross-module coupling is avoided.
// Reads use answerStore.get(id) and answerStore.getAll(id).
// answerStore.data is the raw backing object — pass it to buildQR, evalCalcNodes
// and other pure utilities that need a plain {id: value} map.
import { AppEvents } from './events.js';

export class AnswerStore {
  /** Raw {linkId: value} map — pass to buildQR / evalCalcNodes / validate. */
  data = {};

  /** Return the primary (first) answer for a linkId. */
  get(id) { return this.data[id]; }

  /** Return all answers for a linkId: primary + repeat rows ($$1, $$2, …). */
  getAll(id) {
    const result = [];
    if (this.data[id] !== undefined) result.push(this.data[id]);
    const n = this.data[id + '$$n'] || 0;
    for (let i = 1; i <= n; i++) {
      if (this.data[id + '$$' + i] !== undefined) result.push(this.data[id + '$$' + i]);
    }
    return result;
  }

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener(AppEvents.ANSWER_SET, e => {
        this.data[e.detail.id] = e.detail.value;
      });
      document.addEventListener(AppEvents.ANSWER_DELETE, e => {
        delete this.data[e.detail.id];
      });
      document.addEventListener(AppEvents.ANSWERS_CLEAR, () => {
        const d = this.data;
        Object.keys(d).forEach(k => delete d[k]);
      });
    }
  }
}

/** Singleton — the current preview answer session. */
export const answerStore = new AnswerStore();
