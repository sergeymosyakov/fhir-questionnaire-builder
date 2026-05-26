// ── Storage API layer ─────────────────────────────────────────────────────────
// Thin abstraction over persistence. Register an adapter once at app startup;
// all code then uses getItem / setItem / removeItem / keys without knowing
// whether the backing store is localStorage, IndexedDB, Supabase, etc.
//
// Adapter interface (all methods synchronous for the localStorage tier):
//   getItem(key: string): string | null
//   setItem(key: string, value: string): void
//   removeItem(key: string): void
//   keys(): string[]
//
// Usage:
//   // app.js (once, before anything else runs):
//   import { register } from './storage/storage.js';
//   import { LocalStorageAdapter } from './storage/local-storage.js';
//   register(new LocalStorageAdapter());
//
//   // any module:
//   import * as storage from '../storage/storage.js';
//   const val = storage.getItem('my-key');

/** @type {{ getItem(k:string):string|null, setItem(k:string,v:string):void, removeItem(k:string):void, keys():string[] } | null} */
let _adapter = null;

/**
 * Register the storage implementation.
 * Must be called once before any other storage operation.
 * @param {{ getItem(k:string):string|null, setItem(k:string,v:string):void, removeItem(k:string):void, keys():string[] }} adapter
 */
export function register(adapter) {
  _adapter = adapter;
}

function _check() {
  if (!_adapter) throw new Error('[storage] No adapter registered. Call storage.register() at app startup.');
}

/** @param {string} key @returns {string|null} */
export function getItem(key)         { _check(); return _adapter.getItem(key); }

/** @param {string} key @param {string} value */
export function setItem(key, value)  { _check(); _adapter.setItem(key, value); }

/** @param {string} key */
export function removeItem(key)      { _check(); _adapter.removeItem(key); }

/** @returns {string[]} */
export function keys()               { _check(); return _adapter.keys(); }
