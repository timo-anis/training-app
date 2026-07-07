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
    // Set shape pinned to schema 4.1 (kg, reps, done, rpe). If WorkoutSet gains a
    // field, add it here or it is silently dropped on materialize (L3 audit fix).
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

// ---------------------------------------------------------------------------
// Coach planning helpers (trainer-feedback 2026-07-06): week day-strip states,
// plan-exercise cleaning, and whole-week copy. Pure — no store/Supabase access.
// ---------------------------------------------------------------------------

/** How a (week, day) reads on the coach's week strip. */
export type PlanDayState = 'actual' | 'planned' | 'empty';

/**
 * State of every weekday in one week, for the coach week strip.
 * 'actual' wins over 'planned' (trainee-owned day; coach comments only).
 */
export function weekDayStates(
  weeks: WorkoutDay[],
  assignments: Record<string, Assignment>,
  week: number,
  dayOrder: readonly DayOfWeek[]
): Record<DayOfWeek, PlanDayState> {
  const out = {} as Record<DayOfWeek, PlanDayState>;
  for (const day of dayOrder) {
    const actual = weeks.some((w) => w.week === week && w.day === day && w.exercises.length > 0);
    const planned = (assignments[assignmentKey(week, day)]?.exercises.length ?? 0) > 0;
    out[day] = actual ? 'actual' : planned ? 'planned' : 'empty';
  }
  return out;
}

/**
 * Prepare an exercise for a coach plan: deep-clone, fresh id (keeps coach-note
 * anchors of OTHER days untouched — two days must never share exercise ids),
 * completion fields reset. kg/reps/rest/note/code/order preserved.
 */
export function cleanForPlan(ex: Exercise): Exercise {
  const c = JSON.parse(JSON.stringify(ex)) as Exercise;
  return {
    ...c,
    id: `${ex.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    sets: (c.sets.length ? c.sets : [{ kg: '', reps: '', done: false, rpe: '' }])
      .map((s) => ({ kg: s.kg, reps: s.reps, done: false, rpe: '' })),
    recoveryDone: false,
    conditioningDone: false,
  };
}

/** One copyable source day: the coach plan if present, else the trainee log. */
export interface WeekCopyDay {
  day: DayOfWeek;
  exercises: Exercise[];
  from: 'plan' | 'log';
}

/** A source week the coach can copy from. */
export interface WeekCopySource {
  week: number;
  days: WeekCopyDay[];
}

/**
 * Every week (except excludeWeek) that has at least one plannable day.
 * Per day the coach plan wins over the trainee log. Sorted newest first.
 */
export function listWeekCopySources(
  weeks: WorkoutDay[],
  assignments: Record<string, Assignment>,
  excludeWeek: number,
  dayOrder: readonly DayOfWeek[]
): WeekCopySource[] {
  const weekNums = new Set<number>();
  for (const w of weeks) if (w.exercises.length > 0) weekNums.add(w.week);
  for (const a of Object.values(assignments)) if (a.exercises.length > 0) weekNums.add(a.week);
  weekNums.delete(excludeWeek);

  const sources: WeekCopySource[] = [];
  for (const week of [...weekNums].sort((a, b) => b - a)) {
    const days: WeekCopyDay[] = [];
    for (const day of dayOrder) {
      const plan = assignments[assignmentKey(week, day)];
      if (plan && plan.exercises.length > 0) {
        days.push({ day, exercises: plan.exercises, from: 'plan' });
        continue;
      }
      const log = weeks.find((w) => w.week === week && w.day === day && w.exercises.length > 0);
      if (log) days.push({ day, exercises: log.exercises, from: 'log' });
    }
    if (days.length > 0) sources.push({ week, days });
  }
  return sources;
}

/** Result of planning a week copy: what to write, what was protected. */
export interface WeekCopyPlan {
  /** Per target day, cleaned exercises ready for writeAssignment. */
  writes: { day: DayOfWeek; exercises: Exercise[] }[];
  /** Target days skipped because the trainee already owns them (actual). */
  skippedActual: DayOfWeek[];
}

/**
 * Copy a whole source week into a target week. NEVER writes a target day the
 * trainee has started (actual) — those are skipped and reported. Target days
 * that only hold an old plan are replaced. Exercises are cleaned via
 * cleanForPlan (fresh ids, completion reset, structure/order/codes preserved).
 */
export function buildWeekCopyPlan(
  sourceDays: WeekCopyDay[],
  targetActualDays: ReadonlySet<DayOfWeek>
): WeekCopyPlan {
  const writes: WeekCopyPlan['writes'] = [];
  const skippedActual: DayOfWeek[] = [];
  for (const d of sourceDays) {
    if (targetActualDays.has(d.day)) { skippedActual.push(d.day); continue; }
    writes.push({ day: d.day, exercises: d.exercises.map(cleanForPlan) });
  }
  return { writes, skippedActual };
}
