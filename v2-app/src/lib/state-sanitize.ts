/**
 * state-sanitize.ts — Normalize exercise names before any write to local or cloud.
 *
 * Why this exists:
 *   The "newer-wins" boot merge means a stale local cache can silently overwrite
 *   a manually-cleaned cloud blob. By normalizing at write time, dirty names are
 *   cleaned the moment any save is triggered — regardless of which source "won"
 *   the boot merge.
 *
 * This is a pure function: it never mutates the input and never throws.
 * Unknown names (custom entries not in EXERCISE_LIBRARY) pass through unchanged.
 */
import { normalizeExerciseName } from '../data/exercises';
import type { AppState } from '../types/workout';

export function sanitizeState(state: AppState): AppState {
  if (!state) return state;
  return {
    ...state,
    weeks: (state.weeks ?? []).map(wd => ({
      ...wd,
      exercises: (wd.exercises ?? []).map(ex => ({
        ...ex,
        name: normalizeExerciseName(ex.name),
      })),
    })),
  };
}
