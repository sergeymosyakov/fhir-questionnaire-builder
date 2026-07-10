// ── AnswerStore — preview answer session ──────────────────────────────────────
// Facade over the current form answer values for the active preview session.
// Writes go through AppEvents (ANSWER_SET, ANSWER_DELETE, ANSWERS_CLEAR) or the
// facade methods (set/remove/clear) — both funnel through a single internal path.
// Reads use get(id) / getAll(id). Pure utilities that need a plain {id: value}
// map (buildQR, evalCalcNodes, validate, import) receive a snapshot via
// toValueMap() and write results back via merge() / replaceAll() — no external
// code touches the raw backing object directly.
import { AppEvents } from './events.js';

export class AnswerStore {
  /** Internal {linkId: value} backing map — access only via facade methods. */
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

  /** Set a single answer value. */
  set(id, v) { this.data[id] = v; }

  /** Delete a single answer value. */
  remove(id) { delete this.data[id]; }

  /** Remove all answers. */
  clear() { const d = this.data; Object.keys(d).forEach(k => delete d[k]); }

  /** Return a shallow-copy snapshot {id: value} for read-only pure consumers. */
  toValueMap() { return { ...this.data }; }

  /** Merge the given map into the current answers (add/overwrite keys). */
  merge(map) { Object.assign(this.data, map); }

  /** Replace all answers with the given map (clear + assign). */
  replaceAll(map) { this.clear(); Object.assign(this.data, map); }

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener(AppEvents.ANSWER_SET,    e => this.set(e.detail.id, e.detail.value));
      document.addEventListener(AppEvents.ANSWER_DELETE, e => this.remove(e.detail.id));
      document.addEventListener(AppEvents.ANSWERS_CLEAR, () => this.clear());
    }
  }
}

/** Singleton — the current preview answer session. */
export const answerStore = new AnswerStore();
