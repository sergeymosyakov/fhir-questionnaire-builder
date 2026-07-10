// ── AnswerStore — preview answer session ──────────────────────────────────────
// Facade over the current form answer values for the active preview session.
//
// Storage is a TREE: `data = { [linkId]: [row0, row1, …] }`. Every linkId maps to
// an array of answer rows; repeat rows are plain array elements (no `$$` keys are
// ever stored). A single-answer field is simply an array of length 1.
//
// Rows are addressed with a small string dialect so the control/event layer stays
// repeat-agnostic:
//   'id'      → row 0
//   'id$$i'   → row i
//   'id$$n'   → the extra-row count (array length − 1)
// The facade decodes this dialect; the stored data itself never contains `$$`.
//
// Writes go through AppEvents (ANSWER_SET, ANSWER_DELETE, ANSWERS_CLEAR) or the
// facade methods — both funnel through a single internal path. Pure utilities
// (buildQR, importQRAnswers, validate) receive a tree snapshot `{id: [rows]}` via
// toValueMap() and write results back via merge() / replaceAll(); no external code
// touches the raw backing object directly.
import { AppEvents } from './events.js';

export class AnswerStore {
  /** Internal tree { linkId: [row0, row1, …] } — access only via facade methods.
   *  A repeating group's linkId holds an array of INSTANCE MAPS ({ childId: [...] }),
   *  addressed by an instance path (array of { id, idx }). */
  data = {};

  /** Decode a row-address key into { base, kind: 'row'|'count', index }. */
  static _parse(key) {
    const m = /^(.+)\$\$(\d+|n)$/.exec(key);
    if (!m) return { base: key, kind: 'row', index: 0 };
    if (m[2] === 'n') return { base: m[1], kind: 'count' };
    return { base: m[1], kind: 'row', index: Number(m[2]) };
  }

  /** Resolve the answer map for an instance path (root when empty/undefined); null if missing. */
  _scope(path) {
    let cur = this.data;
    for (const seg of path || []) {
      const arr = cur[seg.id];
      const inst = Array.isArray(arr) ? arr[seg.idx] : undefined;
      if (!inst || typeof inst !== 'object') return null;
      cur = inst;
    }
    return cur;
  }

  /** Resolve the answer map for a path, creating missing instance maps along the way. */
  _scopeOrCreate(path) {
    let cur = this.data;
    for (const seg of path || []) {
      let arr = cur[seg.id];
      if (!Array.isArray(arr)) arr = cur[seg.id] = [];
      if (!arr[seg.idx] || typeof arr[seg.idx] !== 'object') arr[seg.idx] = {};
      cur = arr[seg.idx];
    }
    return cur;
  }

  /** Return the answer for a row-address ('id' → row 0, 'id$$i' → row i, 'id$$n' → count). */
  get(key, path) {
    const scope = this._scope(path);
    if (!scope) return undefined;
    const p = AnswerStore._parse(key);
    const arr = scope[p.base];
    if (p.kind === 'count') return Array.isArray(arr) ? Math.max(0, arr.length - 1) : 0;
    return Array.isArray(arr) ? arr[p.index] : undefined;
  }

  /** Return all defined answer rows for a linkId. */
  getAll(id, path) {
    const scope = this._scope(path);
    const arr = scope && scope[id];
    return Array.isArray(arr) ? arr.filter(v => v !== undefined) : [];
  }

  /** Set a row value by row-address ('id', 'id$$i') or resize by count ('id$$n'). */
  set(key, v, path) {
    const scope = this._scopeOrCreate(path);
    const p = AnswerStore._parse(key);
    const arr = scope[p.base] || (scope[p.base] = []);
    if (p.kind === 'count') {
      const len = v + 1;
      if (arr.length > len) arr.length = len;                 // truncate extra rows
      else while (arr.length < len) arr.push(undefined);      // grow with empty rows
      return;
    }
    arr[p.index] = v;
  }

  /** Remove by row-address: plain 'id' → all rows; 'id$$i' → one row; 'id$$n' → extra rows. */
  remove(key, path) {
    const scope = this._scope(path);
    if (!scope) return;
    const p = AnswerStore._parse(key);
    if (p.kind === 'count') {
      const arr = scope[p.base];
      if (arr) arr.length = 1;                                // keep only row 0
      return;
    }
    if (key === p.base) { delete scope[p.base]; return; }     // plain id → drop all rows
    const arr = scope[p.base];
    if (arr) delete arr[p.index];                            // single row → leave hole
  }

  // ── Repeating-group instances ──────────────────────────────────────────────

  /** Number of instances of a repeating group at the given path. */
  instanceCount(groupId, path) {
    const scope = this._scope(path);
    const arr = scope && scope[groupId];
    return Array.isArray(arr) ? arr.length : 0;
  }

  /** Append a new (empty) instance to a repeating group; returns the new count. */
  addInstance(groupId, path) {
    const scope = this._scopeOrCreate(path);
    const arr = scope[groupId] || (scope[groupId] = []);
    arr.push({});
    return arr.length;
  }

  /** Remove instance `idx` of a repeating group at the given path. */
  removeInstance(groupId, idx, path) {
    const scope = this._scope(path);
    const arr = scope && scope[groupId];
    if (Array.isArray(arr)) arr.splice(idx, 1);
  }

  /** Remove all answers. */
  clear() { const d = this.data; Object.keys(d).forEach(k => delete d[k]); }

  /** Return a tree snapshot { id: [rows] } for read-only pure consumers. */
  toValueMap() {
    const out = {};
    for (const k of Object.keys(this.data)) out[k] = this.data[k].slice();
    return out;
  }

  /** Merge a tree/scalar map into the current answers (scalars are wrapped as single rows). */
  merge(map) {
    for (const k of Object.keys(map)) {
      this.data[k] = Array.isArray(map[k]) ? map[k].slice() : [map[k]];
    }
  }

  /** Replace all answers with the given map (clear + merge). */
  replaceAll(map) { this.clear(); this.merge(map); }

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener(AppEvents.ANSWER_SET,    e => this.set(e.detail.id, e.detail.value, e.detail.path));
      document.addEventListener(AppEvents.ANSWER_DELETE, e => this.remove(e.detail.id, e.detail.path));
      document.addEventListener(AppEvents.ANSWERS_CLEAR, () => this.clear());
    }
  }
}

/** Singleton — the current preview answer session. */
export const answerStore = new AnswerStore();
