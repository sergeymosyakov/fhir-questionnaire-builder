// ── EventBus ──────────────────────────────────────────────────────────────────
// Scoped pub/sub over an EventTarget. The default page bus wraps `document` so it
// interoperates 1:1 with legacy `document.dispatchEvent`/`addEventListener` during
// migration. Per-instance buses (own EventTarget) give isolated widgets their own
// channel — the foundation for multiple renderer instances on one page.

export class EventBus {
  /** @param {EventTarget} [target]  defaults to `document` in the browser, else a fresh EventTarget */
  constructor(target) {
    this._target = target
      || (typeof document !== 'undefined' ? document : new EventTarget());
  }

  /** Dispatch a named event carrying `detail`. */
  dispatch(name, detail) {
    this._target.dispatchEvent(new CustomEvent(name, { detail }));
  }

  /** Subscribe; returns an unsubscribe function. */
  on(name, cb, opts) {
    this._target.addEventListener(name, cb, opts);
    return () => this._target.removeEventListener(name, cb, opts);
  }

  off(name, cb, opts) {
    this._target.removeEventListener(name, cb, opts);
  }

  get target() { return this._target; }
}

// Default page-global bus — wraps `document` for back-compat during migration.
export const defaultBus = new EventBus();

// ── Per-bus state cache ───────────────────────────────────────────────────────
// Caches the last `detail` for selected events so late subscribers read the
// current state immediately without waiting for the next dispatch. Scoped to a
// bus, so each renderer instance can have its own cache.
//
// @param {EventBus} bus
// @param {Iterable<string>} statefulEvents  event names to cache
// @returns {{ get(name): any, _set(name, detail): void }}
export function createEventState(bus, statefulEvents) {
  const cache = new Map();
  for (const name of statefulEvents) {
    bus.on(name, e => cache.set(name, e?.detail ?? {}));
  }
  return {
    get(name) { return cache.get(name); },
    // For testing only — seed the cache without dispatching an event.
    _set(name, detail) { cache.set(name, detail); },
  };
}
