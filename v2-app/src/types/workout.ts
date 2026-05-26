// ============================================================
// DOMAIN TYPES — Timo Training V2
// Single source of truth for all workout data structures.
// ============================================================

export const DAY_ORDER = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
] as const;

export type DayOfWeek = typeof DAY_ORDER[number];

export type ExerciseType = 'single' | 'superset';

export interface WorkoutSet {
  kg: string;
  reps: string;
  done: boolean;
}

export interface Exercise {
  id: string;
  name: string;
  type: ExerciseType;
  /** Superset group code e.g. 'A', 'B' — empty string for singles */
  code: string;
  sets: WorkoutSet[];
  rest: string;
  note: string;
  /** Recovery / mobility block — no sets, just a done toggle */
  recovery: boolean;
  recoveryDone: boolean;
}

export interface WorkoutDay {
  week: number;
  day: DayOfWeek;
  /** ISO date string e.g. '2026-05-25' */
  date: string;
  exercises: Exercise[];
}

export interface AppState {
  weeks: WorkoutDay[];
  schema: '4.0';
}

export interface UIState {
  week: number;
  day: DayOfWeek;
  month: string; // 'YYYY-MM'
  search: string;
  /** Timer is running — workout has started */
  workoutActive: boolean;
  /** Focused overlay is open (block-by-block navigation) */
  workoutMode: boolean;
  activeExerciseIndex: number;
  radarMode: 'day' | 'week' | 'lifetime';
  calendarCollapsed: boolean;
  workoutStartTime: number | null; // Date.now() when workout started
}

// ---- Helpers ----

export function emptySet(): WorkoutSet {
  return { kg: '', reps: '', done: false };
}

export function emptyExercise(id: string, name: string): Exercise {
  return {
    id,
    name,
    type: 'single',
    code: '',
    sets: [emptySet()],
    rest: '',
    note: '',
    recovery: false,
    recoveryDone: false,
  };
}

export function emptyDay(week: number, day: DayOfWeek, date: string): WorkoutDay {
  return { week, day, date, exercises: [] };
}

export function emptyAppState(): AppState {
  return { weeks: [], schema: '4.0' };
}
