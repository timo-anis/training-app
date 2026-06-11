/**
 * Calendar day-status — pure, testable status derivation.
 * Extracted from MonthCalendar so the branching (esp. the "green only with real
 * done work" rule) can be unit-tested directly.
 */
import type { WorkoutDay } from '../types/workout';

export type DayStatus =
  | 'done' | 'partial' | 'active-recovery' | 'has-data'
  | 'rest' | 'weekend' | 'future' | 'neutral';

/** Derive the calendar status for a resolved workout day (or undefined = no entry). */
export function computeDayStatus(workoutDay: WorkoutDay | undefined): DayStatus {
  const hasData = workoutDay && workoutDay.exercises.length > 0;

  if (hasData) {
    // A finished day stays green only while it still has real done work —
    // un-checking every set clears the green ring.
    const hasDoneWork = workoutDay!.exercises.some(ex =>
      ex.sets.some(s => s.done) || ex.conditioningDone || ex.recoveryDone);
    if (workoutDay!.completed === true && hasDoneWork) return 'done';

    const nonRecovery = workoutDay!.exercises.filter(e => !e.recovery);
    const hasRecovery = workoutDay!.exercises.some(e => e.recovery && e.recoveryDone);
    if (nonRecovery.length === 0) {
      if (hasRecovery || workoutDay!.kind === 'recovery') return 'active-recovery';
      return 'has-data';
    }
    const allDone = nonRecovery.every(ex => ex.sets.length > 0 && ex.sets.every(s => s.done));
    if (allDone) return 'done';
    const anyDone = nonRecovery.some(ex => ex.sets.some(s => s.done));
    if (anyDone) return 'partial';
    if (hasRecovery) return 'active-recovery';
    return 'has-data';
  }

  // No logged exercises — the user's explicit day mark drives the look.
  switch (workoutDay?.kind) {
    case 'workout':  return 'has-data';
    case 'recovery': return 'active-recovery';
    case 'rest':     return 'rest';
    default:         return 'neutral';
  }
}
