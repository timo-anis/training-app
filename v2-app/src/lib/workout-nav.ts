/**
 * workout-nav.ts — linear exercise-by-exercise navigation in workout mode.
 *
 * Before: Prev/Next cycled INSIDE an incomplete superset (A1→A2→A1…) and only
 * left it once every set was done; the superset ‹ › arrows cycled forever; and
 * Prev was disabled on the first block even when standing on A2. Timo couldn't
 * move from superset A to B, or back from A2 to A1.
 *
 * Now every control walks one ordered list: A1 → A2 → B1 → B2 → C …
 * A superset contributes one step per member; any other block is one step.
 * Pure so it is unit-testable; WorkoutMode maps a position onto
 * (activeExerciseIndex, activeSubIndex).
 */
export interface NavPos { block: number; sub: number }

/** Number of steps a block contributes (superset members, else 1). */
export type BlockSteps = readonly number[];

export function stepCountsOf(blocks: readonly { isSuperset: boolean; exercises: readonly unknown[] }[]): number[] {
  return blocks.map(b => (b.isSuperset && b.exercises.length > 1 ? b.exercises.length : 1));
}

function norm(steps: BlockSteps, pos: NavPos): NavPos {
  const block = Math.max(0, Math.min(pos.block, steps.length - 1));
  const sub = Math.max(0, Math.min(pos.sub, (steps[block] ?? 1) - 1));
  return { block, sub };
}

/** Next position, or null at the very last exercise. */
export function stepNext(steps: BlockSteps, pos: NavPos): NavPos | null {
  if (steps.length === 0) return null;
  const p = norm(steps, pos);
  if (p.sub < steps[p.block] - 1) return { block: p.block, sub: p.sub + 1 };
  if (p.block < steps.length - 1) return { block: p.block + 1, sub: 0 };
  return null;
}

/** Previous position (entering a superset backwards lands on its LAST member), or null at the very first. */
export function stepPrev(steps: BlockSteps, pos: NavPos): NavPos | null {
  if (steps.length === 0) return null;
  const p = norm(steps, pos);
  if (p.sub > 0) return { block: p.block, sub: p.sub - 1 };
  if (p.block > 0) return { block: p.block - 1, sub: steps[p.block - 1] - 1 };
  return null;
}

export function isFirstPos(steps: BlockSteps, pos: NavPos): boolean {
  return stepPrev(steps, pos) === null;
}

export function isLastPos(steps: BlockSteps, pos: NavPos): boolean {
  return stepNext(steps, pos) === null;
}
