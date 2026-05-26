import { writable, derived, get } from 'svelte/store';
import type { User } from '@supabase/supabase-js';
import type { AppState, UIState, DayOfWeek, WorkoutDay, Exercise } from '../types/workout';
import { emptyAppState, emptyExercise, DAY_ORDER } from '../types/workout';
import { bootstrapState, saveLocal, saveCloud } from '../services/storage';

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
  workoutMode: false,
  activeExerciseIndex: 0,
  radarMode: 'day',
  calendarCollapsed: false,
});

// ---- Boot status ----
export type BootStatus = 'idle' | 'loading' | 'ready' | 'error';
export const bootStatus = writable<BootStatus>('idle');

// ---- Derived: all weeks that have data ----
export const availableWeeks = derived(appState, ($state) => {
  const weeks = new Set($state.weeks.map(w => w.week));
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
