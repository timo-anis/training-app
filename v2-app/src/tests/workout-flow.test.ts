/**
 * Integration test for the core workout flow at the store level:
 * open workout mode -> mark sets done -> finish. Exercises the real exported
 * store actions and their wiring (the "must never break during a workout" path).
 * Supabase is mocked so this runs without env/network.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

vi.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi
        .fn()
        .mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }),
  },
}));

import {
  appState,
  uiState,
  openWorkoutMode,
  toggleSetDone,
  markWorkoutComplete,
  exitWorkout,
} from '../stores/app';
import { emptyExercise } from '../types/workout';
import type { AppState } from '../types/workout';

function seed(): void {
  const ex = emptyExercise('e1', 'Bench Press');
  ex.sets = [
    { kg: '80', reps: '5', done: false },
    { kg: '80', reps: '5', done: false },
  ];
  const state: AppState = {
    weeks: [{ week: 1, day: 'Monday', date: '2026-06-01', exercises: [ex] }],
    schema: '4.0',
  };
  appState.set(state);
}

describe('workout flow: open -> set done -> finish', () => {
  beforeEach(() => {
    exitWorkout();
    seed();
  });

  it('opens the focused workout overlay', () => {
    openWorkoutMode();
    const ui = get(uiState);
    expect(ui.workoutActive).toBe(true);
    expect(ui.workoutMode).toBe(true);
  });

  it('marks sets done and they persist in state (without touching the others)', () => {
    openWorkoutMode();
    toggleSetDone(1, 'Monday', 'e1', 0);
    let ex = get(appState).weeks[0].exercises[0];
    expect(ex.sets[0].done).toBe(true);
    expect(ex.sets[1].done).toBe(false);

    toggleSetDone(1, 'Monday', 'e1', 1);
    ex = get(appState).weeks[0].exercises[0];
    expect(ex.sets.every((s) => s.done)).toBe(true);
  });

  it('a done set can be toggled back off (no stuck done state)', () => {
    toggleSetDone(1, 'Monday', 'e1', 0);
    toggleSetDone(1, 'Monday', 'e1', 0);
    expect(get(appState).weeks[0].exercises[0].sets[0].done).toBe(false);
  });

  it('finishing marks the day complete and closes the overlay', () => {
    openWorkoutMode();
    markWorkoutComplete(1, 'Monday');
    expect(get(appState).weeks[0].completed).toBe(true);

    exitWorkout();
    const ui = get(uiState);
    expect(ui.workoutActive).toBe(false);
    expect(ui.workoutMode).toBe(false);
  });
});
