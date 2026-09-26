/**
 * workout-nav.test.ts — linear A1→A2→B1… navigation for workout mode.
 * Regression for: superset arrows/Next cycling inside a superset forever, and
 * Prev disabled on A2 of the first block.
 */
import { describe, it, expect } from 'vitest';
import { stepCountsOf, stepNext, stepPrev, isFirstPos, isLastPos } from '../lib/workout-nav';

// Superset A (A1,A2) · single B · superset C (C1,C2,C3) · single D
const steps = [2, 1, 3, 1];

describe('workout-nav', () => {
  it('stepCountsOf: superset members count, everything else is one step', () => {
    expect(stepCountsOf([
      { isSuperset: true, exercises: [1, 2] },
      { isSuperset: false, exercises: [1] },
      { isSuperset: true, exercises: [1] },       // degenerate 1-member superset = 1 step
      { isSuperset: false, exercises: [1, 2] },   // non-superset block with 2 exercises = 1 step
    ])).toEqual([2, 1, 1, 1]);
  });

  it('Next walks A1 → A2 → B → C1 → C2 → C3 → D, then stops', () => {
    const seen: string[] = [];
    let p: { block: number; sub: number } | null = { block: 0, sub: 0 };
    while (p) { seen.push(`${p.block}.${p.sub}`); p = stepNext(steps, p); }
    expect(seen).toEqual(['0.0', '0.1', '1.0', '2.0', '2.1', '2.2', '3.0']);
  });

  it('Prev walks back and enters a superset on its LAST member', () => {
    expect(stepPrev(steps, { block: 3, sub: 0 })).toEqual({ block: 2, sub: 2 });
    expect(stepPrev(steps, { block: 1, sub: 0 })).toEqual({ block: 0, sub: 1 });
    expect(stepPrev(steps, { block: 0, sub: 1 })).toEqual({ block: 0, sub: 0 });
    expect(stepPrev(steps, { block: 0, sub: 0 })).toBeNull();
  });

  it('Prev is available on A2 of the FIRST block (the reported bug)', () => {
    expect(isFirstPos(steps, { block: 0, sub: 1 })).toBe(false);
    expect(isFirstPos(steps, { block: 0, sub: 0 })).toBe(true);
  });

  it('isLast only on the final exercise (Finish replaces Next there)', () => {
    expect(isLastPos(steps, { block: 3, sub: 0 })).toBe(true);
    expect(isLastPos(steps, { block: 2, sub: 2 })).toBe(false);
    expect(isLastPos([2], { block: 0, sub: 1 })).toBe(true);
  });

  it('empty workout and out-of-range positions are safe', () => {
    expect(stepNext([], { block: 0, sub: 0 })).toBeNull();
    expect(stepPrev([], { block: 0, sub: 0 })).toBeNull();
    expect(stepNext(steps, { block: 9, sub: 9 })).toBeNull();          // clamped to last
    expect(stepPrev(steps, { block: 0, sub: 7 })).toEqual({ block: 0, sub: 0 }); // clamped to A2
  });
});
