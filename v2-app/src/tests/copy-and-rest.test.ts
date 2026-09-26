/**
 * Tests for copyDayFrom() and addExercise() rest time inheritance.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

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

import { appState, copyDayFrom, copyPreviousDay, addExercise } from '../stores/app';
import { latestRestByName, restForCopy } from '../lib/rest-inherit';
import type { AppState, Exercise, WorkoutDay } from '../types/workout';

// ---- helpers ----

function makeSet(done = false, kg = '80', reps = '5') {
  return { kg, reps, done, rpe: '' };
}

function makeEx(id: string, name: string, rest = '', sets = [makeSet()]): Exercise {
  return {
    id, name, type: 'single', code: '',
    sets,
    rest, note: '',
    recovery: false, recoveryDone: false,
    conditioning: false, conditioningNote: '', conditioningDone: false,
  };
}

function makeState(weeks: WorkoutDay[]): AppState {
  return { weeks, schema: '4.0' };
}

function seedState(weeks: WorkoutDay[]) {
  appState.set(makeState(weeks));
}

// ---- copyDayFrom ----

describe('copyDayFrom', () => {
  beforeEach(() => {
    appState.set({ weeks: [], schema: '4.0' });
  });

  it('appends exercises from source day to existing target day', () => {
    seedState([
      { week: 1, day: 'Monday', date: '2026-01-06', exercises: [makeEx('a', 'Squat', '', [makeSet()])] },
      { week: 2, day: 'Monday', date: '2026-01-13', exercises: [makeEx('b', 'Bench', '', [makeSet()])] },
    ]);
    copyDayFrom(1, 'Monday', 2, 'Monday');
    const state = get(appState);
    const target = state.weeks.find(w => w.week === 2 && w.day === 'Monday')!;
    expect(target.exercises).toHaveLength(2);
    expect(target.exercises.map(e => e.name)).toContain('Squat');
    expect(target.exercises.map(e => e.name)).toContain('Bench');
  });

  it('creates target day if it does not exist', () => {
    seedState([
      { week: 1, day: 'Monday', date: '2026-01-06', exercises: [makeEx('a', 'Deadlift', '', [makeSet()])] },
    ]);
    copyDayFrom(1, 'Monday', 3, 'Wednesday');
    const state = get(appState);
    const target = state.weeks.find(w => w.week === 3 && w.day === 'Wednesday')!;
    expect(target).toBeDefined();
    expect(target.exercises[0].name).toBe('Deadlift');
    expect(target.kind).toBe('workout');
  });

  it('resets all done states on copied exercises', () => {
    seedState([
      { week: 1, day: 'Monday', date: '2026-01-06', exercises: [
        makeEx('a', 'Squat', '', [makeSet(true), makeSet(true)])
      ]},
    ]);
    copyDayFrom(1, 'Monday', 2, 'Monday');
    const state = get(appState);
    const target = state.weeks.find(w => w.week === 2 && w.day === 'Monday')!;
    const copied = target.exercises.find(e => e.name === 'Squat')!;
    expect(copied.sets.every(s => s.done === false)).toBe(true);
  });

  it('guarantees min 1 set when source exercise has 0 sets', () => {
    seedState([
      { week: 1, day: 'Monday', date: '2026-01-06', exercises: [
        { ...makeEx('a', 'Plank'), sets: [] }
      ]},
    ]);
    copyDayFrom(1, 'Monday', 2, 'Monday');
    const state = get(appState);
    const target = state.weeks.find(w => w.week === 2 && w.day === 'Monday')!;
    expect(target.exercises[0].sets).toHaveLength(1);
  });

  it('does not modify source day', () => {
    seedState([
      { week: 1, day: 'Monday', date: '2026-01-06', exercises: [makeEx('a', 'Squat', '', [makeSet(true)])] },
    ]);
    copyDayFrom(1, 'Monday', 2, 'Monday');
    const state = get(appState);
    const source = state.weeks.find(w => w.week === 1 && w.day === 'Monday')!;
    expect(source.exercises[0].sets[0].done).toBe(true); // unchanged
  });

  it('is a no-op when source day does not exist', () => {
    seedState([
      { week: 2, day: 'Monday', date: '2026-01-13', exercises: [makeEx('b', 'Bench')] },
    ]);
    copyDayFrom(99, 'Friday', 2, 'Monday');
    const state = get(appState);
    const target = state.weeks.find(w => w.week === 2 && w.day === 'Monday')!;
    expect(target.exercises).toHaveLength(1); // unchanged
  });
});

// ---- addExercise rest time inheritance ----

describe('addExercise — rest time inheritance', () => {
  beforeEach(() => {
    appState.set({ weeks: [], schema: '4.0' });
  });

  it('inherits rest from last occurrence of same exercise name', () => {
    seedState([
      { week: 1, day: 'Monday', date: '2026-01-06', exercises: [makeEx('a', 'Squat', '2:00')] },
    ]);
    addExercise(2, 'Monday', 'Squat');
    const state = get(appState);
    const newDay = state.weeks.find(w => w.week === 2 && w.day === 'Monday')!;
    const added = newDay.exercises.find(e => e.name === 'Squat')!;
    expect(added.rest).toBe('2:00');
  });

  it('inherits from latest week when exercise appears multiple times', () => {
    seedState([
      { week: 1, day: 'Monday', date: '2026-01-06', exercises: [makeEx('a', 'Deadlift', '1:30')] },
      { week: 2, day: 'Monday', date: '2026-01-13', exercises: [makeEx('b', 'Deadlift', '2:30')] },
    ]);
    addExercise(3, 'Monday', 'Deadlift');
    const state = get(appState);
    const newDay = state.weeks.find(w => w.week === 3 && w.day === 'Monday')!;
    const added = newDay.exercises.find(e => e.name === 'Deadlift')!;
    // Should pick up 2:30 (later occurrence) — store iterates weeks in order
    expect(added.rest).toBe('2:30');
  });

  it('is case-insensitive when matching exercise name', () => {
    seedState([
      { week: 1, day: 'Monday', date: '2026-01-06', exercises: [makeEx('a', 'Bench Press', '1:45')] },
    ]);
    addExercise(2, 'Monday', 'bench press');
    const state = get(appState);
    const newDay = state.weeks.find(w => w.week === 2 && w.day === 'Monday')!;
    const added = newDay.exercises.find(e => e.name === 'bench press')!;
    expect(added.rest).toBe('1:45');
  });

  it('leaves rest empty when no prior occurrence exists', () => {
    seedState([]);
    addExercise(1, 'Monday', 'Romanian Deadlift');
    const state = get(appState);
    const newDay = state.weeks.find(w => w.week === 1 && w.day === 'Monday')!;
    const added = newDay.exercises.find(e => e.name === 'Romanian Deadlift')!;
    expect(added.rest).toBe('');
  });

  it('leaves rest empty when prior occurrence has no rest set', () => {
    seedState([
      { week: 1, day: 'Monday', date: '2026-01-06', exercises: [makeEx('a', 'Pull-up', '')] },
    ]);
    addExercise(2, 'Monday', 'Pull-up');
    const state = get(appState);
    const newDay = state.weeks.find(w => w.week === 2 && w.day === 'Monday')!;
    const added = newDay.exercises.find(e => e.name === 'Pull-up')!;
    expect(added.rest).toBe('');
  });
});

// ---- copy fills an EMPTY rest with the last-used rest (2026-09-26) ----

describe('copy-day — rest inheritance', () => {
  beforeEach(() => appState.set({ weeks: [], schema: '4.0' }));

  it('copyDayFrom fills an empty source rest with the latest rest used for that exercise', () => {
    seedState([
      { week: 1, day: 'Monday', date: '', exercises: [makeEx('a', 'Squat', '')] },          // source: no rest
      { week: 3, day: 'Friday', date: '', exercises: [makeEx('b', 'squat ', '2:30')] },     // latest use
      { week: 2, day: 'Friday', date: '', exercises: [makeEx('c', 'Squat', '1:30')] },      // older use
    ]);
    copyDayFrom(1, 'Monday', 4, 'Monday');
    const tgt = get(appState).weeks.find(w => w.week === 4 && w.day === 'Monday')!;
    expect(tgt.exercises[0].rest).toBe('2:30');
  });

  it('an explicit rest on the source always wins', () => {
    seedState([
      { week: 1, day: 'Monday', date: '', exercises: [makeEx('a', 'Squat', '3:00')] },
      { week: 3, day: 'Friday', date: '', exercises: [makeEx('b', 'Squat', '2:30')] },
    ]);
    copyDayFrom(1, 'Monday', 4, 'Monday');
    const tgt = get(appState).weeks.find(w => w.week === 4 && w.day === 'Monday')!;
    expect(tgt.exercises[0].rest).toBe('3:00');
  });

  it('stays empty when the exercise never had a rest', () => {
    seedState([{ week: 1, day: 'Monday', date: '', exercises: [makeEx('a', 'Plank', '')] }]);
    copyDayFrom(1, 'Monday', 2, 'Monday');
    const tgt = get(appState).weeks.find(w => w.week === 2 && w.day === 'Monday')!;
    expect(tgt.exercises[0].rest).toBe('');
  });

  it('copyPreviousDay also fills empty rest, and never touches the source day', () => {
    seedState([
      { week: 1, day: 'Tuesday', date: '', exercises: [makeEx('a', 'Row', '')] },
      { week: 1, day: 'Friday', date: '', exercises: [makeEx('b', 'Row', '2:00')] },
    ]);
    copyPreviousDay(2, 'Tuesday');
    const st = get(appState);
    expect(st.weeks.find(w => w.week === 2 && w.day === 'Tuesday')!.exercises[0].rest).toBe('2:00');
    expect(st.weeks.find(w => w.week === 1 && w.day === 'Tuesday')!.exercises[0].rest).toBe('');
  });

  it('keeps superset codes, order, kg/reps and resets done (unchanged copy semantics)', () => {
    const a1 = { ...makeEx('a1', 'Bench', '', [makeSet(true, '80', '5')]), type: 'superset' as const, code: 'A1' };
    const a2 = { ...makeEx('a2', 'Row', '', [makeSet(true, '60', '8')]), type: 'superset' as const, code: 'A2' };
    seedState([
      { week: 1, day: 'Monday', date: '', exercises: [a2, a1] },
      { week: 1, day: 'Friday', date: '', exercises: [makeEx('x', 'Row', '1:45')] },
    ]);
    copyDayFrom(1, 'Monday', 2, 'Monday');
    const ex = get(appState).weeks.find(w => w.week === 2 && w.day === 'Monday')!.exercises;
    expect(ex.map(e => e.code)).toEqual(['A1', 'A2']);
    expect(ex.map(e => e.type)).toEqual(['superset', 'superset']);
    expect(ex[0].sets[0]).toEqual({ kg: '80', reps: '5', done: false, rpe: '' });
    expect(ex[1].rest).toBe('1:45');
    expect(ex[0].rest).toBe('');
  });
});

describe('latestRestByName / restForCopy (pure)', () => {
  it('picks the chronologically latest non-empty rest (week, then Mon→Sun), not array order', () => {
    const weeks: WorkoutDay[] = [
      { week: 5, day: 'Sunday', date: '', exercises: [makeEx('1', 'Dip', '1:00')] },
      { week: 5, day: 'Monday', date: '', exercises: [makeEx('2', 'Dip', '2:00')] },
      { week: 4, day: 'Sunday', date: '', exercises: [makeEx('3', 'Dip', '3:00')] },
      { week: 6, day: 'Monday', date: '', exercises: [makeEx('4', 'Dip', '')] },
    ];
    expect(latestRestByName(weeks).get('dip')).toBe('1:00');
  });
  it('restForCopy prefers own rest, then latest, then empty', () => {
    const m = new Map([['dip', '2:00']]);
    expect(restForCopy({ name: 'Dip', rest: '0:45' }, m)).toBe('0:45');
    expect(restForCopy({ name: ' DIP', rest: '' }, m)).toBe('2:00');
    expect(restForCopy({ name: 'Curl', rest: '' }, m)).toBe('');
  });
});
