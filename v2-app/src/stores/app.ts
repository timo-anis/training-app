import { writable, derived, get } from 'svelte/store';
import type { User } from '@supabase/supabase-js';
import type { AppState, UIState, DayOfWeek, WorkoutDay, Exercise, WorkoutSet } from '../types/workout';
import { emptyAppState, emptyExercise, DAY_ORDER } from '../types/workout';
import { bootstrapState, saveLocal, saveCloud, detectMvp1Data, importFromMvp1 } from '../services/storage';
import { PS_UTC } from '../lib/program';
import { getDateForWeekDay, DAY_OFFSET } from '../lib/dates';
import {
  mapExercise,
  toggleSetDoneInState,
  deleteSetFromState,
  insertSetInState,
  addSetToState,
  updateSetFieldInState,
  deleteExerciseFromState,
  renameExerciseInState,
  moveExerciseInState,
  buildWorkoutBlocks as _buildWorkoutBlocks,
} from '../lib/state-helpers';

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
  highlightExercise: null,
});

// ---- Boot status ----
export type BootStatus = 'idle' | 'loading' | 'ready' | 'error';
export const bootStatus = writable<BootStatus>('idle');

// ---- Toast notifications ----
export interface Toast { msg: string; type: 'error' | 'success' | 'info'; }
export const toast = writable<Toast | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function showToast(msg: string, type: Toast['type'] = 'info') {
  if (toastTimer) clearTimeout(toastTimer);
  toast.set({ msg, type });
  toastTimer = setTimeout(() => toast.set(null), 4000);
}

// ---- Search overlay (global, rendered at App level) ----
export const searchOpen = writable<boolean>(false);

// ---- Week display offset ----
// displayWeek = absoluteWeek - weekOffset
// Timo (userStartWeek=1): offset=0, no change.
// New user joining at week 16: offset=15, their Week 1 = absolute week 16.
export const weekOffset = derived(appState, $s => ($s.userStartWeek ?? 1) - 1);

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

export const workoutBlocks = derived(currentDayExercises, ($exercises) =>
  _buildWorkoutBlocks($exercises)
);

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
      // Pre-fill with previous week's kg/reps; all done states reset; conditioning note cleared
      sets: ex.sets.map(s => ({ kg: s.kg, reps: s.reps, done: false })),
      recoveryDone: false,
      conditioningDone: false,
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

/** Mark current workout day as completed — triggers green in calendar */
export function markWorkoutComplete(week: number, day: DayOfWeek) {
  updateState(state => ({
    ...state,
    weeks: state.weeks.map(w =>
      w.week === week && w.day === day ? { ...w, completed: true } : w
    ),
  }), true);
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

function scheduleSave(userId: string, state: AppState, immediate = false) {
  saveLocal(userId, state);
  if (saveTimer) clearTimeout(saveTimer);
  if (immediate) {
    // Fire-and-forget — don't await, don't block the UI
    saveTimer = null;
    saveCloud(userId, state);
  } else {
    saveTimer = setTimeout(async () => {
      const ok = await saveCloud(userId, state);
      if (!ok) showToast('Cloud sync failed — data saved locally', 'error');
    }, 3000);
  }
}

// ---- One-time migration: mark all past training days complete ----
// Runs on boot. Marks completed=true + all sets done=true for every
// WorkoutDay that has exercises and is strictly before today.
const MIGRATION_PS_UTC = PS_UTC;

function applyPastDaysCompleted(state: AppState): { state: AppState; changed: boolean } {
  const todayUTC = (() => {
    const t = new Date();
    return Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
  })();

  let changed = false;

  const weeks = state.weeks.map(wd => {
    if (wd.exercises.length === 0) return wd;

    const dayIdx = DAY_ORDER.indexOf(wd.day);
    const dayUTC = MIGRATION_PS_UTC + ((wd.week - 1) * 7 + dayIdx) * 86400000;
    if (dayUTC >= todayUTC) return wd; // today or future — skip

    // Check if already fully done
    const alreadyDone =
      wd.completed === true &&
      wd.exercises.every(ex => {
        if (ex.recovery) return ex.recoveryDone;
        if (ex.conditioning) return ex.conditioningDone === true;
        return ex.sets.every(s => s.done);
      });
    if (alreadyDone) return wd;

    changed = true;
    return {
      ...wd,
      completed: true,
      exercises: wd.exercises.map(ex => ({
        ...ex,
        recoveryDone: ex.recovery ? true : ex.recoveryDone,
        conditioningDone: ex.conditioning ? true : ex.conditioningDone,
        sets: ex.sets.map(s => ({ ...s, done: true })),
      })),
    };
  });

  return { state: changed ? { ...state, weeks } : state, changed };
}

// ---- One-time cleanup: remove exercises injected by the backfill migration ----
// The backfill added Active Recovery exercises to every Wednesday automatically.
// The calendar now shows Wednesdays as amber visually without needing real data,
// so we remove those auto-generated entries. We identify them by their ID prefix.
function cleanupBackfilledRecovery(state: AppState): { state: AppState; changed: boolean } {
  let changed = false;

  const weeks = state.weeks
    .map(wd => {
      if (wd.day !== 'Wednesday') return wd;

      // Remove only exercises that were auto-generated by the backfill
      const filtered = wd.exercises.filter(
        ex => !ex.id.startsWith('active_recovery_w')
      );
      if (filtered.length === wd.exercises.length) return wd; // nothing changed

      changed = true;
      return { ...wd, exercises: filtered };
    })
    // Remove WorkoutDay entries that are now empty AND have no completed flag
    // (they were created solely for the backfill — no manual work was done)
    .filter(wd => {
      if (wd.day !== 'Wednesday') return true;
      if (wd.exercises.length > 0) return true;
      if (wd.completed) return true; // keep if user explicitly marked done
      // If this was an auto-created empty Wednesday, remove it
      return false;
    });

  return { state: changed ? { ...state, weeks } : state, changed };
}

// ---- One-time patch: clear exercise data from Wednesday recovery days (W2–W7) ----
// These weeks were incorrectly imported from MVP1 as training days.
// Clearing them lets the Wednesday default (active-recovery amber) take effect.
const WEDNESDAY_RECOVERY_WEEKS = new Set([2, 3, 4, 5, 6, 7]);

function clearWednesdayRecoveryDays(state: AppState): { state: AppState; changed: boolean } {
  let changed = false;
  const weeks = state.weeks.map(wd => {
    if (wd.day !== 'Wednesday') return wd;
    if (!WEDNESDAY_RECOVERY_WEEKS.has(wd.week)) return wd;
    if (wd.exercises.length === 0 && !wd.completed) return wd;
    changed = true;
    const { completed: _c, ...rest } = wd;
    return { ...rest, exercises: [] };
  });
  return { state: changed ? { ...state, weeks } : state, changed };
}

// ---- One-time migration flags ----
// Tracks which one-time patches have already run per user.
// Stored in localStorage to avoid re-running on every boot.
const MIGRATIONS_KEY = (uid: string) => `timo_training_v4_migrations__${uid}`;

function getAppliedMigrations(uid: string): Set<string> {
  try {
    const raw = localStorage.getItem(MIGRATIONS_KEY(uid));
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function markMigrationApplied(uid: string, id: string) {
  const applied = getAppliedMigrations(uid);
  applied.add(id);
  try { localStorage.setItem(MIGRATIONS_KEY(uid), JSON.stringify([...applied])); } catch { /* ignore */ }
}

export async function bootForUser(user: User) {
  bootStatus.set('loading');
  try {
    const raw = await bootstrapState(user.id);
    const applied = getAppliedMigrations(user.id);

    let state = raw;
    let changed = false;

    // Patch 1 (one-time): clear incorrect exercise data from W2–W7 Wednesdays
    if (!applied.has('clear_wednesday_w2_w7')) {
      const { state: s, changed: c } = clearWednesdayRecoveryDays(state);
      state = s; changed = changed || c;
      markMigrationApplied(user.id, 'clear_wednesday_w2_w7');
    }

    // Patch 2 (one-time): remove auto-generated Active Recovery exercises from backfill
    if (!applied.has('cleanup_backfilled_recovery')) {
      const { state: s, changed: c } = cleanupBackfilledRecovery(state);
      state = s; changed = changed || c;
      markMigrationApplied(user.id, 'cleanup_backfilled_recovery');
    }

    // Ongoing: mark all past training days complete (runs every boot — new past days accumulate)
    const { state: final, changed: c3 } = applyPastDaysCompleted(state);
    state = final; changed = changed || c3;

    // ── userStartWeek (one-time, set on first boot) ──────────────────────────
    // Determines the week offset for display (displayWeek = absoluteWeek - offset).
    // Existing users with data → week 1 (no change to their history).
    // New users with no data → current absolute week (their training starts "Week 1").
    const todayUTC2 = (() => {
      const t = new Date();
      return Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
    })();
    const todayWeek = Math.max(1, Math.floor((todayUTC2 - MIGRATION_PS_UTC) / 86400000 / 7) + 1);

    if (!state.userStartWeek) {
      const hasExistingData = state.weeks.some(w => w.exercises.length > 0);
      const startWeek = hasExistingData ? 1 : todayWeek;
      state = { ...state, userStartWeek: startWeek };
      changed = true;
    }

    appState.set(state);

    if (changed) {
      saveLocal(user.id, state);
      saveCloud(user.id, state);
    }

    // Auto-select latest week after boot.
    const weeks = new Set(state.weeks.map(w => w.week));
    const latest = weeks.size ? Math.max(...weeks) : todayWeek;
    uiState.update(ui => ({ ...ui, week: latest }));
    bootStatus.set('ready');
  } catch {
    bootStatus.set('error');
  }
}

export function updateState(updater: (s: AppState) => AppState, immediate = false) {
  appState.update(s => {
    const next = updater(s);
    const user = get(currentUser);
    if (user) scheduleSave(user.id, next, immediate);
    return next;
  });
}

export function updateUI(updater: (s: UIState) => UIState) {
  uiState.update(updater);
}

// mapExercise is imported from lib/state-helpers

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
  updateState(state => moveExerciseInState(state, week, day, exId, direction));
}

// ---- Toggle set done ----
export function toggleSetDone(week: number, day: DayOfWeek, exId: string, setIndex: number) {
  updateState(
    state => toggleSetDoneInState(state, week, day, exId, setIndex),
    true  // immediate cloud save — prevents losing done state if app reloads within 3s
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
  updateState(state => updateSetFieldInState(state, week, day, exId, setIndex, field, value));
}

// ---- Add set (copy last set's values, clear done) ----
export function addSet(week: number, day: DayOfWeek, exId: string) {
  updateState(state => addSetToState(state, week, day, exId));
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
  updateState(state => deleteSetFromState(state, week, day, exId, setIndex));
}

// ---- Insert set at index (used for undo after delete) ----
export function insertSet(week: number, day: DayOfWeek, exId: string, index: number, set: WorkoutSet) {
  updateState(state => insertSetInState(state, week, day, exId, index, set));
}

// ---- Update day-level session note ----
export function updateDayNote(week: number, day: DayOfWeek, note: string) {
  updateState(s => ({
    ...s,
    weeks: s.weeks.map(w => {
      if (w.week !== week || w.day !== day) return w;
      return { ...w, note: note.trim() || undefined };
    }),
  }), true);
}

// ---- Rename exercise (usable during workout mode) ----
export function renameExercise(week: number, day: DayOfWeek, exId: string, newName: string) {
  const next = renameExerciseInState; // guard: returns unchanged state on empty string
  updateState(
    state => next(state, week, day, exId, newName),
    true // immediate cloud save — name change should persist even if app closes quickly
  );
}

// ---- Toggle recovery block done ----
export function toggleRecoveryDone(week: number, day: DayOfWeek, exId: string) {
  updateState(state =>
    mapExercise(state, week, day, exId, ex => ({ ...ex, recoveryDone: !ex.recoveryDone })),
    true
  );
}

export function toggleConditioningDone(week: number, day: DayOfWeek, exId: string) {
  updateState(state =>
    mapExercise(state, week, day, exId, ex => ({ ...ex, conditioningDone: !ex.conditioningDone })),
    true
  );
}

// ---- Delete exercise ----
export function deleteExercise(week: number, day: DayOfWeek, exId: string) {
  updateState(state => deleteExerciseFromState(state, week, day, exId));
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
