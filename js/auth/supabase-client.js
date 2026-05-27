// ── Supabase client singleton ─────────────────────────────────────────────────
// Loaded once; imported by auth.js and (indirectly) supabase-adapter.js.
//
// The publishable key is intentionally public — it is the equivalent of the
// legacy "anon" key and is safe to ship in browser code when RLS is enabled.
// The Supabase JS library is loaded from CDN as a regular <script> tag in
// index.html and exposes window.supabase before any ES module runs.

const SUPABASE_URL = 'https://rdwmpbqadytdbshavvrl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Ofo3nmOTyzq9bCXhDBfnpw_q3kNzW2R';

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
