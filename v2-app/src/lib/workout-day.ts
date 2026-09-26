/**
 * workout-day.ts — the workout session is pinned to the day it was started on.
 *
 * Before: workout mode rendered whatever day was currently VIEWED
 * (uiState.week/day). Anything that moved the view mid-session — browsing
 * another day then tapping Resume, or a re-boot resetting nav to today — made
 * the overlay show a different (often empty) day: the blank "0/0 SETS · 1/0"
 * screen, and in the worst case logging sets onto the wrong day.
 *
 * Now: starting a workout pins (workoutWeek, workoutDay); workout mode always
 * reads the pinned day; Resume navigates back to it and keeps the exercise the
 * user was on. Pure functions so the transitions are unit-testable.
 */
import type { DayOfWeek, UIState } from '../types/workout';

type WorkoutUI = Pick<UIState,
  'week' | 'day' | 'workoutActive' | 'workoutMode' | 'activeExerciseIndex' |
  'workoutStartTime' | 'workoutWeek' | 'workoutDay' | 'restStartTime' | 'restTotal'>;

/** The day the workout overlay must render: the pinned day, else the viewed day. */
export function workoutDayOf(ui: Pick<UIState, 'week' | 'day' | 'workoutWeek' | 'workoutDay'>): { week: number; day: DayOfWeek } {
  if (ui.workoutWeek != null && ui.workoutDay != null) return { week: ui.workoutWeek, day: ui.workoutDay };
  return { week: ui.week, day: ui.day };
}

/**
 * A session older than this is treated as forgotten (never stopped): it no
 * longer blocks the resume re-boot, and Resume/Start begins a fresh session on
 * the viewed day instead of reopening an old day (e.g. yesterday's workout
 * left open overnight).
 */
export const MAX_SESSION_MS = 4 * 60 * 60 * 1000;

export function isSessionStale(ui: Pick<UIState, 'workoutActive' | 'workoutStartTime'>, now: number): boolean {
  return ui.workoutActive && ui.workoutStartTime !== null && now - ui.workoutStartTime >= MAX_SESSION_MS;
}

function hasPin(ui: WorkoutUI): boolean {
  return ui.workoutActive && ui.workoutWeek != null && ui.workoutDay != null;
}

/** Start (or keep) the session timer without opening the overlay. */
export function startWorkoutUI<T extends WorkoutUI>(ui: T, now: number): T {
  if (isSessionStale(ui, now)) ui = exitWorkoutUI(ui);
  if (hasPin(ui)) return { ...ui, workoutActive: true, workoutStartTime: ui.workoutStartTime ?? now };
  return {
    ...ui,
    workoutActive: true,
    workoutStartTime: ui.workoutStartTime ?? now,
    workoutWeek: ui.week,
    workoutDay: ui.day,
  };
}

/**
 * Open the workout overlay.
 * - No session running → start one pinned to the viewed day, at the first block.
 * - Session running (Resume) → jump the view back to the pinned day and keep
 *   the block the user was on.
 */
export function openWorkoutUI<T extends WorkoutUI>(ui: T, now: number): T {
  if (isSessionStale(ui, now)) ui = exitWorkoutUI(ui); // forgotten session → start fresh here
  if (hasPin(ui)) {
    return {
      ...ui,
      workoutMode: true,
      week: ui.workoutWeek as number,
      day: ui.workoutDay as DayOfWeek,
      workoutStartTime: ui.workoutStartTime ?? now,
    };
  }
  return {
    ...ui,
    workoutActive: true,
    workoutMode: true,
    activeExerciseIndex: 0,
    workoutStartTime: ui.workoutStartTime ?? now,
    workoutWeek: ui.week,
    workoutDay: ui.day,
  };
}

/**
 * End the session: clear the timer, the overlay, the pin and any rest timer —
 * a rest left running when the session is stopped from the bar must not show
 * up as "Rest done" on the next session.
 */
export function exitWorkoutUI<T extends WorkoutUI>(ui: T): T {
  return {
    ...ui,
    workoutActive: false,
    workoutMode: false,
    activeExerciseIndex: 0,
    workoutStartTime: null,
    workoutWeek: null,
    workoutDay: null,
    restStartTime: null,
    restTotal: null,
  };
}
