/**
 * Pure state transformation helpers — no side effects, no store access.
 *
 * These are extracted from stores/app.ts so they can be unit-tested
 * independently without needing to mock Supabase or localStorage.
 * The store actions in app.ts call updateState(state => helper(state, ...)).
 */

import type { AppState, DayOfWeek, Exercise, WorkoutSet } from '../types/workout';

// ---- Core mapper ----

/** Apply an updater to a single exercise, returning the new AppState. */
export function mapExercise(
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

// ---- Set operations ----

/** Toggle done flag on a single set. */
export function toggleSetDoneInState(
  state: AppState,
  week: number,
  day: DayOfWeek,
  exId: string,
  setIndex: number
): AppState {
  return mapExercise(state, week, day, exId, ex => ({
    ...ex,
    sets: ex.sets.map((s, i) => i === setIndex ? { ...s, done: !s.done } : s),
  }));
}

/** Delete a set at a given index. */
export function deleteSetFromState(
  state: AppState,
  week: number,
  day: DayOfWeek,
  exId: string,
  setIndex: number
): AppState {
  return mapExercise(state, week, day, exId, ex => ({
    ...ex,
    sets: ex.sets.filter((_, i) => i !== setIndex),
  }));
}

/** Insert a set at a given index (used for undo after delete). */
export function insertSetInState(
  state: AppState,
  week: number,
  day: DayOfWeek,
  exId: string,
  index: number,
  set: WorkoutSet
): AppState {
  return mapExercise(state, week, day, exId, ex => ({
    ...ex,
    sets: [
      ...ex.sets.slice(0, index),
      { kg: set.kg, reps: set.reps, done: set.done, rpe: set.rpe },
      ...ex.sets.slice(index),
    ],
  }));
}

/** Add a set (copy last set's values, clear done). */
export function addSetToState(
  state: AppState,
  week: number,
  day: DayOfWeek,
  exId: string
): AppState {
  return mapExercise(state, week, day, exId, ex => {
    const last = ex.sets[ex.sets.length - 1];
    return {
      ...ex,
      sets: [...ex.sets, { kg: last?.kg ?? '', reps: last?.reps ?? '', done: false, rpe: '' }],
    };
  });
}

/** Update a single set field (kg or reps). */
export function updateSetFieldInState(
  state: AppState,
  week: number,
  day: DayOfWeek,
  exId: string,
  setIndex: number,
  field: 'kg' | 'reps',
  value: string
): AppState {
  return mapExercise(state, week, day, exId, ex => ({
    ...ex,
    sets: ex.sets.map((s, i) => i === setIndex ? { ...s, [field]: value } : s),
  }));
}

/** Update a single set's RPE. '' clears it back to unrated. */
export function updateSetRpeInState(
  state: AppState,
  week: number,
  day: DayOfWeek,
  exId: string,
  setIndex: number,
  value: string
): AppState {
  return mapExercise(state, week, day, exId, ex => ({
    ...ex,
    sets: ex.sets.map((s, i) => i === setIndex ? { ...s, rpe: value } : s),
  }));
}

// ---- Exercise operations ----

/** Delete an exercise by id. */
export function deleteExerciseFromState(
  state: AppState,
  week: number,
  day: DayOfWeek,
  exId: string
): AppState {
  return {
    ...state,
    weeks: state.weeks.map(w => {
      if (w.week !== week || w.day !== day) return w;
      return { ...w, exercises: w.exercises.filter(ex => ex.id !== exId) };
    }),
  };
}

/** Insert an exercise at a specific index (used for undo after delete). */
export function insertExerciseAtState(
  state: AppState,
  week: number,
  day: DayOfWeek,
  index: number,
  exercise: import('../types/workout').Exercise
): AppState {
  return {
    ...state,
    weeks: state.weeks.map(w => {
      if (w.week !== week || w.day !== day) return w;
      const exs = [...w.exercises];
      exs.splice(index, 0, exercise);
      return { ...w, exercises: exs };
    }),
  };
}

/** Rename an exercise. */
export function renameExerciseInState(
  state: AppState,
  week: number,
  day: DayOfWeek,
  exId: string,
  newName: string
): AppState {
  const trimmed = newName.trim();
  if (!trimmed) return state;
  return mapExercise(state, week, day, exId, ex => ({ ...ex, name: trimmed }));
}

/** Move an exercise up or down. */
export function moveExerciseInState(
  state: AppState,
  week: number,
  day: DayOfWeek,
  exId: string,
  direction: 'up' | 'down'
): AppState {
  return {
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
  };
}

// ---- Workout blocks grouping (mirrors the derived store logic) ----

export interface WorkoutBlock {
  id: string;
  exercises: Exercise[];
  isSuperset: boolean;
  code: string;
}

/** Group a flat exercise list into workout blocks (single | superset). */
export function buildWorkoutBlocks(exercises: Exercise[]): WorkoutBlock[] {
  const blocks: WorkoutBlock[] = [];
  const seenGroups = new Set<string>();

  for (const ex of exercises) {
    if (ex.type === 'single' || !ex.code) {
      blocks.push({ id: ex.id, exercises: [ex], isSuperset: false, code: '' });
    } else {
      // Superset members share the FIRST letter of their code (A1, A2 -> "A";
      // B1, B2, B3 -> "B"). Group by that letter so a multi-exercise superset is
      // ONE block shown together — the user alternates sets without paging
      // next/back. Matches the calendar/coach view (which already key on code[0]).
      const groupKey = ex.code[0];
      if (!seenGroups.has(groupKey)) {
        seenGroups.add(groupKey);
        const group = exercises.filter(e => e.type === 'superset' && !!e.code && e.code[0] === groupKey);
        blocks.push({ id: `superset_${groupKey}`, exercises: group, isSuperset: true, code: groupKey });
      }
    }
  }
  return blocks;
}
