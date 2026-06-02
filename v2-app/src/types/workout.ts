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
  /** Conditioning block (bike, row, etc.) — free-text log instead of sets */
  conditioning: boolean;
  conditioningNote: string;
  /** Explicit done toggle for conditioning exercises */
  conditioningDone: boolean;
}

/** User-set day intent. Undefined = unmarked (neutral). */
export type DayKind = 'workout' | 'recovery' | 'rest';

export interface WorkoutDay {
  week: number;
  day: DayOfWeek;
  /** ISO date string e.g. '2026-05-25' */
  date: string;
  exercises: Exercise[];
  /** Set to true when user taps "Finish Training" — drives green calendar dot */
  completed?: boolean;
  /** Free-text session note — logged during or after workout */
  note?: string;
  /** User-marked day type (workout / recovery / rest). Undefined = unmarked. */
  kind?: DayKind;
}

export interface AppState {
  weeks: WorkoutDay[];
  schema: '4.0';
  /**
   * Absolute week number when this user started training.
   * Display week = absoluteWeek - (userStartWeek - 1).
   * Existing users: 1 (no change). New users: current week at signup.
   * Set once on first boot, never changes.
   */
  userStartWeek?: number;
}

export interface UIState {
  week: number;
  day: DayOfWeek;
  search: string;
  /** Timer is running — workout has started */
  workoutActive: boolean;
  /** Focused overlay is open (block-by-block navigation) */
  workoutMode: boolean;
  activeExerciseIndex: number;
  radarMode: 'day' | 'week' | 'lifetime';
  calendarCollapsed: boolean;
  workoutStartTime: number | null; // Date.now() when workout started
  // Rest timer — stored in state so it survives overlay close/reopen
  restStartTime: number | null;    // Date.now() when current rest started
  restTotal: number | null;        // total rest duration in seconds
  /** Exercise name to scroll into view after navigation (cleared after use) */
  highlightExercise: string | null;
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
    conditioning: false,
    conditioningNote: '',
    conditioningDone: false,
  };
}

export function emptyDay(week: number, day: DayOfWeek, date: string): WorkoutDay {
  return { week, day, date, exercises: [] };
}

export function emptyAppState(): AppState {
  return { weeks: [], schema: '4.0' };
}
