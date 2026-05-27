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

/** @param {string} key @returns {Promise<string|null>} */
export async function getItem(key)         { _check(); return _adapter.getItem(key); }

/** @param {string} key @param {string} value @returns {Promise<void>} */
export async function setItem(key, value)  { _check(); return _adapter.setItem(key, value); }

/** @param {string} key @returns {Promise<void>} */
export async function removeItem(key)      { _check(); return _adapter.removeItem(key); }

/** @returns {Promise<string[]>} */
export async function keys()               { _check(); return _adapter.keys(); }

// ── Cloud methods (only available when a SupabaseAdapter is registered) ───────

/** @param {object} fhirJson @returns {Promise<{ id: string, title: string, updated_at: string }>} */
export async function cloudSave(fhirJson)  { _check(); return _adapter.cloudSave?.(fhirJson); }

/** @param {string} id @param {object} fhirJson @returns {Promise<object>} */
export async function cloudUpdate(id, fhirJson) { _check(); return _adapter.cloudUpdate?.(id, fhirJson); }

/** @returns {Promise<Array<{ id: string, title: string, url: string|null, updated_at: string }>>} */
export async function cloudList()          { _check(); return _adapter.cloudList?.() ?? []; }

/** @param {string} id @returns {Promise<object>} FHIR JSON */
export async function cloudLoad(id)        { _check(); return _adapter.cloudLoad?.(id); }

/** @param {string} id @returns {Promise<void>} */
export async function cloudDelete(id)      { _check(); return _adapter.cloudDelete?.(id); }

/** Returns true when the registered adapter supports cloud operations. */
export function hasCloud()                 { return !!(_adapter?.cloudSave); }
