// ── Auth module ───────────────────────────────────────────────────────────────
// GitHub OAuth via Supabase Auth.
//
// API:
//   signInWithGitHub()        — redirects to GitHub; returns to current page
//   signOut()                 — clears session
//   getUser()                 → Promise<User | null>
//   onAuthChange(cb)          — cb(event, user | null); fires immediately with current state

import { supabase } from './supabase-client.js';

/**
 * Start GitHub OAuth flow.
 * Redirects to GitHub; on success, returns to the current page URL.
 */
export async function signInWithGitHub() {
  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo },
  });
  if (error) throw error;
}

/**
 * Sign out the current user and clear the session.
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Get the currently authenticated user, or null if not signed in.
 * @returns {Promise<import('@supabase/supabase-js').User | null>}
 */
export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Subscribe to auth state changes.
 * The callback fires immediately with the current state, then on every change.
 * @param {function(event: string, user: object|null): void} callback
 */
export function onAuthChange(callback) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    callback(event, session?.user ?? null);
  });
}
