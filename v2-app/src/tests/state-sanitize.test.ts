/**
 * Tests for src/lib/state-sanitize.ts
 *
 * Covers: null filtering, negative reps/kg clamping, superset-with-no-code
 * demotion, invalid date filtering, name normalization, done coercion.
 */
import { describe, it, expect } from 'vitest';
import { sanitizeState } from '../lib/state-sanitize';
import type { AppState, Exercise, WorkoutSet, WorkoutDay } from '../types/workout';

function makeState(weeks: WorkoutDay[] = []): AppState {
  return { schema: '4.1', weeks };
}

function makeSet(overrides: Partial<WorkoutSet> = {}): WorkoutSet {
  return { reps: '8', kg: '60', done: false, rpe: '', ...overrides };
}

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'ex1',
    name: 'Bench Press',
    type: 'single',
    code: '',
    sets: [makeSet()],
    rest: '',
    note: '',
    recovery: false,
    recoveryDone: false,
    conditioning: false,
    conditioningNote: '',
    conditioningDone: false,
    ...overrides,
  };
}

function makeDay(overrides: Partial<WorkoutDay> = {}): WorkoutDay {
  return { week: 1, day: 'Monday', date: '2026-02-16', exercises: [makeExercise()], ...overrides };
}

describe('sanitizeState', () => {
  it('passes through a clean state unchanged (modulo name normalisation)', () => {
    const s = makeState([makeDay()]);
    const result = sanitizeState(s);
    expect(result.weeks).toHaveLength(1);
    expect(typeof result.weeks[0].exercises[0].name).toBe('string');
    expect(result.weeks[0].exercises[0].name.length).toBeGreaterThan(0);
  });

  it('filters null weeks', () => {
    const s = makeState([null as any, makeDay()]);
    expect(sanitizeState(s).weeks).toHaveLength(1);
  });

  it('filters null exercises within a week', () => {
    const s = makeState([makeDay({ exercises: [null as any, makeExercise()] })]);
    expect(sanitizeState(s).weeks[0].exercises).toHaveLength(1);
  });

  it('filters null sets within an exercise', () => {
    const s = makeState([makeDay({ exercises: [makeExercise({ sets: [null as any, makeSet()] })] })]);
    expect(sanitizeState(s).weeks[0].exercises[0].sets).toHaveLength(1);
  });

  it('clamps negative reps to positive', () => {
    const s = makeState([makeDay({ exercises: [makeExercise({ sets: [makeSet({ reps: '-5' })] })] })]);
    expect(sanitizeState(s).weeks[0].exercises[0].sets[0].reps).toBe('5');
  });

  it('clamps negative kg to positive', () => {
    const s = makeState([makeDay({ exercises: [makeExercise({ sets: [makeSet({ kg: '-20' })] })] })]);
    expect(sanitizeState(s).weeks[0].exercises[0].sets[0].kg).toBe('20');
  });

  it('leaves non-negative numeric strings unchanged', () => {
    const s = makeState([makeDay({ exercises: [makeExercise({ sets: [makeSet({ reps: '10', kg: '100' })] })] })]);
    const result = sanitizeState(s);
    expect(result.weeks[0].exercises[0].sets[0].reps).toBe('10');
    expect(result.weeks[0].exercises[0].sets[0].kg).toBe('100');
  });

  it('demotes superset with empty code to single', () => {
    const s = makeState([makeDay({ exercises: [makeExercise({ type: 'superset', code: '' })] })]);
    expect(sanitizeState(s).weeks[0].exercises[0].type).toBe('single');
  });

  it('preserves superset with non-empty code', () => {
    const s = makeState([makeDay({ exercises: [makeExercise({ type: 'superset', code: 'A' })] })]);
    expect(sanitizeState(s).weeks[0].exercises[0].type).toBe('superset');
  });

  it('filters WorkoutDays with invalid date strings', () => {
    const s = makeState([
      makeDay({ date: 'not-a-date' }),
      makeDay({ day: 'Tuesday', date: '2026-02-17' }),
    ]);
    const result = sanitizeState(s);
    expect(result.weeks).toHaveLength(1);
    expect(result.weeks[0].date).toBe('2026-02-17');
  });

  it('preserves WorkoutDays with empty date field (legacy)', () => {
    const s = makeState([makeDay({ date: '' })]);
    expect(sanitizeState(s).weeks).toHaveLength(1);
  });

  it('does not throw on null/undefined input', () => {
    expect(() => sanitizeState(null as any)).not.toThrow();
    expect(() => sanitizeState(undefined as any)).not.toThrow();
  });

  it('coerces truthy non-boolean done to true', () => {
    const s = makeState([makeDay({ exercises: [makeExercise({ sets: [{ ...makeSet(), done: 1 as any }] })] })]);
    const result = sanitizeState(s);
    expect(typeof result.weeks[0].exercises[0].sets[0].done).toBe('boolean');
    expect(result.weeks[0].exercises[0].sets[0].done).toBe(true);
  });

  it('preserves empty state without throwing', () => {
    expect(sanitizeState(makeState())).toEqual(makeState());
  });
});
