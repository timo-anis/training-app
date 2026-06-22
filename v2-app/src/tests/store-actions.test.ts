/**
 * Tests for stores/app.ts — undo system + insertExerciseAtState
 *
 * stores/app.ts imports supabase which requires env vars.
 * We mock the supabase client so tests run without .env.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { get } from 'svelte/store';

// Mock supabase before any app imports
vi.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail: vi.fn(),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }),
  },
}));

import { insertExerciseAtState } from '../lib/state-helpers';
import type { AppState, Exercise, WorkoutDay } from '../types/workout';

// ---- helpers ----

function makeSet(done = false) {
  return { kg: '80', reps: '5', done, rpe: '' };
}

function makeEx(id: string, name: string): Exercise {
  return {
    id, name, type: 'single', code: '',
    sets: [makeSet(), makeSet()],
    rest: '', note: '',
    recovery: false, recoveryDone: false,
    conditioning: false, conditioningNote: '', conditioningDone: false,
  };
}

function makeState(exercises: Exercise[]): AppState {
  const day: WorkoutDay = { week: 1, day: 'Monday', date: '2026-02-16', exercises };
  return { weeks: [day], schema: '4.0' };
}

// ---- insertExerciseAtState ----

describe('insertExerciseAtState', () => {
  it('inserts at index 0', () => {
    const state = makeState([makeEx('a', 'Squat'), makeEx('b', 'Bench')]);
    const result = insertExerciseAtState(state, 1, 'Monday', 0, makeEx('c', 'Deadlift'));
    expect(result.weeks[0].exercises.map(e => e.id)).toEqual(['c', 'a', 'b']);
  });

  it('inserts at middle index', () => {
    const state = makeState([makeEx('a', 'A'), makeEx('b', 'B'), makeEx('c', 'C')]);
    const result = insertExerciseAtState(state, 1, 'Monday', 1, makeEx('x', 'X'));
    expect(result.weeks[0].exercises.map(e => e.id)).toEqual(['a', 'x', 'b', 'c']);
  });

  it('inserts at end', () => {
    const state = makeState([makeEx('a', 'A'), makeEx('b', 'B')]);
    const result = insertExerciseAtState(state, 1, 'Monday', 2, makeEx('z', 'Z'));
    expect(result.weeks[0].exercises.map(e => e.id)).toEqual(['a', 'b', 'z']);
  });

  it('does not mutate original state', () => {
    const state = makeState([makeEx('a', 'A')]);
    insertExerciseAtState(state, 1, 'Monday', 0, makeEx('b', 'B'));
    expect(state.weeks[0].exercises).toHaveLength(1);
  });

  it('leaves other weeks untouched', () => {
    const state: AppState = {
      schema: '4.0',
      weeks: [
        { week: 1, day: 'Monday', date: '2026-02-16', exercises: [makeEx('a', 'A')] },
        { week: 2, day: 'Monday', date: '2026-02-23', exercises: [makeEx('b', 'B')] },
      ],
    };
    const result = insertExerciseAtState(state, 1, 'Monday', 0, makeEx('x', 'X'));
    expect(result.weeks[1].exercises).toHaveLength(1);
    expect(result.weeks[1].exercises[0].id).toBe('b');
  });
});

// ---- global undo store ----

describe('global undo store', () => {
  let pushUndo: typeof import('../stores/app').pushUndo;
  let execUndo: typeof import('../stores/app').execUndo;
  let clearUndo: typeof import('../stores/app').clearUndo;
  let undoAction: typeof import('../stores/app').undoAction;

  beforeEach(async () => {
    const mod = await import('../stores/app');
    pushUndo = mod.pushUndo;
    execUndo = mod.execUndo;
    clearUndo = mod.clearUndo;
    undoAction = mod.undoAction;
    clearUndo();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('pushUndo sets undoAction with correct label', () => {
    pushUndo({ label: 'Exercise deleted', fn: vi.fn() });
    expect(get(undoAction)?.label).toBe('Exercise deleted');
  });

  it('execUndo calls fn and clears undoAction', () => {
    const fn = vi.fn();
    pushUndo({ label: 'Test', fn });
    execUndo();
    expect(fn).toHaveBeenCalledOnce();
    expect(get(undoAction)).toBeNull();
  });

  it('clearUndo removes action without calling fn', () => {
    const fn = vi.fn();
    pushUndo({ label: 'Test', fn });
    clearUndo();
    expect(fn).not.toHaveBeenCalled();
    expect(get(undoAction)).toBeNull();
  });

  it('execUndo is a no-op when nothing pending', () => {
    expect(() => execUndo()).not.toThrow();
  });

  it('second pushUndo replaces first', () => {
    pushUndo({ label: 'First', fn: vi.fn() });
    const fn2 = vi.fn();
    pushUndo({ label: 'Second', fn: fn2 });
    expect(get(undoAction)?.label).toBe('Second');
    execUndo();
    expect(fn2).toHaveBeenCalledOnce();
  });

  it('auto-clears after 5 seconds without calling fn', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    pushUndo({ label: 'Auto', fn });
    vi.advanceTimersByTime(5001);
    expect(get(undoAction)).toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });
});
