/**
 * exercise-sort.ts — canonical ordering for exercises within a workout day.
 *
 * Single source of truth for superset ordering. Superset structure is a
 * non-negotiable data-integrity rule (WORKFLOW §2), so the comparator lives in
 * ONE tested place rather than duplicated inline across copy/edit paths — a
 * drift between copies would silently reorder supersets differently depending on
 * which action produced the day.
 *
 * Order: recovery blocks last; then by superset code LETTER (A < B < C …); then
 * by numeric suffix (A1 < A2 < A3). Codes that don't match /^([A-Z])(\d+)?$/
 * sort after coded exercises and keep their relative input order (stable sort).
 *
 * Pure and non-mutating: returns a new array, never touches the input.
 */
import type { Exercise } from '../types/workout';

/** Comparator: recovery last, then code letter, then numeric suffix. */
export function compareByExerciseCode(a: Exercise, b: Exercise): number {
  const aC = a.code.match(/^([A-Z])(\d+)?$/);
  const bC = b.code.match(/^([A-Z])(\d+)?$/);
  if (a.recovery !== b.recovery) return a.recovery ? 1 : -1;
  if (aC && bC) {
    if (aC[1] !== bC[1]) return aC[1].localeCompare(bC[1]);
    return (Number(aC[2]) || 0) - (Number(bC[2]) || 0);
  }
  if (aC && !bC) return -1;
  if (!aC && bC) return 1;
  return 0;
}

/** Canonical superset order (A1 < A2 < B1 < B2, recovery last). Non-mutating. */
export function sortByExerciseCode(exercises: Exercise[]): Exercise[] {
  return [...exercises].sort(compareByExerciseCode);
}
