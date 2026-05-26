import { writable, derived, get } from 'svelte/store';
import type { User } from '@supabase/supabase-js';
import type { AppState, UIState, DayOfWeek, WorkoutDay, Exercise } from '../types/workout';
import { emptyAppState, emptyExercise, DAY_ORDER } from '../types/workout';
import { bootstrapState, saveLocal, saveCloud, detectMvp1Data, importFromMvp1 } from '../services/storage';

// ---- Auth store ----
export const currentUser = writable<User | null>(null);

// ---- App state store ----
export const appState = writable<AppState>(emptyAppState());

// ---- UI state store ----
const today = new Date();
const defaultDay = DAY_ORDER[today.getDay() === 0 ? 6 : today.getDay() - 1];
const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

export const uiState = writable<UIState>({
  week: 1,
  day: defaultDay,
  month: defaultMonth,
  search: '',
  workoutActive: false,
  workoutMode: false,
  activeExerciseIndex: 0,
  radarMode: 'day',
  calendarCollapsed: false,
  workoutStartTime: null,
  restStartTime: null,
  restTotal: null,
});

// ---- Boot status ----
export type BootStatus = 'idle' | 'loading' | 'ready' | 'error';
export const bootStatus = writable<BootStatus>('idle');

// ---- Derived: all weeks that have data + current selected week ----
export const availableWeeks = derived([appState, uiState], ([$state, $ui]) => {
  const weeks = new Set($state.weeks.map(w => w.week));
  weeks.add($ui.week); // always include current (handles new empty week)
  if (!weeks.size) weeks.add(1);
  return Array.from(weeks).sort((a, b) => a - b);
});

// ---- Derived: days with data in current week ----
export const currentWeekDays = derived([appState, uiState], ([$state, $ui]) =>
  $state.weeks.filter(w => w.week === $ui.week)
);

// ---- Derived: current day exercises ----
export const currentDayExercises = derived(
  [appState, uiState],
  ([$state, $ui]) => {
    const day = $state.weeks.find(
      w => w.week === $ui.week && w.day === $ui.day
    );
    return day?.exercises ?? [];
  }
);

// ---- Derived: latest week (for default selection after boot) ----
export const latestWeek = derived(availableWeeks, ($weeks) =>
  $weeks[$weeks.length - 1] ?? 1
);

// ---- Workout blocks ----
// A block is either a single exercise or a superset group (same code)
export interface WorkoutBlock {
  id: string;           // unique block id
  exercises: Exercise[]; // 1 for single, 2+ for superset
  isSuperset: boolean;
  code: string;         // superset code e.g. 'A', or '' for single
}

export const workoutBlocks = derived(currentDayExercises, ($exercises) => {
  const blocks: WorkoutBlock[] = [];
  const seenCodes = new Set<string>();

  for (const ex of $exercises) {
    if (ex.type === 'single' || !ex.code) {
      blocks.push({ id: ex.id, exercises: [ex], isSuperset: false, code: '' });
    } else {
      // Superset — group by code
      if (!seenCodes.has(ex.code)) {
        seenCodes.add(ex.code);
        const group = $exercises.filter(e => e.type === 'superset' && e.code === ex.code);
        blocks.push({ id: `superset_${ex.code}`, exercises: group, isSuperset: true, code: ex.code });
      }
    }
  }
  return blocks;
});

// ---- Progression: find last session for an exercise by name ----
export interface LastSession {
  week: number;
  day: DayOfWeek;
  sets: { kg: string; reps: string }[];
}

export function findLastSession(
  state: AppState,
  name: string,
  currentWeek: number,
  currentDay: DayOfWeek
): LastSession | null {
  const lower = name.toLowerCase();
  let result: LastSession | null = null;
  let bestWeek = -1;
  let bestDayIdx = -1;

  for (const wd of state.weeks) {
    // Skip current day
    if (wd.week === currentWeek && wd.day === currentDay) continue;

    for (const ex of wd.exercises) {
      if (ex.name.toLowerCase() !== lower) continue;
      if (ex.sets.length === 0) continue;

      const dayIdx = DAY_ORDER.indexOf(wd.day);

      // Pick the most recent: higher week wins; same week → later day wins
      const isBetter =
        wd.week > bestWeek ||
        (wd.week === bestWeek && dayIdx > bestDayIdx);

      if (isBetter) {
        bestWeek = wd.week;
        bestDayIdx = dayIdx;
        result = {
          week: wd.week,
          day: wd.day,
          sets: ex.sets.map(s => ({ kg: s.kg, reps: s.reps })),
        };
      }
    }
  }

  return result;
}

// ---- Progression: find last conditioning note for an exercise by name ----
export function findLastConditioningNote(
  state: AppState,
  name: string,
  currentWeek: number,
  currentDay: DayOfWeek
): string {
  const lower = name.toLowerCase();
  let result = '';
  let bestWeek = -1;
  let bestDayIdx = -1;

  for (const wd of state.weeks) {
    if (wd.week === currentWeek && wd.day === currentDay) continue;
    for (const ex of wd.exercises) {
      if (ex.name.toLowerCase() !== lower) continue;
      if (!ex.conditioning) continue;
      if (!ex.conditioningNote) continue;
      const dayIdx = DAY_ORDER.indexOf(wd.day);
      const isBetter =
        wd.week > bestWeek ||
        (wd.week === bestWeek && dayIdx > bestDayIdx);
      if (isBetter) {
        bestWeek = wd.week;
        bestDayIdx = dayIdx;
        result = ex.conditioningNote;
      }
    }
  }

  return result;
}

// ---- Add new week ----
export function addNewWeek() {
  const state = get(appState);
  const weeks = state.weeks.map(w => w.week);
  const nextWeek = weeks.length > 0 ? Math.max(...weeks) + 1 : 1;
  uiState.update(ui => ({ ...ui, week: nextWeek }));
}

// ---- Copy previous week's same day to current day ----
export function copyPreviousDay(targetWeek: number, day: DayOfWeek) {
  const state = get(appState);
  const sourceWeek = targetWeek - 1;

  const sourceDay = state.weeks.find(w => w.week === sourceWeek && w.day === day);
  if (!sourceDay || sourceDay.exercises.length === 0) return;

  // Remove existing target day if any
  const filtered = state.weeks.filter(w => !(w.week === targetWeek && w.day === day));

  const cloned: WorkoutDay = {
    week: targetWeek,
    day,
    date: getDateForWeekDay(targetWeek, day),
    exercises: sourceDay.exercises.map(ex => ({
      ...ex,
      id: `${ex.id}_w${targetWeek}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      // Pre-fill with previous week's kg/reps, done reset; conditioning note cleared (fresh session)
      sets: ex.sets.map(s => ({ kg: s.kg, reps: s.reps, done: false })),
      recoveryDone: false,
      conditioningNote: '',
    })),
  };

  updateState(() => ({ ...state, weeks: [...filtered, cloned] }));
}

// ---- Workout mode actions ----

/** Start the workout timer — keeps normal view open */
export function startWorkout() {
  uiState.update(ui => ({
    ...ui,
    workoutActive: true,
    workoutStartTime: ui.workoutStartTime ?? Date.now(),
  }));
}

/** Open the focused block-by-block overlay */
export function openWorkoutMode() {
  uiState.update(ui => ({
    ...ui,
    workoutActive: true,
    workoutMode: true,
    activeExerciseIndex: 0,
    workoutStartTime: ui.workoutStartTime ?? Date.now(),
  }));
}

/** Close the overlay but keep the timer running */
export function closeWorkoutMode() {
  uiState.update(ui => ({ ...ui, workoutMode: false }));
}

/** Finish workout entirely — stop timer, close overlay */
export function exitWorkout() {
  uiState.update(ui => ({
    ...ui,
    workoutActive: false,
    workoutMode: false,
    activeExerciseIndex: 0,
    workoutStartTime: null,
  }));
}

export function setActiveBlock(index: number) {
  uiState.update(ui => ({ ...ui, activeExerciseIndex: index }));
}

// ---- Actions ----

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave(userId: string, state: AppState) {
  saveLocal(userId, state);
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveCloud(userId, state);
  }, 3000);
}

export async function bootForUser(user: User) {
  bootStatus.set('loading');
  try {
    const state = await bootstrapState(user.id);
    appState.set(state);
    // Auto-select latest week after boot
    const weeks = new Set(state.weeks.map(w => w.week));
    const latest = weeks.size ? Math.max(...weeks) : 1;
    uiState.update(ui => ({ ...ui, week: latest }));
    bootStatus.set('ready');
  } catch {
    bootStatus.set('error');
  }
}

export function updateState(updater: (s: AppState) => AppState) {
  appState.update(s => {
    const next = updater(s);
    const user = get(currentUser);
    if (user) scheduleSave(user.id, next);
    return next;
  });
}

export function updateUI(updater: (s: UIState) => UIState) {
  uiState.update(updater);
}

// ---- Shared exercise updater ----
function mapExercise(
  state: AppState,
  week: number,
  day: DayOfWeek,
  exId: string,
  updater: (ex: Exercise) => Exercise
): AppState {
  return {
    ...state,
    weeks: state.weeks.map(w => {
      if (w.week !== week || w.day !== day) return w;
      return {
        ...w,
        exercises: w.exercises.map(ex => ex.id === exId ? updater(ex) : ex),
      };
    }),
  };
}

// ---- Update exercise metadata ----
export function updateExerciseMeta(
  week: number,
  day: DayOfWeek,
  exId: string,
  fields: Partial<Pick<Exercise, 'name' | 'rest' | 'note' | 'type' | 'code' | 'conditioning'>>
) {
  updateState(state =>
    mapExercise(state, week, day, exId, ex => ({ ...ex, ...fields }))
  );
}

// ---- Update conditioning note ----
export function updateConditioningNote(week: number, day: DayOfWeek, exId: string, note: string) {
  updateState(state =>
    mapExercise(state, week, day, exId, ex => ({ ...ex, conditioningNote: note }))
  );
}

// ---- Move exercise up or down ----
export function moveExercise(week: number, day: DayOfWeek, exId: string, direction: 'up' | 'down') {
  updateState(state => ({
    ...state,
    weeks: state.weeks.map(w => {
      if (w.week !== week || w.day !== day) return w;
      const exs = [...w.exercises];
      const idx = exs.findIndex(e => e.id === exId);
      if (idx === -1) return w;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= exs.length) return w;
      [exs[idx], exs[swapIdx]] = [exs[swapIdx], exs[idx]];
      return { ...w, exercises: exs };
    }),
  }));
}

// ---- Toggle set done ----
export function toggleSetDone(week: number, day: DayOfWeek, exId: string, setIndex: number) {
  updateState(state =>
    mapExercise(state, week, day, exId, ex => ({
      ...ex,
      sets: ex.sets.map((s, i) => i === setIndex ? { ...s, done: !s.done } : s),
    }))
  );
}

// ---- Update set field (kg or reps) ----
export function updateSetField(
  week: number,
  day: DayOfWeek,
  exId: string,
  setIndex: number,
  field: 'kg' | 'reps',
  value: string
) {
  updateState(state =>
    mapExercise(state, week, day, exId, ex => ({
      ...ex,
      sets: ex.sets.map((s, i) => i === setIndex ? { ...s, [field]: value } : s),
    }))
  );
}

// ---- Add set (copy last set's values, clear done) ----
export function addSet(week: number, day: DayOfWeek, exId: string) {
  updateState(state =>
    mapExercise(state, week, day, exId, ex => {
      const last = ex.sets[ex.sets.length - 1];
      return {
        ...ex,
        sets: [...ex.sets, { kg: last?.kg ?? '', reps: last?.reps ?? '', done: false }],
      };
    })
  );
}

// ---- Date helper ----
const PROGRAM_START = new Date('2026-02-16T00:00:00');
const DAY_OFFSET: Record<DayOfWeek, number> = {
  Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3,
  Friday: 4, Saturday: 5, Sunday: 6,
};

function getDateForWeekDay(week: number, day: DayOfWeek): string {
  const d = new Date(PROGRAM_START);
  d.setDate(d.getDate() + (week - 1) * 7 + DAY_OFFSET[day]);
  return d.toISOString().slice(0, 10);
}

// ---- Add exercise ----
export function addExercise(week: number, day: DayOfWeek, name: string) {
  const id = `${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
  updateState(state => {
    const exists = state.weeks.find(w => w.week === week && w.day === day);
    if (exists) {
      return {
        ...state,
        weeks: state.weeks.map(w => {
          if (w.week !== week || w.day !== day) return w;
          return { ...w, exercises: [...w.exercises, emptyExercise(id, name)] };
        }),
      };
    }
    // Day doesn't exist yet — create it
    const date = getDateForWeekDay(week, day);
    const newDay: WorkoutDay = { week, day, date, exercises: [emptyExercise(id, name)] };
    return { ...state, weeks: [...state.weeks, newDay] };
  });
}

// ---- Delete set ----
export function deleteSet(week: number, day: DayOfWeek, exId: string, setIndex: number) {
  updateState(state =>
    mapExercise(state, week, day, exId, ex => ({
      ...ex,
      sets: ex.sets.filter((_, i) => i !== setIndex),
    }))
  );
}

// ---- Toggle recovery block done ----
export function toggleRecoveryDone(week: number, day: DayOfWeek, exId: string) {
  updateState(state =>
    mapExercise(state, week, day, exId, ex => ({ ...ex, recoveryDone: !ex.recoveryDone }))
  );
}

// ---- Delete exercise ----
export function deleteExercise(week: number, day: DayOfWeek, exId: string) {
  updateState(state => ({
    ...state,
    weeks: state.weeks.map(w => {
      if (w.week !== week || w.day !== day) return w;
      return { ...w, exercises: w.exercises.filter(ex => ex.id !== exId) };
    }),
  }));
}

// ---- MVP1 migration ----

// Reactive: true if MVP1 data exists in localStorage for current user
export const hasMvp1Data = derived(currentUser, ($user) => {
  if (!$user) return false;
  return detectMvp1Data($user.id);
});

// Import MVP1 data, overwrite V2 state, save
export function runMvp1Import(): boolean {
  const user = get(currentUser);
  if (!user) return false;

  const migrated = importFromMvp1(user.id);
  if (!migrated || migrated.weeks.length === 0) return false;

  appState.set(migrated);
  saveLocal(user.id, migrated);
  saveCloud(user.id, migrated);

  // Jump to latest week
  const maxWeek = Math.max(...migrated.weeks.map(w => w.week));
  uiState.update(ui => ({ ...ui, week: maxWeek }));

  return true;
}
