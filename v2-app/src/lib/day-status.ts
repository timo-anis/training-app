/**
 * Calendar day-status — pure, testable status derivation.
 * Single source of truth: dayFullyDone() is used by BOTH the calendar and
 * the HeroCard day-rings so they always agree.
 */
import type { WorkoutDay } from '../types/workout';

export type DayStatus =
  | 'done' | 'partial' | 'active-recovery' | 'has-data'
  | 'rest' | 'weekend' | 'future' | 'neutral';

/**
 * True only when every exercise on the day is fully completed.
 * Single source of truth used by calendar (computeDayStatus) and
 * HeroCard day-rings — both must import from here.
 */
export function dayFullyDone(wd: WorkoutDay): boolean {
  if (wd.exercises.length === 0) return false;
  return wd.exercises.every(ex => {
    if (ex.recovery) return ex.recoveryDone === true;
    if (ex.conditioning) return ex.conditioningDone === true;
    if (ex.sets.length === 0) return false;
    return ex.sets.every(s => s.done);
  });
}

/** Derive the calendar status for a resolved workout day (or undefined = no entry). */
export function computeDayStatus(workoutDay: WorkoutDay | undefined): DayStatus {
  const hasData = workoutDay && workoutDay.exercises.length > 0;

  if (hasData) {
    const wd = workoutDay!;
    const hasDoneWork = wd.exercises.some(ex =>
      ex.sets.some(s => s.done) || ex.conditioningDone || ex.recoveryDone);

    // Formally finished session (Finish workout button) keeps green with any done work
    if (wd.completed === true && hasDoneWork) return 'done';

    const nonRecovery = wd.exercises.filter(e => !e.recovery);

    // Recovery-only session
    if (nonRecovery.length === 0) {
      const allRecoveryDone = wd.exercises.every(e => e.recoveryDone === true);
      if (allRecoveryDone || wd.kind === 'recovery') return 'active-recovery';
      return 'has-data';
    }

    // Single source of truth — same function as HeroCard rings
    if (dayFullyDone(wd)) return 'done';

    // Partial progress
    const anyDone = wd.exercises.some(ex =>
      ex.sets.some(s => s.done) || ex.conditioningDone);
    if (anyDone) return 'partial';

    const hasRecovery = wd.exercises.some(e => e.recovery && e.recoveryDone);
    if (hasRecovery) return 'active-recovery';

    return 'has-data';
  }

  // No exercises — only explicit rest/recovery mark drives the look.
  // 'workout' kind is no longer used (removed from UI).
  switch (workoutDay?.kind) {
    case 'recovery': return 'active-recovery';
    case 'rest':     return 'rest';
    default:         return 'neutral';
  }
}
