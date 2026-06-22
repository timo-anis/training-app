/**
 * Tests for src/lib/rpe.ts — the RIR-based RPE auto-suggest math.
 *
 * The suggestion is a rough pre-fill: it must clamp to 6–10, round to 0.5,
 * and return null when it cannot suggest (missing inputs or no history).
 */
import { describe, it, expect } from 'vitest';
import { epley1RM, bestE1RM, suggestRpe } from '../lib/rpe';

describe('epley1RM', () => {
  it('returns the load itself at 0 reps', () => {
    expect(epley1RM(100, 0)).toBe(100);
  });
  it('adds reps/30 of the load', () => {
    expect(epley1RM(100, 6)).toBeCloseTo(120, 5); // 100 * (1 + 6/30)
  });
});

describe('bestE1RM', () => {
  it('is 0 for empty history', () => {
    expect(bestE1RM([])).toBe(0);
  });
  it('ignores blank / zero entries', () => {
    expect(bestE1RM([{ kg: '', reps: '' }, { kg: '0', reps: '5' }])).toBe(0);
  });
  it('takes the max Epley estimate across sets', () => {
    // 100x5 -> 116.67 ; 90x10 -> 120 ; max = 120
    expect(bestE1RM([{ kg: '100', reps: '5' }, { kg: '90', reps: '10' }])).toBeCloseTo(120, 5);
  });
  it('parses comma decimals', () => {
    expect(bestE1RM([{ kg: '100,5', reps: '1' }])).toBeCloseTo(100.5 * (1 + 1 / 30), 5);
  });
});

describe('suggestRpe', () => {
  it('returns null when kg is missing', () => {
    expect(suggestRpe('', '5', 120)).toBeNull();
  });
  it('returns null when reps is missing', () => {
    expect(suggestRpe('100', '', 120)).toBeNull();
  });
  it('returns null when there is no history (e1RM <= 0)', () => {
    expect(suggestRpe('100', '5', 0)).toBeNull();
  });
  it('suggests near the e1RM-implied effort', () => {
    // e1RM 120, today 100x5: predMax = 30*(120/100-1)=6 reps, RIR=1, RPE=9
    expect(suggestRpe('100', '5', 120)).toBe(9);
  });
  it('clamps to 10 when the load exceeds the estimated max', () => {
    expect(suggestRpe('130', '5', 120)).toBe(10);
  });
  it('clamps to 6 for very light loads', () => {
    expect(suggestRpe('40', '5', 120)).toBe(6);
  });
  it('rounds to the nearest half', () => {
    const v = suggestRpe('100', '5', 125)!;
    expect(v * 2).toBe(Math.round(v * 2)); // multiple of 0.5
    expect(v).toBeGreaterThanOrEqual(6);
    expect(v).toBeLessThanOrEqual(10);
  });
});
