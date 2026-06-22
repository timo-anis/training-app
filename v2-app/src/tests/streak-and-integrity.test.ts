/**
 * Tests for the consistency/streak surface + the "done reflects reality"
 * data-integrity rule (Bug 2 fix) + copyDayFrom.
 *
 * stores/app.ts imports supabase which requires env vars — mock it.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

vi.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }),
  },
  isRecoveryPending: vi.fn().mockReturnValue(false),
  clearRecoveryPending: vi.fn(),
}));

import { appState, uiState, streakInfo, dayHasActivity, copyDayFrom } from '../stores/app';
import { emptyDay, emptyExercise, emptySet } from '../types/workout';
import type { WorkoutDay, DayOfWeek, Exercise } from '../types/workout';

// ---- helpers ----
function exWithSet(id: string, name: string, done: boolean): Exercise {
  return { ...emptyExercise(id, name), sets: [{ kg: '80', reps: '5', done, rpe: '' }] };
}
function day(week: number, d: DayOfWeek, opts: Partial<WorkoutDay> = {}): WorkoutDay {
  return { ...emptyDay(week, d, '2026-01-01'), ...opts };
}
function setWeeks(weeks: WorkoutDay[], curWeek: number) {
  appState.set({ weeks, schema: '4.0' });
  uiState.update(u => ({ ...u, week: curWeek }));
}

beforeEach(() => {
  appState.set({ weeks: [], schema: '4.0' });
});

describe('dayHasActivity — counts real logged work only (Bug 2)', () => {
  it('is false for a day with no done sets', () => {
    expect(dayHasActivity(day(1, 'Monday', { exercises: [exWithSet('e1', 'Squat', false)] }))).toBe(false);
  });
  it('is true when any set is done', () => {
    expect(dayHasActivity(day(1, 'Monday', { exercises: [exWithSet('e1', 'Squat', true)] }))).toBe(true);
  });
  it('is FALSE when completed:true but no set/recovery/conditioning is done (stale completed must not count)', () => {
    expect(dayHasActivity(day(1, 'Monday', { completed: true, exercises: [exWithSet('e1', 'Squat', false)] }))).toBe(false);
  });
  it('is true when a recovery block is done', () => {
    const ex: Exercise = { ...emptyExercise('r1', 'Mobility'), recovery: true, recoveryDone: true, sets: [] };
    expect(dayHasActivity(day(1, 'Monday', { exercises: [ex] }))).toBe(true);
  });
  it('is true when a conditioning block is done', () => {
    const ex: Exercise = { ...emptyExercise('c1', 'Bike'), conditioning: true, conditioningDone: true, sets: [] };
    expect(dayHasActivity(day(1, 'Monday', { exercises: [ex] }))).toBe(true);
  });
});

describe('streakInfo — active / risk / dormant', () => {
  it('dormant: no active weeks -> count 0, this week inactive', () => {
    setWeeks([day(1, 'Monday', { exercises: [exWithSet('e', 'Squat', false)] })], 3);
    const s = get(streakInfo);
    expect(s.count).toBe(0);
    expect(s.thisWeekActive).toBe(false);
    expect(s.recent).toEqual([false, false, false, false, false, false]);
  });

  it('active: this week + prior consecutive weeks logged -> count counts up incl. current', () => {
    setWeeks([
      day(1, 'Monday', { exercises: [exWithSet('e', 'Squat', true)] }),
      day(2, 'Monday', { exercises: [exWithSet('e', 'Squat', true)] }),
      day(3, 'Monday', { exercises: [exWithSet('e', 'Squat', true)] }),
    ], 3);
    const s = get(streakInfo);
    expect(s.count).toBe(3);
    expect(s.thisWeekActive).toBe(true);
  });

  it('risk: prior weeks logged but current week not yet -> streak stands, this week inactive', () => {
    setWeeks([
      day(1, 'Monday', { exercises: [exWithSet('e', 'Squat', true)] }),
      day(2, 'Monday', { exercises: [exWithSet('e', 'Squat', true)] }),
      day(3, 'Monday', { exercises: [exWithSet('e', 'Squat', false)] }),
    ], 3);
    const s = get(streakInfo);
    expect(s.count).toBe(2);
    expect(s.thisWeekActive).toBe(false);
    expect(s.recent[5]).toBe(false); // current week dot hollow
  });

  it('a gap breaks the streak (only consecutive weeks back from current count)', () => {
    setWeeks([
      day(1, 'Monday', { exercises: [exWithSet('e', 'Squat', true)] }),
      // week 2 missing
      day(3, 'Monday', { exercises: [exWithSet('e', 'Squat', true)] }),
    ], 3);
    expect(get(streakInfo).count).toBe(1);
  });
});

describe('copyDayFrom — clones, resets done, preserves source', () => {
  beforeEach(() => {
    appState.set({
      weeks: [day(1, 'Monday', {
        exercises: [
          { ...emptyExercise('a', 'Bench'), sets: [{ kg: '60', reps: '5', done: true, rpe: '' }, { kg: '60', reps: '5', done: true, rpe: '' }] },
          { ...emptyExercise('b', 'Row'), type: 'superset', code: 'A', sets: [{ kg: '40', reps: '8', done: true, rpe: '' }] },
        ],
      })],
      schema: '4.0',
    });
  });

  it('appends cloned exercises to target with done reset and structure preserved', () => {
    copyDayFrom(1, 'Monday', 2, 'Tuesday');
    const tgt = get(appState).weeks.find(w => w.week === 2 && w.day === 'Tuesday')!;
    // copyDayFrom sorts coded supersets before singles (A < none), so Row (A) leads.
    expect(tgt.exercises.map(e => e.name)).toEqual(['Row', 'Bench']);
    expect(tgt.exercises.every(e => e.sets.every(s => !s.done))).toBe(true);
    expect(tgt.exercises.every(e => e.sets.length >= 1)).toBe(true);
    // superset structure preserved
    const row = tgt.exercises.find(e => e.name === 'Row')!;
    expect(row.type).toBe('superset');
    expect(row.code).toBe('A');
  });

  it('leaves the source day untouched (done states intact)', () => {
    copyDayFrom(1, 'Monday', 2, 'Tuesday');
    const src = get(appState).weeks.find(w => w.week === 1 && w.day === 'Monday')!;
    expect(src.exercises[0].sets.every(s => s.done)).toBe(true);
  });
});
