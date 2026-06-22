// Pure helpers for the coach-notes annotation layer (Track 2).
// No side effects / no Supabase — safe to unit-test in isolation.
import type { CoachNote } from '../services/coach';

/** Stable map key for an annotation anchor.
 *  exerciseId === null => day-level note; otherwise exercise-level. */
export function anchorKey(week: number, day: string, exerciseId: string | null): string {
  return `${week}|${day}|${exerciseId ?? '__day__'}`;
}

/** Index a flat note list into an anchor-keyed map (last write wins per anchor). */
export function indexNotes(notes: CoachNote[]): Record<string, CoachNote> {
  const m: Record<string, CoachNote> = {};
  for (const n of notes) m[anchorKey(n.week, n.day, n.exerciseId)] = n;
  return m;
}
