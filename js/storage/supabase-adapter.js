// ── Supabase storage adapter ──────────────────────────────────────────────────
// Extends LocalStorageAdapter (preserves all sync-compatible async methods)
// and adds cloud questionnaire CRUD on top.
//
// Sync-compatible methods (delegate to localStorage, Promise resolves immediately):
//   getItem / setItem / removeItem / keys  — same as LocalStorageAdapter
//
// Cloud methods (async, require authentication):
//   cloudSave(fhirJson)   → Promise<{ id, title, updated_at }>
//   cloudList()           → Promise<Array<{ id, title, url, updated_at }>>
//   cloudLoad(id)         → Promise<object>  (FHIR JSON)
//   cloudDelete(id)       → Promise<void>

import { LocalStorageAdapter } from './local-storage.js';

const TABLE = 'questionnaires';

export class SupabaseAdapter extends LocalStorageAdapter {
  /** @param {object} supabase — Supabase JS client instance */
  constructor(supabase) {
    super();
    this._sb = supabase;
  }

  // ── Cloud questionnaire CRUD ───────────────────────────────────────────────

  /**
   * Save (insert or update) the current questionnaire for the signed-in user.
   * Upserts by (user_id, url) when Questionnaire.url is present; otherwise inserts.
   * @param {object} fhirJson — FHIR Questionnaire JSON object
   * @returns {Promise<{ id: string, title: string, updated_at: string }>}
   */
  async cloudSave(fhirJson) {
    const { data: { user }, error: authErr } = await this._sb.auth.getUser();
    if (authErr || !user) throw new Error('Not authenticated');

    const title = fhirJson.title || 'Untitled';
    const url   = fhirJson.url   || null;

    if (url) {
      // Check if row with (user_id, url) already exists, then update or insert
      const { data: existing } = await this._sb
        .from(TABLE)
        .select('id')
        .eq('user_id', user.id)
        .eq('url', url)
        .maybeSingle();

      if (existing) {
        const { data, error } = await this._sb
          .from(TABLE)
          .update({ title, fhir: fhirJson, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select('id, title, updated_at')
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await this._sb
          .from(TABLE)
          .insert({ user_id: user.id, title, url, fhir: fhirJson })
          .select('id, title, updated_at')
          .single();
        if (error) throw error;
        return data;
      }
    } else {
      // Insert new row; returns id for subsequent updates in the same session
      const { data, error } = await this._sb
        .from(TABLE)
        .insert({ user_id: user.id, title, url: null, fhir: fhirJson })
        .select('id, title, updated_at')
        .single();
      if (error) throw error;
      return data;
    }
  }

  /**
   * Update an existing questionnaire row by id (for anonymous-URL questionnaires
   * saved earlier in the same session).
   * @param {string} id — UUID of the row
   * @param {object} fhirJson
   */
  async cloudUpdate(id, fhirJson) {
    const title = fhirJson.title || 'Untitled';
    const { data, error } = await this._sb
      .from(TABLE)
      .update({ title, fhir: fhirJson, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, title, updated_at')
      .single();
    if (error) throw error;
    return data;
  }

  /**
   * List all questionnaires for the signed-in user (no FHIR JSON — metadata only).
   * @returns {Promise<Array<{ id: string, title: string, url: string|null, updated_at: string }>>}
   */
  async cloudList() {
    const { data, error } = await this._sb
      .from(TABLE)
      .select('id, title, url, updated_at')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  /**
   * Load the full FHIR JSON for a questionnaire by its row id.
   * @param {string} id
   * @returns {Promise<object>} FHIR Questionnaire JSON
   */
  async cloudLoad(id) {
    const { data, error } = await this._sb
      .from(TABLE)
      .select('fhir')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data.fhir;
  }

  /**
   * Delete a questionnaire row by id.
   * @param {string} id
   */
  async cloudDelete(id) {
    const { error } = await this._sb
      .from(TABLE)
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
}
