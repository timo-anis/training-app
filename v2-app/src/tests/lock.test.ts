/**
 * lock.test.ts — the pure biometric-lock state machine (lib/lock.ts).
 *
 * Covers the spec's required transitions:
 *   locked -> unlock ok -> unlocked
 *   unlock fail -> stays locked (retry)
 *   background > 2 min -> re-lock on resume; <= 2 min -> stays unlocked
 *   toggle off -> unlocks; toggle on mid-session -> does NOT lock immediately
 */
import { describe, it, expect } from 'vitest';
import { initLock, unlockedModel, reduceLock, BG_RELOCK_MS, type LockModel } from '../lib/lock';

describe('initLock', () => {
  it('starts LOCKED when the feature is enabled (cold-start requirement)', () => {
    const m = initLock(true);
    expect(m).toEqual({ enabled: true, phase: 'locked', hiddenAt: null });
  });
  it('starts UNLOCKED when the feature is disabled', () => {
    expect(initLock(false)).toEqual({ enabled: false, phase: 'unlocked', hiddenAt: null });
  });
});

describe('unlockedModel', () => {
  it('is fully open and feature-off (used on sign-out)', () => {
    expect(unlockedModel()).toEqual({ enabled: false, phase: 'unlocked', hiddenAt: null });
  });
});

describe('boot', () => {
  it('locks an enabled user and clears any stale background marker', () => {
    const stale: LockModel = { enabled: true, phase: 'unlocked', hiddenAt: 123 };
    expect(reduceLock(stale, { t: 'boot' })).toEqual({ enabled: true, phase: 'locked', hiddenAt: null });
  });
  it('leaves a disabled user unlocked', () => {
    expect(reduceLock(initLock(false), { t: 'boot' }).phase).toBe('unlocked');
  });
});

describe('unlock success / failure', () => {
  it('unlock-ok opens the gate', () => {
    const m = reduceLock(initLock(true), { t: 'unlock-ok' });
    expect(m.phase).toBe('unlocked');
  });
  it('unlock-fail keeps it locked so the user can retry', () => {
    const locked = initLock(true);
    const after = reduceLock(locked, { t: 'unlock-fail' });
    expect(after.phase).toBe('locked');
    expect(after).toEqual(locked);
  });
  it('a fresh failed attempt after unlocking does not reopen', () => {
    let m = initLock(true);
    m = reduceLock(m, { t: 'unlock-ok' });   // unlocked
    m = reduceLock(m, { t: 'unlock-fail' }); // no-op
    expect(m.phase).toBe('unlocked');
  });
});

describe('background / resume re-lock', () => {
  it('re-locks when away longer than the 2-min threshold', () => {
    let m = reduceLock(initLock(true), { t: 'unlock-ok' }); // unlocked, enabled
    m = reduceLock(m, { t: 'hide', now: 0 });
    m = reduceLock(m, { t: 'resume', now: BG_RELOCK_MS + 1 });
    expect(m.phase).toBe('locked');
    expect(m.hiddenAt).toBeNull();
  });
  it('stays unlocked for a short trip away (at/under threshold)', () => {
    let m = reduceLock(initLock(true), { t: 'unlock-ok' });
    m = reduceLock(m, { t: 'hide', now: 1_000 });
    m = reduceLock(m, { t: 'resume', now: 1_000 + BG_RELOCK_MS }); // exactly threshold -> not >
    expect(m.phase).toBe('unlocked');
    expect(m.hiddenAt).toBeNull();
  });
  it('never re-locks when the feature is disabled', () => {
    let m = unlockedModel(); // enabled:false
    m = reduceLock(m, { t: 'hide', now: 0 });
    m = reduceLock(m, { t: 'resume', now: BG_RELOCK_MS * 100 });
    expect(m.phase).toBe('unlocked');
  });
  it('resume without a prior hide is a no-op on phase', () => {
    const m = reduceLock(initLock(true), { t: 'resume', now: 999_999 });
    expect(m.phase).toBe('locked'); // was locked, no hiddenAt -> unchanged
  });
  it('honours a custom threshold', () => {
    let m = reduceLock(initLock(true), { t: 'unlock-ok' });
    m = reduceLock(m, { t: 'hide', now: 0 });
    m = reduceLock(m, { t: 'resume', now: 500, thresholdMs: 100 });
    expect(m.phase).toBe('locked');
  });
});

describe('toggle enabled', () => {
  it('turning OFF unlocks immediately and clears marker', () => {
    let m: LockModel = { enabled: true, phase: 'locked', hiddenAt: 42 };
    m = reduceLock(m, { t: 'set-enabled', enabled: false });
    expect(m).toEqual({ enabled: false, phase: 'unlocked', hiddenAt: null });
  });
  it('turning ON mid-session does NOT lock the user out right away', () => {
    let m = unlockedModel();
    m = reduceLock(m, { t: 'set-enabled', enabled: true });
    expect(m.enabled).toBe(true);
    expect(m.phase).toBe('unlocked');
  });
  it('after enabling mid-session, the next boot locks', () => {
    let m = unlockedModel();
    m = reduceLock(m, { t: 'set-enabled', enabled: true });
    m = reduceLock(m, { t: 'boot' });
    expect(m.phase).toBe('locked');
  });
});

describe('purity', () => {
  it('does not mutate its input', () => {
    const m = initLock(true);
    const snapshot = JSON.stringify(m);
    reduceLock(m, { t: 'hide', now: 5 });
    reduceLock(m, { t: 'unlock-ok' });
    expect(JSON.stringify(m)).toBe(snapshot);
  });
});
