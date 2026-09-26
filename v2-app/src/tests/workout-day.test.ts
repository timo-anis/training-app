/**
 * workout-day.test.ts — the workout session is pinned to the day it started on.
 * Regression for the blank "0/0 SETS · 1/0" workout screen: the overlay used to
 * render whatever day was being viewed, so browsing another day (or a nav reset)
 * swapped the session's exercises out from under the user.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signInWithPassword: vi.fn(), signUp: vi.fn(), signOut: vi.fn(), resetPasswordForEmail: vi.fn(),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }),
  },
}));
import { get } from 'svelte/store';
import { workoutDayOf, startWorkoutUI, openWorkoutUI, exitWorkoutUI, isSessionStale, MAX_SESSION_MS } from '../lib/workout-day';
import type { UIState } from '../types/workout';
import { uiState, appState, workoutBlocks, openWorkoutMode, closeWorkoutMode, exitWorkout, startWorkout } from '../stores/app';
import { emptyAppState, emptyExercise } from '../types/workout';

function ui(over: Partial<UIState> = {}): UIState {
  return {
    week: 10, day: 'Friday', search: '', workoutActive: false, workoutMode: false,
    activeExerciseIndex: 0, radarMode: 'day', calendarCollapsed: false,
    workoutStartTime: null, workoutWeek: null, workoutDay: null,
    restStartTime: null, restTotal: null, highlightExercise: null,
    ...over,
  };
}

describe('workout-day pure transitions', () => {
  it('workoutDayOf falls back to the viewed day when nothing is pinned', () => {
    expect(workoutDayOf(ui())).toEqual({ week: 10, day: 'Friday' });
  });

  it('workoutDayOf returns the pinned day even when viewing another day', () => {
    expect(workoutDayOf(ui({ week: 11, day: 'Saturday', workoutWeek: 10, workoutDay: 'Friday' })))
      .toEqual({ week: 10, day: 'Friday' });
  });

  it('opening with no session pins the viewed day and starts at block 0', () => {
    const next = openWorkoutUI(ui({ activeExerciseIndex: 3 }), 1000);
    expect(next).toMatchObject({
      workoutActive: true, workoutMode: true, activeExerciseIndex: 0,
      workoutStartTime: 1000, workoutWeek: 10, workoutDay: 'Friday',
    });
  });

  it('Resume jumps the view back to the pinned day and KEEPS the current block', () => {
    const running = ui({
      week: 11, day: 'Saturday', // user browsed to another day
      workoutActive: true, workoutMode: false, activeExerciseIndex: 2,
      workoutStartTime: 500, workoutWeek: 10, workoutDay: 'Friday',
    });
    const next = openWorkoutUI(running, 9999);
    expect(next).toMatchObject({
      workoutMode: true, week: 10, day: 'Friday', activeExerciseIndex: 2, workoutStartTime: 500,
    });
  });

  it('startWorkout pins once and never moves an existing pin', () => {
    const started = startWorkoutUI(ui(), 1);
    expect(started).toMatchObject({ workoutActive: true, workoutWeek: 10, workoutDay: 'Friday' });
    const moved = startWorkoutUI({ ...started, week: 12, day: 'Monday' }, 2);
    expect(moved).toMatchObject({ workoutWeek: 10, workoutDay: 'Friday', workoutStartTime: 1 });
  });

  it('exit clears the session, the pin and any running rest', () => {
    const next = exitWorkoutUI(ui({ workoutActive: true, workoutMode: true, workoutWeek: 10, workoutDay: 'Friday', workoutStartTime: 5, activeExerciseIndex: 2, restStartTime: 7, restTotal: 90 }));
    expect(next).toMatchObject({ workoutActive: false, workoutMode: false, workoutWeek: null, workoutDay: null, workoutStartTime: null, activeExerciseIndex: 0, restStartTime: null, restTotal: null });
  });

  it('a forgotten session (>= MAX_SESSION_MS) is not resumed: opening starts fresh on the viewed day', () => {
    const t0 = 1_000_000;
    const forgotten = ui({
      week: 11, day: 'Saturday', workoutActive: true, workoutMode: false, activeExerciseIndex: 3,
      workoutStartTime: t0, workoutWeek: 10, workoutDay: 'Friday',
    });
    expect(isSessionStale(forgotten, t0 + MAX_SESSION_MS)).toBe(true);
    expect(isSessionStale(forgotten, t0 + MAX_SESSION_MS - 1)).toBe(false);
    const next = openWorkoutUI(forgotten, t0 + MAX_SESSION_MS);
    expect(next).toMatchObject({
      week: 11, day: 'Saturday', workoutWeek: 11, workoutDay: 'Saturday',
      activeExerciseIndex: 0, workoutStartTime: t0 + MAX_SESSION_MS,
    });
    const started = startWorkoutUI(forgotten, t0 + MAX_SESSION_MS);
    expect(started).toMatchObject({ workoutWeek: 11, workoutDay: 'Saturday', workoutStartTime: t0 + MAX_SESSION_MS });
  });

  it('a live session just under the window still resumes its pinned day', () => {
    const t0 = 1_000_000;
    const live = ui({ week: 11, day: 'Saturday', workoutActive: true, workoutStartTime: t0, workoutWeek: 10, workoutDay: 'Friday', activeExerciseIndex: 2 });
    expect(openWorkoutUI(live, t0 + MAX_SESSION_MS - 1)).toMatchObject({ week: 10, day: 'Friday', activeExerciseIndex: 2 });
  });

  it('does not mutate its input', () => {
    const input = ui();
    const snap = JSON.stringify(input);
    openWorkoutUI(input, 1); startWorkoutUI(input, 1); exitWorkoutUI(input);
    expect(JSON.stringify(input)).toBe(snap);
  });
});

describe('workoutBlocks follows the pinned day (store integration)', () => {
  beforeEach(() => {
    exitWorkout();
    const s = emptyAppState();
    s.weeks = [
      { week: 10, day: 'Friday', date: '', exercises: [emptyExercise('squat_1', 'Squat'), emptyExercise('bench_1', 'Bench')] },
      { week: 10, day: 'Saturday', date: '', exercises: [] },
    ];
    appState.set(s);
    uiState.update(u => ({ ...u, week: 10, day: 'Friday' }));
  });

  it('browsing an empty day mid-session does not blank the workout', () => {
    openWorkoutMode();
    expect(get(workoutBlocks).length).toBe(2);
    closeWorkoutMode();
    uiState.update(u => ({ ...u, day: 'Saturday' })); // look at another day
    expect(get(workoutBlocks).length).toBe(2);        // session still Friday
    uiState.update(u => ({ ...u, activeExerciseIndex: 1 }));
    openWorkoutMode();                                  // Resume
    const u = get(uiState);
    expect(u.day).toBe('Friday');
    expect(u.activeExerciseIndex).toBe(1);
  });

  it('a nav reset while the overlay is open does not swap the session day', () => {
    openWorkoutMode();
    uiState.update(u => ({ ...u, week: 11, day: 'Saturday' })); // e.g. reboot → today
    expect(get(workoutBlocks).map(b => b.exercises[0].name)).toEqual(['Squat', 'Bench']);
  });

  it('exitWorkout drops the persisted rest timer so it cannot resurface next session', () => {
    localStorage.setItem('timo_training_v4_rest_timer', JSON.stringify({ s: Date.now(), t: 90, adv: true }));
    openWorkoutMode();
    exitWorkout();
    expect(localStorage.getItem('timo_training_v4_rest_timer')).toBeNull();
  });

  it('opening over a forgotten session drops its persisted rest blob', () => {
    openWorkoutMode();
    uiState.update(u => ({ ...u, workoutMode: false, workoutStartTime: Date.now() - 5 * 60 * 60 * 1000 }));
    localStorage.setItem('timo_training_v4_rest_timer', JSON.stringify({ s: Date.now(), t: 90, adv: true }));
    openWorkoutMode();
    expect(localStorage.getItem('timo_training_v4_rest_timer')).toBeNull();
    expect(get(uiState).workoutStartTime! > Date.now() - 5000).toBe(true);
  });

  it('with no session, workoutBlocks tracks the viewed day (unchanged behaviour)', () => {
    uiState.update(u => ({ ...u, day: 'Saturday' }));
    expect(get(workoutBlocks).length).toBe(0);
    startWorkout(); exitWorkout();
    expect(get(uiState).workoutWeek).toBeNull();
  });
});
