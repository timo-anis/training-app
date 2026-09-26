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
  'workoutStartTime' | 'workoutWeek' | 'workoutDay'>;

/** The day the workout overlay must render: the pinned day, else the viewed day. */
export function workoutDayOf(ui: Pick<UIState, 'week' | 'day' | 'workoutWeek' | 'workoutDay'>): { week: number; day: DayOfWeek } {
  if (ui.workoutWeek != null && ui.workoutDay != null) return { week: ui.workoutWeek, day: ui.workoutDay };
  return { week: ui.week, day: ui.day };
}

function hasPin(ui: WorkoutUI): boolean {
  return ui.workoutActive && ui.workoutWeek != null && ui.workoutDay != null;
}

/** Start (or keep) the session timer without opening the overlay. */
export function startWorkoutUI<T extends WorkoutUI>(ui: T, now: number): T {
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

/** End the session: clear the timer, the overlay and the pin. */
export function exitWorkoutUI<T extends WorkoutUI>(ui: T): T {
  return {
    ...ui,
    workoutActive: false,
    workoutMode: false,
    activeExerciseIndex: 0,
    workoutStartTime: null,
    workoutWeek: null,
    workoutDay: null,
  };
}
