/**
 * assignments.ts — pure helpers for Trainer Mode Track 3 (program authoring).
 *
 * No Supabase, no store access — unit-testable in isolation.
 *
 * An Assignment is a coach-authored FUTURE day: the same `exercises[]` shape as
 * a normal workout day, stored in `public.coach_assignments` (coach-owned). The
 * trainee reads it via an accepted link and MATERIALIZES it into their own blob
 * on first touch — only the trainee's client ever writes app_state, so the
 * single-writer invariant is preserved.
 */
import type { Exercise, WorkoutDay, DayOfWeek } from '../types/workout';

export interface Assignment {
  id: string;
  week: number;
  day: DayOfWeek;
  exercises: Exercise[];
  updatedAt: string | null;
}

/** Stable map key for a {week, day} anchor. */
export function assignmentKey(week: number, day: DayOfWeek | string): string {
  return `${week}|${day}`;
}

/** Index a flat assignment list into a key->assignment map (last write wins). */
export function indexAssignments(list: Assignment[]): Map<string, Assignment> {
  const m = new Map<string, Assignment>();
  for (const a of list) m.set(assignmentKey(a.week, a.day), a);
  return m;
}

/**
 * Seed a prescribed exercise list into trainee-owned "actual" exercises.
 *
 * Preserves structure EXACTLY — id, name, type, superset code, order, every set
 * and its prescribed kg/reps, rest, note. Resets ONLY the completion fields that
 * are the trainee's to fill: each set's `done`/`rpe`, plus recovery/conditioning
 * done flags. Keeping `id` keeps coach-note anchoring aligned across the flip.
 */
export function seedMaterializedExercises(exercises: Exercise[]): Exercise[] {
  return exercises.map((ex) => ({
    ...ex,
    sets: ex.sets.map((s) => ({ kg: s.kg, reps: s.reps, done: false, rpe: '' })),
    recoveryDone: false,
    conditioningDone: false,
  }));
}

/**
 * Build the WorkoutDay a first-touch materialization writes into the blob.
 * Pure: caller is responsible for persisting via the trainee's own client.
 */
export function materializedDay(
  week: number,
  day: DayOfWeek,
  date: string,
  exercises: Exercise[]
): WorkoutDay {
  return { week, day, date, exercises: seedMaterializedExercises(exercises), kind: 'workout' };
}

/**
 * Is this (week, day) already trainee-owned "actual"? True once the blob holds
 * the day WITH at least one exercise — from then the coach comments only.
 */
export function isActualDay(day: WorkoutDay | undefined): boolean {
  return !!day && day.exercises.length > 0;
}
