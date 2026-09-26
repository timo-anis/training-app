/**
 * auth-boot.test.ts — shouldBootOnSignIn: a visibility-triggered SIGNED_IN for
 * the already-booted user must NOT re-boot (it reset the viewed day mid-workout);
 * every genuine sign-in / user switch / unhealthy boot still does.
 */
import { describe, it, expect } from 'vitest';
import { shouldBootOnSignIn } from '../lib/auth-boot';

describe('shouldBootOnSignIn', () => {
  it('boots on the first sign-in (no current user)', () => {
    expect(shouldBootOnSignIn(null, 'idle', 'u1')).toBe(true);
    expect(shouldBootOnSignIn(undefined, 'idle', 'u1')).toBe(true);
  });

  it('does NOT re-boot the same, already-booted user (tab/app resume)', () => {
    expect(shouldBootOnSignIn('u1', 'ready', 'u1')).toBe(false);
  });

  it('boots when a different user signs in (account switch)', () => {
    expect(shouldBootOnSignIn('u1', 'ready', 'u2')).toBe(true);
  });

  it('re-boots the same user when the previous boot is not healthy', () => {
    expect(shouldBootOnSignIn('u1', 'error', 'u1')).toBe(true);
    expect(shouldBootOnSignIn('u1', 'idle', 'u1')).toBe(true);
    expect(shouldBootOnSignIn('u1', 'loading', 'u1')).toBe(true);
  });
});
