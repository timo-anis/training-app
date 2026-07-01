/**
 * state-sanitize.ts — Normalize and validate the AppState blob before any
 * write to local storage or cloud.
 *
 * Why this exists:
 *   The "newer-wins" boot merge means a stale local cache can silently overwrite
 *   a manually-cleaned cloud blob. By normalizing at write time, dirty data is
 *   cleaned the moment any save is triggered — regardless of which source "won"
 *   the boot merge.
 *
 * This is a pure function: it never mutates the input and never throws.
 * Unknown exercise names (custom entries not in EXERCISE_LIBRARY) pass through
 * unchanged — only the clearly invalid values are fixed or filtered.
 */
import { normalizeExerciseName } from '../data/exercises';
import type { AppState, WorkoutDay, Exercise, WorkoutSet } from '../types/workout';

/** ISO-8601 date string YYYY-MM-DD */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Remove a leading minus from a numeric string: '-5' → '5', '10' → '10'. */
function clampNumericString(val: string): string {
  if (typeof val !== 'string') return '';
  const trimmed = val.trim();
  // Strip leading minus — negative reps/kg are physically impossible.
  return trimmed.startsWith('-') ? trimmed.slice(1) : trimmed;
}

function sanitizeSet(s: WorkoutSet): WorkoutSet {
  return {
    ...s,
    reps: clampNumericString(s.reps ?? ''),
    kg:   clampNumericString(s.kg   ?? ''),
    done: !!s.done,
    rpe:  s.rpe ?? '',
  };
}

function sanitizeExercise(ex: Exercise): Exercise {
  const name = normalizeExerciseName(ex.name);
  // An exercise claiming to be a superset but with no code can never be grouped
  // correctly by buildWorkoutBlocks (groups by code[0]). Demote to single.
  const type = ex.type === 'superset' && !ex.code?.trim() ? 'single' : ex.type;
  return {
    ...ex,
    name,
    type,
    sets: (ex.sets ?? [])
      .filter(s => s != null)
      .map(sanitizeSet),
  };
}

function sanitizeWorkoutDay(wd: WorkoutDay): WorkoutDay {
  return {
    ...wd,
    exercises: (wd.exercises ?? [])
      .filter(ex => ex != null)
      .map(sanitizeExercise),
  };
}

export function sanitizeState(state: AppState): AppState {
  if (!state) return state;
  return {
    ...state,
    weeks: (state.weeks ?? [])
      .filter(wd => wd != null)
      // Drop WorkoutDays whose date field is not a valid ISO-8601 date string.
      // Such days cannot be rendered or sorted correctly and indicate corruption.
      .filter(wd => !wd.date || ISO_DATE_RE.test(wd.date))
      .map(sanitizeWorkoutDay),
  };
}
