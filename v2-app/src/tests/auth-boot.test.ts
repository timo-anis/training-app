/**
 * auth-boot.test.ts — shouldBootOnSignIn. supabase-js re-emits SIGNED_IN on every
 * app resume. Mid-workout that must NOT re-boot (it unmounted WorkoutMode and reset
 * the viewed day → blank workout screen). Outside a workout the resume re-boot is
 * kept (cloud refresh + day rollover). Genuine sign-in / user switch / unhealthy
 * boot always boots.
 */
import { describe, it, expect } from 'vitest';
import { shouldBootOnSignIn, sessionBlocksReboot, MAX_PROTECTED_SESSION_MS } from '../lib/auth-boot';

describe('shouldBootOnSignIn', () => {
  it('boots on the first sign-in (no current user)', () => {
    expect(shouldBootOnSignIn(null, 'idle', 'u1', false)).toBe(true);
    expect(shouldBootOnSignIn(undefined, 'idle', 'u1', true)).toBe(true);
  });

  it('does NOT re-boot the same, booted user while a workout is running (app resume)', () => {
    expect(shouldBootOnSignIn('u1', 'ready', 'u1', true)).toBe(false);
  });

  it('keeps the resume re-boot outside a workout (cloud refresh / day rollover)', () => {
    expect(shouldBootOnSignIn('u1', 'ready', 'u1', false)).toBe(true);
  });

  it('boots when a different user signs in (account switch), even mid-workout', () => {
    expect(shouldBootOnSignIn('u1', 'ready', 'u2', true)).toBe(true);
  });

  it('re-boots the same user when the previous boot is not healthy', () => {
    for (const st of ['error', 'idle', 'loading'] as const) {
      expect(shouldBootOnSignIn('u1', st, 'u1', true)).toBe(true);
    }
  });
});

describe('sessionBlocksReboot', () => {
  const now = 10_000_000_000;
  it('blocks only for an active, recently started session', () => {
    expect(sessionBlocksReboot(true, now - 60_000, now)).toBe(true);
  });
  it('does not block without a session or start time', () => {
    expect(sessionBlocksReboot(false, now - 60_000, now)).toBe(false);
    expect(sessionBlocksReboot(true, null, now)).toBe(false);
  });
  it('a forgotten session (older than the window) no longer blocks the resume refresh', () => {
    expect(sessionBlocksReboot(true, now - MAX_PROTECTED_SESSION_MS, now)).toBe(false);
    expect(sessionBlocksReboot(true, now - MAX_PROTECTED_SESSION_MS + 1, now)).toBe(true);
  });
});
