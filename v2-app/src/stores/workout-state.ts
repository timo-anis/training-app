/**
 * workout-state.ts — Workout data, derived stores, all mutations, boot logic.
 * Imports from ui-state.ts and sync.ts; no circular deps.
 */
import { writable, derived, get } from 'svelte/store';
import { getStoredNavSnapshot } from './ui-state';
import { dayFullyDone } from '../lib/day-status';
import type { AppState, DayOfWeek, WorkoutDay, Exercise, WorkoutSet, DayKind } from '../types/workout';
import { emptyAppState, emptyExercise, DAY_ORDER } from '../types/workout';
import { bootstrapState } from '../services/storage';
import { sanitizeState } from '../lib/state-sanitize';
import { PS_UTC } from '../lib/program';
import { getDateForWeekDay, getWeekDayForDate } from '../lib/dates';
import { bestE1RM, suggestRpe } from '../lib/rpe';
import {
  mapExercise,
  toggleSetDoneInState,
  deleteSetFromState,
  insertSetInState,
  addSetToState,
  updateSetFieldInState,
  updateSetRpeInState,
  deleteExerciseFromState,
  insertExerciseAtState,
  renameExerciseInState,
  moveExerciseInState,
  buildWorkoutBlocks as _buildWorkoutBlocks,
} from '../lib/state-helpers';
import { sortByExerciseCode } from '../lib/exercise-sort';
import { materializedDay } from '../lib/assignments';
import {
  uiState, bootStatus, currentUser, updateUI, pushUndo,
} from './ui-state';
import { scheduleSave } from './sync';

// ---- App state store ----
export const appState = writable<AppState>(emptyAppState());

// ---- Week display offset ----
export const weekOffset = derived(appState, $s => ($s.userStartWeek ?? 1) - 1);

// ---- Derived: all weeks that have data + current selected week ----
export const availableWeeks = derived([appState, uiState], ([$state, $ui]) => {
  const weeks = new Set($state.weeks.map(w => w.week));
  weeks.add($ui.week);
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

// ---- Streak / consistency ----
// A day "counts" as trained if it has any logged activity.
// Shared single source of truth — consumed by the finish screen and the
// persistent momentum strip. Pure read; no mutation, no schema change.
export function dayHasActivity(wd: WorkoutDay): boolean {
  // Real logged work only — a stale `completed: true` with everything since
  // un-checked must NOT count (keeps streak consistent with the calendar).
  return wd.exercises.some(ex =>
    ex.sets.some(s => s.done) || ex.conditioningDone || ex.recoveryDone);
}

// A day is "fully done" when every exercise is fully completed:
// - strength exercise: ALL sets have done:true
// - recovery exercise: recoveryDone:true
// - conditioning exercise: conditioningDone:true
// Used by the HeroCard day-rings (stricter than dayHasActivity).
// dayFullyDone is defined in lib/day-status.ts (single source of truth)
export { dayFullyDone };

export interface StreakInfo {
  /** Consecutive weeks with activity, ending at the current week (if trained)
   *  or the last trained week before it (streak standing, current week at risk). */
  count: number;
  /** Whether the current week already has logged activity. */
  thisWeekActive: boolean;
  /** Last 6 weeks (oldest -> newest, ending at current week): trained or not. */
  recent: boolean[];
}

// Persistent streak view: counts real logged activity only (current week is
// NOT assumed active — that absence is the "at risk" signal the strip surfaces).
export const streakInfo = derived([appState, uiState], ([$s, $ui]): StreakInfo => {
  const active = new Set<number>();
  for (const wd of $s.weeks) if (dayHasActivity(wd)) active.add(wd.week);
  const cur = $ui.week;
  const thisWeekActive = active.has(cur);
  let count = 0;
  let w = thisWeekActive ? cur : cur - 1;
  while (active.has(w)) { count++; w--; }
  const recent: boolean[] = [];
  for (let i = 5; i >= 0; i--) recent.push(active.has(cur - i));
  return { count, thisWeekActive, recent };
});

// ---- Workout blocks ----
export interface WorkoutBlock {
  id: string;
  exercises: Exercise[];
  isSuperset: boolean;
  code: string;
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
    if (wd.week === currentWeek && wd.day === currentDay) continue;
    for (const ex of wd.exercises) {
      if (ex.name.toLowerCase() !== lower) continue;
      if (ex.sets.length === 0) continue;
      const dayIdx = DAY_ORDER.indexOf(wd.day);
      const isBetter = wd.week > bestWeek || (wd.week === bestWeek && dayIdx > bestDayIdx);
      if (isBetter) {
        bestWeek = wd.week;
        bestDayIdx = dayIdx;
        result = { week: wd.week, day: wd.day, sets: ex.sets.map(s => ({ kg: s.kg, reps: s.reps })) };
      }
    }
  }
  return result;
}

// ---- RPE auto-suggest: collect this exercise's history + suggest an RPE ----
/** All (kg, reps) sets logged for an exercise name on OTHER days (any week). */
export function exerciseHistorySets(
  state: AppState,
  name: string,
  currentWeek: number,
  currentDay: DayOfWeek
): { kg: string; reps: string }[] {
  const lower = name.toLowerCase();
  const out: { kg: string; reps: string }[] = [];
  for (const wd of state.weeks) {
    if (wd.week === currentWeek && wd.day === currentDay) continue;
    for (const ex of wd.exercises) {
      if (ex.name.toLowerCase() !== lower) continue;
      for (const s of ex.sets) out.push({ kg: s.kg, reps: s.reps });
    }
  }
  return out;
}

/**
 * Suggested RPE for a set at today's load, from the exercise's prior history.
 * Returns null when kg/reps are blank OR there is no usable history — manual only.
 * A rough pre-fill: it is shown faint and never recorded unless confirmed.
 */
export function suggestRpeForSet(
  state: AppState,
  name: string,
  currentWeek: number,
  currentDay: DayOfWeek,
  kgNow: string,
  repsNow: string
): number | null {
  if (!kgNow || !repsNow) return null;
  const e1RM = bestE1RM(exerciseHistorySets(state, name, currentWeek, currentDay));
  return suggestRpe(kgNow, repsNow, e1RM);
}

// ---- Progression: find last conditioning note ----
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
      if (!ex.conditioning || !ex.conditioningNote) continue;
      const dayIdx = DAY_ORDER.indexOf(wd.day);
      const isBetter = wd.week > bestWeek || (wd.week === bestWeek && dayIdx > bestDayIdx);
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

// ---- Day navigation ----
export function todayWeekDay(): { week: number; day: DayOfWeek } | null {
  const n = new Date();
  const iso = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  return getWeekDayForDate(iso);
}

export function goToAdjacentDay(delta: number) {
  const ui = get(uiState);
  const curISO = getDateForWeekDay(ui.week, ui.day);
  const [y, mo, d] = curISO.split('-').map(Number);
  const next = new Date(Date.UTC(y, mo - 1, d) + delta * 86400000);
  const iso = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
  const wd = getWeekDayForDate(iso);
  if (!wd) return;
  updateUI(u => ({ ...u, week: wd.week, day: wd.day }));
}

export function goToToday() {
  const wd = todayWeekDay();
  if (wd) updateUI(u => ({ ...u, week: wd.week, day: wd.day }));
}

// ---- Copy previous week's same day ----
export function copyPreviousDay(targetWeek: number, day: DayOfWeek) {
  const state = get(appState);
  const sourceWeek = targetWeek - 1;
  const sourceDay = state.weeks.find(w => w.week === sourceWeek && w.day === day);
  if (!sourceDay || sourceDay.exercises.length === 0) return;

  const filtered = state.weeks.filter(w => !(w.week === targetWeek && w.day === day));
  const cloned: WorkoutDay = {
    week: targetWeek,
    day,
    date: getDateForWeekDay(targetWeek, day),
    exercises: (() => {
      const mapped = sourceDay.exercises.map(ex => ({
        ...ex,
        id: `${ex.id}_w${targetWeek}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        sets: ex.sets.length > 0 ? ex.sets.map(s => ({ kg: s.kg, reps: s.reps, done: false, rpe: '' })) : [{ kg: '', reps: '', done: false, rpe: '' }],
        recoveryDone: false,
        conditioningDone: false,
        conditioningNote: '',
      }));
      // Sort by code to guarantee A1 < A2 < B1 < B2 order regardless of source order
      return sortByExerciseCode(mapped);
    })(),
  };
  updateState(() => ({ ...state, weeks: [...filtered, cloned] }));
}

// ---- Copy any past day into a target day (append) ----
export function copyDayFrom(srcWeek: number, srcDay: DayOfWeek, tgtWeek: number, tgtDay: DayOfWeek) {
  const state = get(appState);
  const sourceDay = state.weeks.find(w => w.week === srcWeek && w.day === srcDay);
  if (!sourceDay || sourceDay.exercises.length === 0) return;

  const cloned = sourceDay.exercises.map(ex => ({
    ...ex,
    id: `${ex.id}_copy_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    sets: ex.sets.length > 0 ? ex.sets.map(s => ({ kg: s.kg, reps: s.reps, done: false as const, rpe: '' })) : [{ kg: '', reps: '', done: false as const, rpe: '' }],
    recoveryDone: false,
    conditioningDone: false,
    conditioningNote: '',
  }));

  // Preserve superset order: A1 < A2 < B1 < B2, recovery last
  const sorted = sortByExerciseCode(cloned);

  const date = getDateForWeekDay(tgtWeek, tgtDay);

  updateState(s => {
    const existing = s.weeks.find(w => w.week === tgtWeek && w.day === tgtDay);
    if (existing) {
      return {
        ...s,
        weeks: s.weeks.map(w =>
          w.week === tgtWeek && w.day === tgtDay
            ? { ...w, exercises: [...w.exercises, ...sorted] }
            : w
        ),
      };
    }
    const newDay: WorkoutDay = { week: tgtWeek, day: tgtDay, date, exercises: sorted, kind: 'workout' };
    return { ...s, weeks: [...s.weeks, newDay] };
  });
}

// ---- Workout mode actions ----
export function startWorkout() {
  uiState.update(ui => ({
    ...ui,
    workoutActive: true,
    workoutStartTime: ui.workoutStartTime ?? Date.now(),
  }));
}

export function openWorkoutMode() {
  uiState.update(ui => ({
    ...ui,
    workoutActive: true,
    workoutMode: true,
    activeExerciseIndex: 0,
    workoutStartTime: ui.workoutStartTime ?? Date.now(),
  }));
}

export function closeWorkoutMode() {
  uiState.update(ui => ({ ...ui, workoutMode: false }));
}

export function markWorkoutComplete(week: number, day: DayOfWeek) {
  updateState(state => ({
    ...state,
    weeks: state.weeks.map(w =>
      w.week === week && w.day === day ? { ...w, completed: true } : w
    ),
  }), true);
}

export function setDayKind(week: number, day: DayOfWeek, kind: DayKind | null) {
  updateState(state => {
    const exists = state.weeks.find(w => w.week === week && w.day === day);
    if (exists) {
      return {
        ...state,
        weeks: state.weeks.map(w => {
          if (w.week !== week || w.day !== day) return w;
          if (kind === null) {
            const { kind: _k, ...rest } = w;
            return rest as WorkoutDay;
          }
          return { ...w, kind };
        }),
      };
    }
    if (kind === null) return state;
    const date = getDateForWeekDay(week, day);
    const newDay: WorkoutDay = { week, day, date, exercises: [], kind };
    return { ...state, weeks: [...state.weeks, newDay] };
  });
}

export function setDayLabel(week: number, day: DayOfWeek, label: string) {
  updateState(state => {
    const exists = state.weeks.find(w => w.week === week && w.day === day);
    if (exists) {
      return {
        ...state,
        weeks: state.weeks.map(w => {
          if (w.week !== week || w.day !== day) return w;
          if (!label) {
            const { label: _l, ...rest } = w;
            return rest as WorkoutDay;
          }
          return { ...w, label };
        }),
      };
    }
    if (!label) return state;
    const date = getDateForWeekDay(week, day);
    const newDay: WorkoutDay = { week, day, date, exercises: [], label };
    return { ...state, weeks: [...state.weeks, newDay] };
  });
}

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

// ---- Core state updater ----
export function updateState(updater: (s: AppState) => AppState, immediate = false) {
  appState.update(s => {
    const next = updater(s);
    const user = get(currentUser);
    if (user) scheduleSave(user.id, next, immediate);
    return next;
  });
}

// ---- Boot ----
import type { User } from '@supabase/supabase-js';

export async function bootForUser(user: User) {
  bootStatus.set('loading');
  try {
    const raw = await bootstrapState(user.id);

    let state = raw;
    let changed = false;

    const todayUTC2 = (() => {
      const t = new Date();
      return Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
    })();
    const todayWeek = Math.max(1, Math.floor((todayUTC2 - PS_UTC) / 86400000 / 7) + 1);

    if (!state.userStartWeek) {
      const hasExistingData = state.weeks.some(w => w.exercises.length > 0);
      const startWeek = hasExistingData ? 1 : todayWeek;
      state = { ...state, userStartWeek: startWeek };
      changed = true;
    }

    // Sanitize exercise names before storing — catches any dirty names that
    // survived migrations or arrived from a pre-sanitize local cache.
    state = sanitizeState(state);
    appState.set(state);

    if (changed) {
      // scheduleSave also applies sanitizeState, but we pass the already-clean
      // state here; the key benefit is it routes through the single save path.
      scheduleSave(user.id, state, true);
    }

    const todayDayIdx = (() => {
      const d = new Date().getDay();
      return d === 0 ? 6 : d - 1;
    })();
    const todayDay = DAY_ORDER[todayDayIdx];
    // Restore stored nav if the week still exists in loaded state; else fall back to today
    // Use the snapshot via getter — mutable so it can be cleared on sign-out.
    // Direct loadStoredNav() would return the subscribe-overwritten value (wrong).
    const _snap = getStoredNavSnapshot();
    const _navSameDay = _snap?.savedAt === new Date().toDateString();
    const _navWeek = (_navSameDay && _snap && state.weeks.some(w => w.week === _snap.week))
      ? _snap.week
      : todayWeek;
    const _navDay = (_navSameDay ? (_snap?.day ?? todayDay) : todayDay) as DayOfWeek;
    uiState.update(ui => ({ ...ui, week: _navWeek, day: _navDay }));
    bootStatus.set('ready');
  } catch (err) {
    // Log boot failures so they appear in browser devtools AND in app_errors
    // (cloud error tracker). Without this, boot failures are silent and
    // impossible to diagnose remotely.
    console.error('[bootForUser] Failed to load training data:', err);
    bootStatus.set('error');
  }
}

// ---- Exercise / set mutations ----

export function updateExerciseMeta(
  week: number, day: DayOfWeek, exId: string,
  fields: Partial<Pick<Exercise, 'name' | 'rest' | 'note' | 'type' | 'code' | 'conditioning'>>
) {
  updateState(state => {
    const updated = mapExercise(state, week, day, exId, ex => ({ ...ex, ...fields }));
    // If code changed, re-sort exercises by code so A1<A2<B1<B2 order is maintained
    if ('code' in fields) {
      return {
        ...updated,
        weeks: updated.weeks.map(w => {
          if (w.week !== week || w.day !== day) return w;
          return {
            ...w,
            exercises: sortByExerciseCode(w.exercises),
          };
        }),
      };
    }
    return updated;
  });
}

export function updateConditioningNote(week: number, day: DayOfWeek, exId: string, note: string) {
  updateState(state => mapExercise(state, week, day, exId, ex => ({ ...ex, conditioningNote: note })));
}

export function moveExercise(week: number, day: DayOfWeek, exId: string, direction: 'up' | 'down') {
  updateState(state => moveExerciseInState(state, week, day, exId, direction));
}

export function toggleSetDone(week: number, day: DayOfWeek, exId: string, setIndex: number) {
  updateState(state => toggleSetDoneInState(state, week, day, exId, setIndex), true);
}

export function updateSetField(
  week: number, day: DayOfWeek, exId: string,
  setIndex: number, field: 'kg' | 'reps', value: string
) {
  updateState(state => updateSetFieldInState(state, week, day, exId, setIndex, field, value));
}

export function updateSetRpe(
  week: number, day: DayOfWeek, exId: string,
  setIndex: number, value: string
) {
  updateState(state => updateSetRpeInState(state, week, day, exId, setIndex, value), true);
}

export function addSet(week: number, day: DayOfWeek, exId: string) {
  updateState(state => addSetToState(state, week, day, exId));
}

export function addExercise(week: number, day: DayOfWeek, name: string) {
  const id = `${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
  updateState(state => {
    // Inherit rest time from last occurrence of same exercise name
    const lower = name.toLowerCase();
    let inheritedRest = '';
    for (const wd of state.weeks) {
      for (const ex of wd.exercises) {
        if (ex.name.toLowerCase() === lower && ex.rest) inheritedRest = ex.rest;
      }
    }
    const newEx = { ...emptyExercise(id, name), rest: inheritedRest };
    const exists = state.weeks.find(w => w.week === week && w.day === day);
    if (exists) {
      return {
        ...state,
        weeks: state.weeks.map(w => {
          if (w.week !== week || w.day !== day) return w;
          return { ...w, kind: w.kind ?? 'workout', exercises: [...w.exercises, newEx] };
        }),
      };
    }
    const date = getDateForWeekDay(week, day);
    const newDay: WorkoutDay = { week, day, date, exercises: [newEx], kind: 'workout' };
    return { ...state, weeks: [...state.weeks, newDay] };
  });
}

export function deleteSet(week: number, day: DayOfWeek, exId: string, setIndex: number) {
  updateState(state => deleteSetFromState(state, week, day, exId, setIndex));
}

export function insertSet(week: number, day: DayOfWeek, exId: string, index: number, set: WorkoutSet) {
  updateState(state => insertSetInState(state, week, day, exId, index, set));
}

export function updateDayNote(week: number, day: DayOfWeek, note: string) {
  updateState(s => ({
    ...s,
    weeks: s.weeks.map(w => {
      if (w.week !== week || w.day !== day) return w;
      return { ...w, note: note.trim() || undefined };
    }),
  }), true);
}

export function renameExercise(week: number, day: DayOfWeek, exId: string, newName: string) {
  updateState(state => renameExerciseInState(state, week, day, exId, newName), true);
}

export function toggleRecoveryDone(week: number, day: DayOfWeek, exId: string) {
  updateState(state => mapExercise(state, week, day, exId, ex => ({ ...ex, recoveryDone: !ex.recoveryDone })), true);
}

export function toggleConditioningDone(week: number, day: DayOfWeek, exId: string) {
  updateState(state => mapExercise(state, week, day, exId, ex => ({ ...ex, conditioningDone: !ex.conditioningDone })), true);
}

export function insertExerciseAt(week: number, day: DayOfWeek, index: number, exercise: Exercise) {
  updateState(state => insertExerciseAtState(state, week, day, index, exercise));
}

export function deleteExercise(week: number, day: DayOfWeek, exId: string) {
  const state = get(appState);
  const wd = state.weeks.find(w => w.week === week && w.day === day);
  const exIndex = wd?.exercises.findIndex(e => e.id === exId) ?? -1;
  const captured = wd?.exercises[exIndex];
  updateState(s => deleteExerciseFromState(s, week, day, exId));
  if (captured && exIndex >= 0) {
    const ex = { ...captured };
    pushUndo({
      label: `"${ex.name}" deleted`,
      fn: () => updateState(s => insertExerciseAtState(s, week, day, exIndex, ex)),
    });
  }
}


// ---- Materialize a coach assignment on first touch (trainee-only) ----
// §3.4 ownership flip: an untouched prescribed day lives in coach_assignments;
// the moment the trainee starts it, the client copies the plan into the
// trainee's OWN blob (seeded values, done=false, rpe='') and from then it is
// trainee-owned "actual" — the coach comments only. ONLY the trainee's client
// writes app_state, so the single-writer invariant holds. Guarded: never
// overwrites a day that already has logged exercises.
export function materializeAssignment(week: number, day: DayOfWeek, exercises: import('../types/workout').Exercise[]): boolean {
  const state = get(appState);
  const existing = state.weeks.find(w => w.week === week && w.day === day);
  if (existing && existing.exercises.length > 0) return false; // already actual — do not clobber
  const date = getDateForWeekDay(week, day);
  const fresh = materializedDay(week, day, date, exercises);
  updateState(s => {
    const has = s.weeks.find(w => w.week === week && w.day === day);
    if (has) {
      // empty placeholder day (e.g. a kind mark) — fill it. The materialized
      // workout's kind wins, so a coach workout assigned onto a day the trainee
      // had marked recovery/rest becomes a 'workout' day (L1 audit fix).
      return {
        ...s,
        weeks: s.weeks.map(w =>
          w.week === week && w.day === day
            ? { ...w, exercises: fresh.exercises, kind: fresh.kind }
            : w),
      };
    }
    return { ...s, weeks: [...s.weeks, fresh] };
  }, true);
  return true;
}
