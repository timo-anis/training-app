import { describe, it, expect } from 'vitest';
import {
  assignmentKey, indexAssignments, seedMaterializedExercises, materializedDay, isActualDay,
  type Assignment,
} from '../lib/assignments';
import type { Exercise, WorkoutDay } from '../types/workout';

const ex = (over: Partial<Exercise>): Exercise => ({
  id: 'e1', name: 'Squat', type: 'single', code: '', rest: '', note: '',
  recovery: false, recoveryDone: false, conditioning: false, conditioningNote: '', conditioningDone: false,
  sets: [{ kg: '100', reps: '5', done: false, rpe: '' }],
  ...over,
});

const asg = (over: Partial<Assignment>): Assignment => ({
  id: 'a', week: 1, day: 'Monday', exercises: [], updatedAt: null, ...over,
});

describe('assignmentKey', () => {
  it('separates by week and day', () => {
    expect(assignmentKey(1, 'Monday')).toBe('1|Monday');
    expect(assignmentKey(1, 'Monday')).not.toBe(assignmentKey(2, 'Monday'));
    expect(assignmentKey(1, 'Monday')).not.toBe(assignmentKey(1, 'Tuesday'));
  });
});

describe('indexAssignments', () => {
  it('keys each assignment by week|day', () => {
    const m = indexAssignments([asg({ week: 2, day: 'Friday' }), asg({ week: 3, day: 'Monday' })]);
    expect(m.get('2|Friday')).toBeTruthy();
    expect(m.get('3|Monday')).toBeTruthy();
    expect(m.size).toBe(2);
  });
});

describe('seedMaterializedExercises — first-touch flip', () => {
  it('preserves structure exactly: id, name, type, code, order, kg/reps, count', () => {
    const input: Exercise[] = [
      ex({ id: 'a', name: 'Bench', type: 'superset', code: 'A', sets: [
        { kg: '60', reps: '8', done: true, rpe: '8' },
        { kg: '60', reps: '8', done: true, rpe: '9' },
      ] }),
      ex({ id: 'b', name: 'Row', type: 'superset', code: 'A', sets: [{ kg: '50', reps: '10', done: false, rpe: '' }] }),
    ];
    const out = seedMaterializedExercises(input);
    expect(out.map((e) => e.id)).toEqual(['a', 'b']);          // order + ids preserved
    expect(out[0].name).toBe('Bench');
    expect(out[0].type).toBe('superset');
    expect(out[0].code).toBe('A');
    expect(out[0].sets.length).toBe(2);                        // every set preserved
    expect(out[0].sets.map((s) => `${s.kg}x${s.reps}`)).toEqual(['60x8', '60x8']); // seeded values kept
  });

  it('resets ONLY completion fields (done=false, rpe="", recovery/conditioning done flags)', () => {
    const out = seedMaterializedExercises([
      ex({ recovery: true, recoveryDone: true, conditioning: true, conditioningDone: true, conditioningNote: 'Z2 20min',
        sets: [{ kg: '100', reps: '5', done: true, rpe: '7.5' }] }),
    ]);
    expect(out[0].sets[0].done).toBe(false);
    expect(out[0].sets[0].rpe).toBe('');
    expect(out[0].recoveryDone).toBe(false);
    expect(out[0].conditioningDone).toBe(false);
    expect(out[0].conditioningNote).toBe('Z2 20min'); // prescription text is a seed, kept
  });

  it('is a pure copy — does not mutate the input', () => {
    const input = [ex({ sets: [{ kg: '100', reps: '5', done: true, rpe: '9' }] })];
    const snapshot = JSON.stringify(input);
    seedMaterializedExercises(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe('materializedDay', () => {
  it('builds a workout-kind day at the given date with seeded exercises', () => {
    const d = materializedDay(5, 'Wednesday', '2026-03-18', [ex({})]);
    expect(d.week).toBe(5);
    expect(d.day).toBe('Wednesday');
    expect(d.date).toBe('2026-03-18');
    expect(d.kind).toBe('workout');
    expect(d.completed).toBeUndefined();
    expect(d.exercises[0].sets[0].done).toBe(false);
  });
});

describe('isActualDay — ownership flip predicate', () => {
  it('false for undefined or empty day, true once it holds exercises', () => {
    expect(isActualDay(undefined)).toBe(false);
    expect(isActualDay({ week: 1, day: 'Monday', date: '', exercises: [] } as WorkoutDay)).toBe(false);
    expect(isActualDay({ week: 1, day: 'Monday', date: '', exercises: [ex({})] } as WorkoutDay)).toBe(true);
  });
});
