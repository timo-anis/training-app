/**
 * error-tracker.test.ts — unit tests for services/errorTracker.ts
 *
 * Covers the two observability gaps fixed 2026-09-26:
 *  1. errors raised before sign-in are queued (bounded) and flushed once a user
 *     exists, instead of being silently dropped;
 *  2. a failed insert (supabase-js returns `{ error }`, it does not throw) is
 *     surfaced via console.warn and never throws.
 * Plus the unchanged contract: signed-in errors write immediately, one row per
 * fingerprint per session.
 *
 * The module keeps per-session state (seen set, queue), so every test imports a
 * fresh copy via vi.resetModules().
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writable, type Writable } from 'svelte/store';

const mockInsert = vi.fn();
let currentUser: Writable<{ id: string } | null>;

vi.mock('../services/supabase', () => ({
  supabase: { from: () => ({ insert: (row: unknown) => mockInsert(row) }) },
}));
vi.mock('../stores/app', () => ({
  get currentUser() { return currentUser; },
}));

async function load() {
  vi.resetModules();
  return await import('../services/errorTracker');
}

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  currentUser = writable(null);
  mockInsert.mockReset();
  mockInsert.mockResolvedValue({ error: null });
});
afterEach(() => vi.restoreAllMocks());

describe('errorTracker', () => {
  it('writes immediately when a user is signed in', async () => {
    currentUser.set({ id: 'u1' });
    const t = await load();
    t.logCaughtError(new Error('boom'), 'test');
    await flush();
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const row = mockInsert.mock.calls[0][0];
    expect(row.user_id).toBe('u1');
    expect(row.message).toContain('boundary(test): boom');
    expect(row).not.toHaveProperty('occurred_at'); // DB default applies
  });

  it('queues a pre-sign-in error and flushes it once the user signs in', async () => {
    const t = await load();
    t.logCaughtError(new Error('early'), 'boot');
    await flush();
    expect(mockInsert).not.toHaveBeenCalled();

    currentUser.set({ id: 'u2' });
    await flush();
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const row = mockInsert.mock.calls[0][0];
    expect(row.user_id).toBe('u2');
    expect(row.message).toContain('early');
    // capture-time timestamp is kept for queued rows
    expect(typeof row.occurred_at).toBe('string');
    expect(Number.isNaN(Date.parse(row.occurred_at))).toBe(false);

    // flushed once — a later user change does not replay it
    currentUser.set(null);
    currentUser.set({ id: 'u2' });
    await flush();
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it('caps the pre-sign-in queue at MAX_PENDING', async () => {
    const t = await load();
    for (let i = 0; i < t.MAX_PENDING + 5; i++) t.logCaughtError(new Error(`e${i}`), 'loop');
    await flush();
    currentUser.set({ id: 'u3' });
    await flush();
    expect(mockInsert).toHaveBeenCalledTimes(t.MAX_PENDING);
  });

  it('queued rows keep the capture-time URL, not the URL at flush time', async () => {
    const t = await load();
    window.history.pushState({}, '', '/signin-screen');
    t.logCaughtError(new Error('at-signin'), 'auth');
    window.history.pushState({}, '', '/after-login');
    currentUser.set({ id: 'u7' });
    await flush();
    expect(mockInsert.mock.calls[0][0].url).toBe('/signin-screen');
    window.history.pushState({}, '', '/');
  });

  it('an error dropped by a full queue can still be recorded after sign-in', async () => {
    const t = await load();
    for (let i = 0; i < t.MAX_PENDING; i++) t.logCaughtError(new Error(`f${i}`), 'fill');
    t.logCaughtError(new Error('overflow'), 'late'); // dropped: queue full
    currentUser.set({ id: 'u8' });
    await flush();
    expect(mockInsert).toHaveBeenCalledTimes(t.MAX_PENDING);
    t.logCaughtError(new Error('overflow'), 'late'); // recurs after sign-in
    await flush();
    expect(mockInsert).toHaveBeenCalledTimes(t.MAX_PENDING + 1);
    expect(mockInsert.mock.calls.at(-1)![0].message).toContain('overflow');
  });

  it('dedupes by fingerprint (one row per unique error per session)', async () => {
    currentUser.set({ id: 'u4' });
    const t = await load();
    t.logCaughtError(new Error('same'), 'x');
    t.logCaughtError(new Error('same'), 'x');
    await flush();
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it('surfaces a failed insert via console.warn and does not throw', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockInsert.mockResolvedValue({ error: { message: 'RLS denied' } });
    currentUser.set({ id: 'u5' });
    const t = await load();
    expect(() => t.logCaughtError(new Error('x'), 'y')).not.toThrow();
    await flush();
    expect(warn).toHaveBeenCalledWith('[errorTracker] could not record error:', 'RLS denied');
  });

  it('survives a network-level rejection from insert', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockInsert.mockRejectedValue(new Error('offline'));
    currentUser.set({ id: 'u6' });
    const t = await load();
    t.logCaughtError(new Error('z'), 'w');
    await flush();
    expect(warn).toHaveBeenCalledWith('[errorTracker] could not record error:', 'offline');
  });
});
