// @vitest-environment jsdom
// ── Unit tests: js/fhir/server-config-cloud.js ───────────────────────────────
// Supabase client and auth are mocked; the module self-wires to auth on import.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => {
  const chain = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.maybeSingle = vi.fn();
  chain.upsert = vi.fn(async () => ({}));
  return { chain, from: vi.fn(() => chain), authCb: { fn: null } };
});

vi.mock('../js/auth/supabase-client.js', () => ({ supabase: { from: h.from } }));
vi.mock('../js/auth/auth.js', () => ({ onAuthChange: vi.fn(cb => { h.authCb.fn = cb; }) }));

import { supabaseProvider, loadSettings, saveSettings, clearSettings } from '../js/fhir/server-config-cloud.js';
import { serverConfig } from '../js/fhir/server-config.js';

beforeEach(() => {
  supabaseProvider.hydrate({});
  h.from.mockClear();
  h.chain.select.mockClear();
  h.chain.eq.mockClear();
  h.chain.maybeSingle.mockReset();
  h.chain.upsert.mockClear().mockResolvedValue({});
});

describe('supabaseProvider registration', () => {
  it('is registered with serverConfig as the highest-priority provider', () => {
    expect(serverConfig.getProviders()[0]).toBe(supabaseProvider);
  });
});

describe('loadSettings', () => {
  it('queries user_settings by user id and hydrates the provider', async () => {
    h.chain.maybeSingle.mockResolvedValue({ data: { server_config: { fhirBaseUrl: 'https://x.example' } }, error: null });
    await loadSettings('u1');
    expect(h.from).toHaveBeenCalledWith('user_settings');
    expect(h.chain.select).toHaveBeenCalledWith('server_config');
    expect(h.chain.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(supabaseProvider.get('fhirBaseUrl')).toBe('https://x.example');
  });

  it('keeps the existing cache when Supabase returns an error', async () => {
    supabaseProvider.set('a', '1');
    h.chain.maybeSingle.mockResolvedValue({ data: { server_config: { b: '2' } }, error: { message: 'x' } });
    await loadSettings('u1');
    expect(supabaseProvider.toJSON()).toEqual({ a: '1' });
  });

  it('keeps the cache when there is no row', async () => {
    supabaseProvider.set('a', '1');
    h.chain.maybeSingle.mockResolvedValue({ data: null, error: null });
    await loadSettings('u1');
    expect(supabaseProvider.toJSON()).toEqual({ a: '1' });
  });

  it('swallows a rejected query (offline) and leaves the cache untouched', async () => {
    supabaseProvider.set('a', '1');
    h.chain.maybeSingle.mockRejectedValue(new Error('offline'));
    await expect(loadSettings('u1')).resolves.toBeUndefined();
    expect(supabaseProvider.toJSON()).toEqual({ a: '1' });
  });
});

describe('saveSettings', () => {
  it('upserts the provider JSON keyed by user_id', async () => {
    supabaseProvider.set('corsProxyUrl', 'https://p.example');
    await saveSettings('u2');
    expect(h.chain.upsert).toHaveBeenCalledTimes(1);
    const [row, opts] = h.chain.upsert.mock.calls[0];
    expect(row).toMatchObject({ user_id: 'u2', server_config: { corsProxyUrl: 'https://p.example' } });
    expect(new Date(row.updated_at).toISOString()).toBe(row.updated_at);
    expect(opts).toEqual({ onConflict: 'user_id' });
  });
});

describe('clearSettings', () => {
  it('empties the provider cache', () => {
    supabaseProvider.set('a', '1');
    clearSettings();
    expect(supabaseProvider.toJSON()).toEqual({});
  });
});

describe('auth wiring', () => {
  it('loads settings on login and clears them on logout', async () => {
    h.chain.maybeSingle.mockResolvedValue({ data: { server_config: { k: 'v' } }, error: null });
    await h.authCb.fn('SIGNED_IN', { id: 'u3' });
    expect(h.chain.eq).toHaveBeenCalledWith('user_id', 'u3');
    expect(supabaseProvider.get('k')).toBe('v');
    await h.authCb.fn('SIGNED_OUT', null);
    expect(supabaseProvider.toJSON()).toEqual({});
  });
});
