// ── Server config — Supabase cloud sync ──────────────────────────────────────
// Registers a SupabaseConfigProvider as the highest-priority source.
// Hydrated on login, cleared on logout.
// Persisted via upsert to the `user_settings` table.
//
// Supabase schema required (run once in Supabase SQL editor):
//
//   CREATE TABLE IF NOT EXISTS user_settings (
//     id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//     user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
//     server_config jsonb NOT NULL DEFAULT '{}'::jsonb,
//     updated_at   timestamptz NOT NULL DEFAULT now(),
//     UNIQUE (user_id)
//   );
//   ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
//   CREATE POLICY "own_settings" ON user_settings
//     USING (auth.uid() = user_id)
//     WITH CHECK (auth.uid() = user_id);

import { supabase }    from '../auth/supabase-client.js';
import * as auth       from '../auth/auth.js';
import { serverConfig, SupabaseConfigProvider } from './server-config.js';

const TABLE = 'user_settings';

/** Singleton SupabaseConfigProvider — registered at highest priority. */
export const supabaseProvider = new SupabaseConfigProvider();
serverConfig.register(supabaseProvider);

/**
 * Load user settings from Supabase and hydrate the provider.
 * @param {string} userId
 */
export async function loadSettings(userId) {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('server_config')
      .eq('user_id', userId)
      .single();
    if (!error && data?.server_config) {
      supabaseProvider.hydrate(data.server_config);
    }
  } catch { /* offline or table missing — silently fall back to localStorage */ }
}

/**
 * Persist current SupabaseConfigProvider data to Supabase.
 * @param {string} userId
 */
export async function saveSettings(userId) {
  const config = supabaseProvider.toJSON();
  await supabase.from(TABLE).upsert(
    { user_id: userId, server_config: config, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
}

/** Clear the provider cache (call on logout). */
export function clearSettings() {
  supabaseProvider.hydrate({});
}

// ── Self-wire to auth state ───────────────────────────────────────────────────
if (typeof document !== 'undefined') {
  auth.onAuthChange(async (_event, user) => {
    if (user) {
      await loadSettings(user.id);
    } else {
      clearSettings();
    }
  });
}
