/**
 * rest-remaining.test.ts — restRemainingSeconds drives the rest countdown on
 * the workout bar while workout mode is closed (quick out-and-back during rest).
 */
import { describe, it, expect } from 'vitest';
import { restRemainingSeconds } from '../lib/workout-metrics';

describe('restRemainingSeconds', () => {
  it('is null when no rest is running', () => {
    expect(restRemainingSeconds(null, null, 0)).toBeNull();
    expect(restRemainingSeconds(null, 90, 0)).toBeNull();   // pending, not started
    expect(restRemainingSeconds(1000, 0, 1000)).toBeNull(); // zero-length rest
  });
  it('counts down whole seconds', () => {
    expect(restRemainingSeconds(10_000, 90, 10_000)).toBe(90);
    expect(restRemainingSeconds(10_000, 90, 10_999)).toBe(90);
    expect(restRemainingSeconds(10_000, 90, 40_000)).toBe(60);
  });
  it('clamps to 0 once expired (bar shows "Rest done")', () => {
    expect(restRemainingSeconds(10_000, 90, 100_000)).toBe(0);
    expect(restRemainingSeconds(10_000, 90, 10_000 + 90_000)).toBe(0);
  });
});
